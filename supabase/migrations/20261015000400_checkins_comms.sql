-- ============================================================================
-- Check-ins, feedback, recovery, pain reports, reminders, messages, push
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Weekly check-ins. "Due" and "missed" are worked out from the link's check-in
-- day; a row exists only once the athlete submits.
-- ---------------------------------------------------------------------------
create table public.checkins (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.profiles (id) on delete cascade,
  link_id       uuid references public.coaching_links (id) on delete set null,
  week_of       date not null,   -- Monday of the week
  status        text not null default 'submitted' check (status in ('submitted', 'reviewed')),
  weight_kg     numeric(5, 2) check (weight_kg between 20 and 400),
  sleep         smallint check (sleep between 1 and 5),
  hunger        smallint check (hunger between 1 and 5),
  energy        smallint check (energy between 1 and 5),
  stress        smallint check (stress between 1 and 5),
  performance   smallint check (performance between 1 and 5),
  notes         text not null default '',
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  unique (athlete_id, week_of),
  check (extract(isodow from week_of) = 1)
);
create index checkins_link on public.checkins (link_id, week_of desc);

alter table public.progress_photos
  add constraint progress_photos_checkin_fk foreign key (checkin_id) references public.checkins (id) on delete set null;

-- Coach feedback on a check-in, a workout, a meal, or in general.
create table public.feedback (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.profiles (id) on delete cascade,
  athlete_id   uuid not null references public.profiles (id) on delete cascade,
  target_type  text not null default 'general' check (target_type in ('checkin', 'session', 'meal', 'general')),
  target_id    uuid,
  body         text not null check (char_length(body) between 1 and 4000),
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index feedback_athlete on public.feedback (athlete_id, created_at desc);

-- Review a check-in: marks it reviewed and stores the coach's feedback, in one step.
create or replace function public.review_checkin(p_checkin uuid, p_feedback text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.checkins;
  fid uuid;
begin
  select * into c from public.checkins where id = p_checkin for update;
  if not found or not public.coach_can_see(c.athlete_id, 'checkins') then
    raise exception 'Check-in not found';
  end if;
  update public.checkins set status = 'reviewed', reviewed_at = now(), reviewed_by = auth.uid()
  where id = c.id;
  if coalesce(trim(p_feedback), '') <> '' then
    insert into public.feedback (coach_id, athlete_id, target_type, target_id, body)
    values (auth.uid(), c.athlete_id, 'checkin', c.id, trim(p_feedback))
    returning id into fid;
  end if;
  return fid;
end $$;

-- ---------------------------------------------------------------------------
-- Recovery
-- ---------------------------------------------------------------------------
create table public.recovery_logs (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.profiles (id) on delete cascade,
  logged_on    date not null default current_date,
  sleep_hours  numeric(3, 1) check (sleep_hours between 0 and 24),
  energy       smallint check (energy between 1 and 5),
  soreness     smallint check (soreness between 1 and 5),
  readiness    smallint check (readiness between 1 and 5),
  source       text not null default 'manual' check (source in ('manual', 'health')),
  created_at   timestamptz not null default now()
);
create index recovery_logs_athlete on public.recovery_logs (athlete_id, logged_on desc);

-- ---------------------------------------------------------------------------
-- Pain reports. Each report is shared with the coach only if the athlete says so.
-- ---------------------------------------------------------------------------
create table public.pain_reports (
  id                 uuid primary key default gen_random_uuid(),
  athlete_id         uuid not null references public.profiles (id) on delete cascade,
  area               text not null default '',
  note               text not null check (char_length(note) between 1 and 2000),
  shared_with_coach  boolean not null default false,
  status             text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  acknowledged_at    timestamptz,
  created_at         timestamptz not null default now()
);
create index pain_reports_athlete on public.pain_reports (athlete_id, created_at desc);

create or replace function public.acknowledge_pain_report(p_report uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.pain_reports set status = 'acknowledged', acknowledged_at = now()
  where id = p_report and status = 'open' and shared_with_coach
    and public.is_active_coach_of(athlete_id);
  if not found then raise exception 'Report not found'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reminders
-- ---------------------------------------------------------------------------
create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles (id) on delete cascade,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  kind        text not null default 'other' check (kind in ('supplement', 'water', 'sleep', 'meal', 'other')),
  times       time[] not null default '{}',
  weekdays    smallint[] not null default '{0,1,2,3,4,5,6}',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (id, athlete_id)
);

create table public.reminder_logs (
  id           uuid primary key default gen_random_uuid(),
  reminder_id  uuid not null,
  athlete_id   uuid not null,
  logged_for   date not null default current_date,
  taken        boolean not null default true,
  logged_at    timestamptz not null default now(),
  unique (reminder_id, logged_for),
  foreign key (reminder_id, athlete_id) references public.reminders (id, athlete_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Messages: one thread per coaching link, open while the link is active or paused.
-- ---------------------------------------------------------------------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  link_id     uuid not null references public.coaching_links (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  body        text check (char_length(body) <= 4000),
  image_path  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  check (body is not null or image_path is not null)
);
create index messages_link on public.messages (link_id, created_at desc);

create or replace function public.in_open_link(p_link uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coaching_links l
    where l.id = p_link and auth.uid() in (l.coach_id, l.athlete_id) and l.status in ('active', 'paused')
  );
$$;

create or replace function public.mark_thread_read(p_link uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.in_open_link(p_link) then raise exception 'Conversation not found'; end if;
  update public.messages set read_at = now()
  where link_id = p_link and sender_id <> auth.uid() and read_at is null;
end $$;

-- ---------------------------------------------------------------------------
-- Push tokens and in-app notifications
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  token       text not null unique,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now()
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,   -- 'assignment', 'checkin_due', 'checkin_reviewed', 'message', 'pain_report', ...
  title       text not null,
  body        text not null default '',
  data        jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.checkins       enable row level security;
alter table public.feedback       enable row level security;
alter table public.recovery_logs  enable row level security;
alter table public.pain_reports   enable row level security;
alter table public.reminders      enable row level security;
alter table public.reminder_logs  enable row level security;
alter table public.messages       enable row level security;
alter table public.push_tokens    enable row level security;
alter table public.notifications  enable row level security;

-- check-ins: the athlete submits and can edit until it is reviewed.
create policy "checkins: athlete reads own" on public.checkins
  for select to authenticated using (athlete_id = (select auth.uid()));
create policy "checkins: athlete submits" on public.checkins
  for insert to authenticated with check (athlete_id = (select auth.uid()) and status = 'submitted');
create policy "checkins: athlete edits before review" on public.checkins
  for update to authenticated
  using (athlete_id = (select auth.uid()) and status = 'submitted')
  with check (athlete_id = (select auth.uid()) and status = 'submitted');
create policy "checkins: coach reads with checkins scope" on public.checkins
  for select to authenticated using (public.coach_can_see(athlete_id, 'checkins'));
revoke delete on public.checkins from authenticated;

-- feedback: written by an active coach, read by the athlete (who marks it read).
create policy "feedback: athlete reads own" on public.feedback
  for select to authenticated using (athlete_id = (select auth.uid()));
create policy "feedback: coach reads own while coaching" on public.feedback
  for select to authenticated using (coach_id = (select auth.uid()) and public.is_current_coach_of(athlete_id));
create policy "feedback: active coach writes" on public.feedback
  for insert to authenticated with check (coach_id = (select auth.uid()) and public.is_active_coach_of(athlete_id));
create policy "feedback: athlete marks read" on public.feedback
  for update to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
revoke update on public.feedback from authenticated;
grant update (read_at) on public.feedback to authenticated;

create policy "recovery: athlete owns" on public.recovery_logs
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "recovery: coach reads with recovery scope" on public.recovery_logs
  for select to authenticated using (public.coach_can_see(athlete_id, 'recovery'));

create policy "pain: athlete owns" on public.pain_reports
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "pain: active coach reads shared reports" on public.pain_reports
  for select to authenticated using (shared_with_coach and public.is_active_coach_of(athlete_id));

-- reminders: the athlete owns them (and can switch off one the coach made);
-- the active coach can add and edit the ones they created.
create policy "reminders: athlete owns" on public.reminders
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "reminders: coach reads own" on public.reminders
  for select to authenticated using (created_by = (select auth.uid()) and public.is_current_coach_of(athlete_id));
create policy "reminders: active coach adds" on public.reminders
  for insert to authenticated with check (created_by = (select auth.uid()) and public.is_active_coach_of(athlete_id));
create policy "reminders: active coach edits own" on public.reminders
  for update to authenticated
  using (created_by = (select auth.uid()) and public.is_active_coach_of(athlete_id))
  with check (created_by = (select auth.uid()) and public.is_active_coach_of(athlete_id));

create policy "reminder logs: athlete owns" on public.reminder_logs
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "reminder logs: coach reads with reminders scope" on public.reminder_logs
  for select to authenticated using (public.coach_can_see(athlete_id, 'reminders'));

create policy "messages: people in the link read" on public.messages
  for select to authenticated using (public.in_open_link(link_id));
create policy "messages: people in the link send" on public.messages
  for insert to authenticated with check (sender_id = (select auth.uid()) and public.in_open_link(link_id));
revoke update, delete on public.messages from authenticated;

create policy "push tokens: own" on public.push_tokens
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: mark own read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke execute on function public.review_checkin(uuid, text) from public, anon;
revoke execute on function public.acknowledge_pain_report(uuid) from public, anon;
revoke execute on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.review_checkin(uuid, text) to authenticated;
grant execute on function public.acknowledge_pain_report(uuid) to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;
