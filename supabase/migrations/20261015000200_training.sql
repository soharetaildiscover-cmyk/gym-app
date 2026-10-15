-- ============================================================================
-- Training: exercise library, program templates, assignments, workout logs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Exercise library. owner_id null = the global library everyone sees.
-- ---------------------------------------------------------------------------
create table public.exercises (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 80),
  muscle_group       text not null,
  equipment          text not null default 'Bodyweight',
  level              text not null default 'Beginner' check (level in ('Beginner', 'Intermediate', 'Advanced')),
  secondary_muscles  text not null default '',
  owner_id           uuid references public.profiles (id) on delete cascade,
  created_at         timestamptz not null default now()
);
create unique index exercises_global_name on public.exercises (lower(name)) where owner_id is null;
create index exercises_owner on public.exercises (owner_id);

-- ---------------------------------------------------------------------------
-- Program templates (built by a coach, or by a solo athlete for themselves)
-- template -> days -> exercises
-- ---------------------------------------------------------------------------
create table public.program_templates (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  description  text not null default '',
  goal         text,
  level        text,
  weeks        smallint not null default 8 check (weeks between 1 and 52),
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index program_templates_owner on public.program_templates (owner_id, status);
create trigger program_templates_touch before update on public.program_templates
  for each row execute function public.touch_updated_at();

create table public.template_days (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.program_templates (id) on delete cascade,
  position      smallint not null,
  name          text not null,                 -- "Upper A"
  focus         text not null default '',      -- "Chest, back, shoulders"
  est_minutes   smallint,
  unique (template_id, position)
);

create table public.template_exercises (
  id              uuid primary key default gen_random_uuid(),
  day_id          uuid not null references public.template_days (id) on delete cascade,
  exercise_id     uuid not null references public.exercises (id),
  position        smallint not null,
  sets            smallint not null check (sets between 1 and 20),
  reps            text not null,                -- "5", "8-10", "AMRAP"
  target_load_kg  numeric(6, 2),
  rest_seconds    smallint,
  notes           text not null default '',
  unique (day_id, position)
);

create or replace function public.owns_template(p_template uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.program_templates t where t.id = p_template and t.owner_id = auth.uid());
$$;

create or replace function public.owns_template_day(p_day uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.template_days d join public.program_templates t on t.id = d.template_id
    where d.id = p_day and t.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Assignments: a frozen copy (snapshot) of a template given to one athlete.
-- Editing a template later never rewrites what an athlete already has.
-- Created only through assign_program().
-- ---------------------------------------------------------------------------
create table public.assignments (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.profiles (id) on delete cascade,
  assigned_by   uuid not null references public.profiles (id) on delete cascade,
  template_id   uuid references public.program_templates (id) on delete set null,
  name          text not null,
  weeks         smallint not null,
  snapshot      jsonb not null,   -- { days: [{ position, name, focus, est_minutes, exercises: [...] }] }
  start_date    date not null,
  end_date      date,
  status        text not null default 'active' check (status in ('scheduled', 'active', 'replaced', 'completed', 'cancelled')),
  created_at    timestamptz not null default now()
);
create unique index assignments_one_active on public.assignments (athlete_id) where status = 'active';
create index assignments_athlete on public.assignments (athlete_id, start_date desc);

-- Assign a template to one or more athletes from a start date.
-- The caller must own the template and, for anyone other than themselves,
-- be that athlete's ACTIVE coach. Any current program is marked 'replaced'.
create or replace function public.assign_program(p_template uuid, p_athletes uuid[], p_start date)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  me   uuid := auth.uid();
  t    public.program_templates;
  snap jsonb;
  a    uuid;
  new_id uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select * into t from public.program_templates where id = p_template and owner_id = me;
  if not found then raise exception 'Program not found'; end if;
  if t.status = 'archived' then raise exception 'This program is archived'; end if;
  if coalesce(array_length(p_athletes, 1), 0) = 0 then raise exception 'Pick at least one athlete'; end if;

  select jsonb_build_object('days', coalesce(jsonb_agg(day order by (day ->> 'position')::int), '[]'::jsonb))
  into snap
  from (
    select jsonb_build_object(
      'position', d.position, 'name', d.name, 'focus', d.focus, 'est_minutes', d.est_minutes,
      'exercises', coalesce((
        select jsonb_agg(jsonb_build_object(
          'exercise_id', e.exercise_id, 'name', x.name, 'position', e.position, 'sets', e.sets,
          'reps', e.reps, 'target_load_kg', e.target_load_kg, 'rest_seconds', e.rest_seconds, 'notes', e.notes
        ) order by e.position)
        from public.template_exercises e join public.exercises x on x.id = e.exercise_id
        where e.day_id = d.id), '[]'::jsonb)
    ) as day
    from public.template_days d where d.template_id = t.id
  ) days;

  if jsonb_array_length(snap -> 'days') = 0 then raise exception 'Add at least one day before assigning'; end if;

  foreach a in array p_athletes loop
    if a <> me and not public.is_active_coach_of(a) then
      raise exception 'You are not the active coach of one of these athletes';
    end if;

    if p_start <= current_date then
      update public.assignments set status = 'replaced', end_date = p_start - 1
      where athlete_id = a and status = 'active';
    end if;

    insert into public.assignments (athlete_id, assigned_by, template_id, name, weeks, snapshot, start_date, status)
    values (a, me, t.id, t.name, t.weeks, snap, p_start,
            case when p_start <= current_date then 'active' else 'scheduled' end)
    returning id into new_id;
    return next new_id;
  end loop;

  if t.status = 'draft' then
    update public.program_templates set status = 'published' where id = t.id;
  end if;
end $$;

-- Turn scheduled programs on when their start date arrives (run daily, and on app open).
create or replace function public.activate_due_assignments()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  for r in select * from public.assignments
           where status = 'scheduled' and start_date <= current_date
           order by start_date loop
    update public.assignments set status = 'replaced', end_date = r.start_date - 1
    where athlete_id = r.athlete_id and status = 'active';
    update public.assignments set status = 'active' where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Workout logs
-- ---------------------------------------------------------------------------
create table public.workout_sessions (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.profiles (id) on delete cascade,
  assignment_id   uuid references public.assignments (id) on delete set null,
  day_position    smallint,                 -- which day of the program, if any
  name            text not null,
  performed_on    date not null default current_date,
  status          text not null default 'in_progress' check (status in ('in_progress', 'partial', 'completed')),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  notes           text not null default '',
  client_id       uuid unique,              -- set by the phone, so an offline retry never duplicates
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, athlete_id)
);
create index workout_sessions_athlete on public.workout_sessions (athlete_id, performed_on desc);
create trigger workout_sessions_touch before update on public.workout_sessions
  for each row execute function public.touch_updated_at();

create table public.set_logs (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null,
  athlete_id   uuid not null,
  exercise_id  uuid not null references public.exercises (id),
  set_no       smallint not null check (set_no between 1 and 50),
  weight_kg    numeric(6, 2) check (weight_kg >= 0),
  reps         smallint check (reps between 0 and 500),
  rpe          numeric(3, 1) check (rpe between 1 and 10),
  completed    boolean not null default true,
  client_id    uuid unique,
  created_at   timestamptz not null default now(),
  -- the set always belongs to the same athlete as its session
  foreign key (session_id, athlete_id) references public.workout_sessions (id, athlete_id) on delete cascade
);
create index set_logs_session on public.set_logs (session_id, exercise_id, set_no);
create index set_logs_athlete_exercise on public.set_logs (athlete_id, exercise_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.exercises          enable row level security;
alter table public.program_templates  enable row level security;
alter table public.template_days      enable row level security;
alter table public.template_exercises enable row level security;
alter table public.assignments        enable row level security;
alter table public.workout_sessions   enable row level security;
alter table public.set_logs           enable row level security;

create policy "exercises: read library, own, and your coach's" on public.exercises
  for select to authenticated using (
    owner_id is null or owner_id = (select auth.uid()) or public.was_coached_by(owner_id)
  );
create policy "exercises: write own" on public.exercises
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "templates: owner" on public.program_templates
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "template days: owner" on public.template_days
  for all to authenticated
  using (public.owns_template(template_id)) with check (public.owns_template(template_id));
create policy "template exercises: owner" on public.template_exercises
  for all to authenticated
  using (public.owns_template_day(day_id)) with check (public.owns_template_day(day_id));

-- assignments: the athlete, and whoever assigned it while they still coach them.
create policy "assignments: athlete and assigning coach read" on public.assignments
  for select to authenticated using (
    athlete_id = (select auth.uid())
    or (assigned_by = (select auth.uid()) and public.is_current_coach_of(athlete_id))
  );
revoke insert, update, delete on public.assignments from authenticated;

create policy "sessions: athlete owns" on public.workout_sessions
  for all to authenticated
  using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "sessions: coach reads with training scope" on public.workout_sessions
  for select to authenticated using (public.coach_can_see(athlete_id, 'training'));

create policy "sets: athlete owns" on public.set_logs
  for all to authenticated
  using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "sets: coach reads with training scope" on public.set_logs
  for select to authenticated using (public.coach_can_see(athlete_id, 'training'));

revoke execute on function public.assign_program(uuid, uuid[], date) from public, anon;
grant execute on function public.assign_program(uuid, uuid[], date) to authenticated;
revoke execute on function public.activate_due_assignments() from public, anon;
grant execute on function public.activate_due_assignments() to authenticated;
