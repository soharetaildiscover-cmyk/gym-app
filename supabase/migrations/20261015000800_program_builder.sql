-- ============================================================================
-- Program builder
--   - Each session (template day) can be scheduled on weekdays (0 = Sunday … 6 = Saturday).
--   - save_program(): saves a whole program (details, sessions, exercises) in one
--     step. SECURITY INVOKER, so the normal owner-only policies still apply.
--   - assign_program(): the athlete must be sharing Training with the coach, and
--     the weekly schedule is copied into the athlete's snapshot.
-- ============================================================================

alter table public.template_days
  add column weekdays smallint[] not null default '{}'
  check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

-- p_data: { name, description?, goal?, level?, weeks,
--           sessions: [{ name, focus?, est_minutes?, weekdays: int[],
--                        exercises: [{ exercise_id, sets, reps, target_load_kg?, rest_seconds?, notes? }] }] }
create or replace function public.save_program(p_template uuid, p_data jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  t_id  uuid := p_template;
  s     jsonb;
  e     jsonb;
  s_pos int := 0;
  e_pos int;
  d_id  uuid;
  used  smallint[] := '{}';
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if coalesce(trim(p_data ->> 'name'), '') = '' then raise exception 'Give the program a name'; end if;
  if jsonb_array_length(coalesce(p_data -> 'sessions', '[]')) = 0 then raise exception 'Add at least one session'; end if;

  if t_id is null then
    insert into public.program_templates (owner_id, name, description, goal, level, weeks)
    values (auth.uid(), trim(p_data ->> 'name'), coalesce(p_data ->> 'description', ''),
            p_data ->> 'goal', p_data ->> 'level', coalesce((p_data ->> 'weeks')::smallint, 8))
    returning id into t_id;
  else
    update public.program_templates
    set name = trim(p_data ->> 'name'), description = coalesce(p_data ->> 'description', ''),
        goal = p_data ->> 'goal', level = p_data ->> 'level', weeks = coalesce((p_data ->> 'weeks')::smallint, weeks)
    where id = t_id;
    if not found then raise exception 'Program not found'; end if;
    delete from public.template_days where template_id = t_id;
  end if;

  for s in select * from jsonb_array_elements(p_data -> 'sessions') loop
    s_pos := s_pos + 1;
    if coalesce(trim(s ->> 'name'), '') = '' then raise exception 'Session % needs a name', s_pos; end if;
    if jsonb_array_length(coalesce(s -> 'exercises', '[]')) = 0 then
      raise exception '"%" needs at least one exercise', trim(s ->> 'name');
    end if;
    if exists (select 1 from jsonb_array_elements_text(coalesce(s -> 'weekdays', '[]')) w where w::smallint = any (used)) then
      raise exception 'Two sessions are scheduled on the same day';
    end if;
    used := used || array(select w::smallint from jsonb_array_elements_text(coalesce(s -> 'weekdays', '[]')) w);

    insert into public.template_days (template_id, position, name, focus, est_minutes, weekdays)
    values (t_id, s_pos, trim(s ->> 'name'), coalesce(s ->> 'focus', ''), nullif(s ->> 'est_minutes', '')::smallint,
            array(select w::smallint from jsonb_array_elements_text(coalesce(s -> 'weekdays', '[]')) w order by 1))
    returning id into d_id;

    e_pos := 0;
    for e in select * from jsonb_array_elements(s -> 'exercises') loop
      e_pos := e_pos + 1;
      insert into public.template_exercises (day_id, exercise_id, position, sets, reps, target_load_kg, rest_seconds, notes)
      values (d_id, (e ->> 'exercise_id')::uuid, e_pos, (e ->> 'sets')::smallint, coalesce(nullif(trim(e ->> 'reps'), ''), '10'),
              nullif(e ->> 'target_load_kg', '')::numeric, nullif(e ->> 'rest_seconds', '')::smallint, coalesce(e ->> 'notes', ''));
    end loop;
  end loop;

  return t_id;
end $$;

revoke execute on function public.save_program(uuid, jsonb) from public, anon;
grant execute on function public.save_program(uuid, jsonb) to authenticated;

-- Same as before, plus: Training must be shared, and weekdays go into the snapshot.
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
      'position', d.position, 'name', d.name, 'focus', d.focus, 'est_minutes', d.est_minutes, 'weekdays', to_jsonb(d.weekdays),
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

  if jsonb_array_length(snap -> 'days') = 0 then raise exception 'Add at least one session before assigning'; end if;

  foreach a in array p_athletes loop
    if a <> me and not public.coach_can_see(a, 'training') then
      raise exception 'Every athlete must be actively coached by you and sharing Training';
    end if;

    if p_start <= current_date then
      update public.assignments set status = 'replaced', end_date = p_start - 1
      where athlete_id = a and status = 'active';
    end if;
    -- a newer assignment replaces anything still waiting to start
    update public.assignments set status = 'cancelled' where athlete_id = a and status = 'scheduled';

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
