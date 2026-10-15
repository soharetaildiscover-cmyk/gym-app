-- ============================================================================
-- Core: profiles, coach profiles, invites, coaching links, permission helpers
--
-- The rule this whole schema is built around:
--   An athlete owns their data. A coach reads it only through an ACTIVE
--   coaching link whose matching sharing scope is switched on.
--   That rule lives in coach_can_see(), and every athlete-data policy uses it.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.share_scope as enum (
  'training',   -- workouts, sets, notes
  'nutrition',  -- meals, water, targets
  'progress',   -- weight, measurements
  'checkins',   -- weekly check-in answers
  'photos',     -- progress photos
  'recovery',   -- sleep, energy, soreness, readiness
  'reminders'   -- whether reminders were taken
);

create type public.link_status as enum ('active', 'paused', 'ended');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null default '' check (char_length(full_name) <= 80),
  avatar_path     text,
  unit_system     text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  goal            text check (goal in ('build_muscle', 'lose_fat', 'get_stronger', 'general_fitness', 'performance')),
  experience      text check (experience in ('beginner', 'intermediate', 'advanced')),
  training_days   smallint check (training_days between 1 and 7),
  height_cm       numeric(5, 1) check (height_cm between 80 and 260),
  is_coach        boolean not null default false,
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create the profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Coach profiles (public storefront for a coach)
-- ---------------------------------------------------------------------------
create table public.coach_profiles (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  title        text not null default '' check (char_length(title) <= 80),
  bio          text not null default '' check (char_length(bio) <= 1000),
  specialties  text[] not null default '{}',
  verified     boolean not null default false,  -- set by us (admin), never by the coach
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger coach_profiles_touch before update on public.coach_profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Coaching links (coach <-> athlete). Created only through redeem_invite().
-- ---------------------------------------------------------------------------
create table public.coaching_links (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null references public.profiles (id) on delete cascade,
  athlete_id       uuid not null references public.profiles (id) on delete cascade,
  status           public.link_status not null default 'active',
  package          text,
  scopes           public.share_scope[] not null default '{}',
  checkin_weekday  smallint not null default 5 check (checkin_weekday between 0 and 6), -- 0 = Sunday, 5 = Friday
  started_at       timestamptz not null default now(),
  paused_at        timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (coach_id <> athlete_id)
);
-- v1: an athlete has at most one current (active or paused) coach.
create unique index coaching_links_one_current_coach
  on public.coaching_links (athlete_id) where status in ('active', 'paused');
create index coaching_links_coach on public.coaching_links (coach_id, status);
create trigger coaching_links_touch before update on public.coaching_links
  for each row execute function public.touch_updated_at();

-- Who may change what on a link:
--   athlete: scopes, pause / resume, end
--   coach:   end only
--   nobody:  re-open an ended link, or change who is on it
create or replace function public.guard_link_update()
returns trigger language plpgsql set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return new; -- service role / admin
  end if;
  if new.coach_id <> old.coach_id or new.athlete_id <> old.athlete_id
     or new.started_at <> old.started_at or new.created_at <> old.created_at
     or new.package is distinct from old.package then
    raise exception 'These link fields cannot be changed';
  end if;
  if old.status = 'ended' then
    raise exception 'An ended coaching link cannot be changed';
  end if;
  if me = old.coach_id then
    if new.scopes <> old.scopes or (new.status <> old.status and new.status <> 'ended') then
      raise exception 'A coach can only end a coaching link or change the check-in day';
    end if;
  elsif me = old.athlete_id then
    if new.checkin_weekday <> old.checkin_weekday then
      raise exception 'The check-in day is set by the coach';
    end if;
  end if;
  if new.status = 'paused' and old.status <> 'paused' then new.paused_at := now(); end if;
  if new.status = 'active' then new.paused_at := null; end if;
  if new.status = 'ended' then new.ended_at := now(); end if;
  return new;
end $$;

create trigger coaching_links_guard before update on public.coaching_links
  for each row execute function public.guard_link_update();

-- ---------------------------------------------------------------------------
-- Invites (coach -> athlete). Redeemed only through redeem_invite().
-- ---------------------------------------------------------------------------
create table public.invites (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  coach_id          uuid not null references public.profiles (id) on delete cascade,
  package           text,
  suggested_scopes  public.share_scope[] not null default '{training}',
  expires_at        timestamptz not null default now() + interval '14 days',
  used_by           uuid references public.profiles (id) on delete set null,
  used_at           timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz not null default now()
);
create index invites_coach on public.invites (coach_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Permission helpers. SECURITY DEFINER so policies can call them without
-- recursing through coaching_links' own policies.
-- ---------------------------------------------------------------------------

-- The one rule: is the current user an ACTIVE coach of this athlete with this scope on?
create or replace function public.coach_can_see(p_athlete uuid, p_scope public.share_scope)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coaching_links l
    where l.athlete_id = p_athlete
      and l.coach_id = auth.uid()
      and l.status = 'active'
      and p_scope = any (l.scopes)
  );
$$;

-- Is the current user this athlete's coach right now (active or paused)?
-- Used for things that are not athlete data: names, messages, assignments.
create or replace function public.is_current_coach_of(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coaching_links l
    where l.athlete_id = p_athlete and l.coach_id = auth.uid() and l.status in ('active', 'paused')
  );
$$;

-- Is the current user an ACTIVE coach of this athlete (any scope)?
create or replace function public.is_active_coach_of(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coaching_links l
    where l.athlete_id = p_athlete and l.coach_id = auth.uid() and l.status = 'active'
  );
$$;

-- Has the current user ever been coached by this person? (to read a coach's
-- custom exercises and profile that appear in your history)
create or replace function public.was_coached_by(p_coach uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coaching_links l
    where l.coach_id = p_coach and l.athlete_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Invite flow (functions, so athletes never read the invites table directly)
-- ---------------------------------------------------------------------------

-- What the athlete sees before accepting.
create or replace function public.preview_invite(p_code text)
returns table (coach_id uuid, coach_name text, coach_title text, package text, suggested_scopes public.share_scope[])
language sql stable security definer set search_path = public as $$
  select i.coach_id, p.full_name, coalesce(c.title, ''), i.package, i.suggested_scopes
  from public.invites i
  join public.profiles p on p.id = i.coach_id
  left join public.coach_profiles c on c.user_id = i.coach_id
  where i.code = upper(trim(p_code))
    and i.used_at is null and i.revoked_at is null and i.expires_at > now();
$$;

-- Accept an invite with the scopes the athlete chose. Returns the new link id.
create or replace function public.redeem_invite(p_code text, p_scopes public.share_scope[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me  uuid := auth.uid();
  inv public.invites;
  link_id uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;

  select * into inv from public.invites
  where code = upper(trim(p_code)) for update;

  if not found then raise exception 'Invite code not found'; end if;
  if inv.revoked_at is not null then raise exception 'This invite was cancelled by the coach'; end if;
  if inv.used_at is not null then raise exception 'This invite has already been used'; end if;
  if inv.expires_at <= now() then raise exception 'This invite has expired'; end if;
  if inv.coach_id = me then raise exception 'You cannot accept your own invite'; end if;
  if exists (select 1 from public.coaching_links
             where athlete_id = me and status in ('active', 'paused')) then
    raise exception 'You already have a coach. End that coaching first.';
  end if;

  insert into public.coaching_links (coach_id, athlete_id, package, scopes)
  values (inv.coach_id, me, inv.package, coalesce(p_scopes, '{}'))
  returning id into link_id;

  update public.invites set used_by = me, used_at = now() where id = inv.id;
  return link_id;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.coaching_links enable row level security;
alter table public.invites        enable row level security;

-- profiles: yourself, plus the people you are linked with (any status but ended
-- for coaches; athletes can always see the coaches in their history).
create policy "profiles: read self and linked people" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or public.is_current_coach_of(id)
    or public.was_coached_by(id)
  );
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- coach_profiles: public to signed-in users; the coach edits their own, never 'verified'.
create policy "coach_profiles: read all" on public.coach_profiles
  for select to authenticated using (true);
create policy "coach_profiles: insert own" on public.coach_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "coach_profiles: update own" on public.coach_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update on public.coach_profiles from authenticated;
grant insert (user_id, title, bio, specialties) on public.coach_profiles to authenticated;
grant update (title, bio, specialties) on public.coach_profiles to authenticated;

-- coaching_links: both people read it; both can update (the guard trigger limits what).
create policy "links: read own" on public.coaching_links
  for select to authenticated using ((select auth.uid()) in (coach_id, athlete_id));
create policy "links: update own" on public.coaching_links
  for update to authenticated
  using ((select auth.uid()) in (coach_id, athlete_id))
  with check ((select auth.uid()) in (coach_id, athlete_id));
revoke insert, delete on public.coaching_links from authenticated;

-- invites: the coach manages their own. Athletes go through the functions above.
create policy "invites: coach reads own" on public.invites
  for select to authenticated using (coach_id = (select auth.uid()));
create policy "invites: coach creates own" on public.invites
  for insert to authenticated with check (
    coach_id = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and is_coach)
  );
create policy "invites: coach revokes own" on public.invites
  for update to authenticated using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));
revoke update on public.invites from authenticated;
grant update (revoked_at) on public.invites to authenticated;

revoke execute on function public.redeem_invite(text, public.share_scope[]) from public, anon;
revoke execute on function public.preview_invite(text) from public, anon;
grant execute on function public.redeem_invite(text, public.share_scope[]) to authenticated;
grant execute on function public.preview_invite(text) to authenticated;
