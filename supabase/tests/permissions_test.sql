-- ============================================================================
-- Permission tests: who can see and change what.
-- Run with:  npm run db:test   (needs a local Postgres; see supabase/tests/run.sh)
--
-- Cast:
--   Omar   (coach)            11111111-…
--   Hassan (Omar's athlete)   22222222-…
--   Laila  (another athlete)  33333333-…
--   Sam    (a stranger)       44444444-…
-- ============================================================================
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\o /dev/null

create schema test;
grant usage on schema test to authenticated;

create function test.ok(passed boolean, label text) returns void language plpgsql as $$
begin
  if passed is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'pass  %', label;
end $$;

-- Expect a statement to be refused (by a policy, a grant, or a check).
create function test.refused(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'pass  % (refused: %)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % (statement was allowed)', label;
end $$;

-- Expect a statement to run but change no rows (RLS hides the row).
create function test.no_rows(stmt text, label text) returns void language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: % (% rows changed)', label, n; end if;
  raise notice 'pass  %', label;
end $$;

create function test.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;

grant execute on all functions in schema test to authenticated;

-- ---------------------------------------------------------------------------
\echo '— Sign-up creates profiles'
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'omar@test.dev',   '{"full_name":"Omar Nabil"}'),
  ('22222222-2222-2222-2222-222222222222', 'hassan@test.dev', '{"full_name":"Hassan Tarek"}'),
  ('33333333-3333-3333-3333-333333333333', 'laila@test.dev',  '{"full_name":"Laila Hassan"}'),
  ('44444444-4444-4444-4444-444444444444', 'sam@test.dev',    '{}');
select test.ok((select count(*) from public.profiles) = 4, 'a profile row exists for each new user');
select test.ok((select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'Hassan Tarek', 'the name from sign-up is copied to the profile');

-- ---------------------------------------------------------------------------
\echo '— Strangers see nothing of each other'
select test.as_user('22222222-2222-2222-2222-222222222222'); set role authenticated;
select test.ok((select count(*) from public.profiles) = 1, 'an athlete sees only their own profile');
select test.refused($$ insert into public.invites (coach_id) values ('22222222-2222-2222-2222-222222222222') $$, 'a non-coach cannot create invites');
reset role;

-- ---------------------------------------------------------------------------
\echo '— Coach sets up and invites'
select test.as_user('11111111-1111-1111-1111-111111111111'); set role authenticated;
update public.profiles set is_coach = true, onboarded_at = now() where id = '11111111-1111-1111-1111-111111111111';
insert into public.coach_profiles (user_id, title, bio) values ('11111111-1111-1111-1111-111111111111', 'Strength coach', 'Ten years of coaching');
select test.refused($$ update public.coach_profiles set verified = true $$, 'a coach cannot mark themselves verified');
insert into public.invites (coach_id, code, package, suggested_scopes)
  values ('11111111-1111-1111-1111-111111111111', 'OMAR2026', 'Online Coaching', '{training,nutrition,progress,checkins}');
insert into public.invites (coach_id, code) values ('11111111-1111-1111-1111-111111111111', 'SPARE001');
select test.refused($$ select public.redeem_invite('OMAR2026', '{training}') $$, 'a coach cannot accept their own invite');
reset role;

-- ---------------------------------------------------------------------------
\echo '— Athlete accepts with the scopes they choose'
select test.as_user('44444444-4444-4444-4444-444444444444'); set role authenticated;
select test.ok((select count(*) from public.invites) = 0, 'athletes cannot list invite codes');
reset role;

select test.as_user('22222222-2222-2222-2222-222222222222'); set role authenticated;
select test.ok((select coach_name from public.preview_invite('omar2026')) = 'Omar Nabil', 'the invite preview shows the coach (code is case-insensitive)');
select test.ok(public.redeem_invite('OMAR2026', '{training,checkins}') is not null, 'the athlete accepts sharing only training and check-ins');
select test.refused($$ select public.redeem_invite('SPARE001', '{training}') $$, 'an athlete cannot take a second coach while one is current');
select test.ok((select count(*) from public.profiles) = 2, 'the athlete can now see their coach''s profile');
reset role;

select test.as_user('33333333-3333-3333-3333-333333333333'); set role authenticated;
select test.refused($$ select public.redeem_invite('OMAR2026', '{training}') $$, 'a used invite cannot be reused');
select test.ok((select count(*) from public.preview_invite('OMAR2026')) = 0, 'a used invite no longer previews');
reset role;

-- ---------------------------------------------------------------------------
\echo '— Athlete logs a week of data'
select test.as_user('22222222-2222-2222-2222-222222222222'); set role authenticated;
insert into public.workout_sessions (id, athlete_id, name, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Upper A', 'completed');
insert into public.set_logs (session_id, athlete_id, exercise_id, set_no, weight_kg, reps)
  select 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', id, 1, 105, 5
  from public.exercises where name = 'Bench Press';
insert into public.meals (id, athlete_id, meal_type) values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'lunch');
insert into public.meal_items (meal_id, athlete_id, name, grams, kcal, protein_g)
  values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Chicken breast, cooked', 200, 330, 62);
insert into public.measurements (athlete_id, weight_kg) values ('22222222-2222-2222-2222-222222222222', 92.0);
insert into public.progress_photos (athlete_id, storage_path) values ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/front.jpg');
insert into public.recovery_logs (athlete_id, sleep_hours, energy) values ('22222222-2222-2222-2222-222222222222', 7.5, 4);
insert into public.checkins (id, athlete_id, week_of, weight_kg, sleep, energy, notes)
  values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', date_trunc('week', current_date)::date, 92.0, 4, 4, 'Good week');
insert into public.pain_reports (athlete_id, area, note, shared_with_coach) values
  ('22222222-2222-2222-2222-222222222222', 'Left knee', 'Twinge on squats', true),
  ('22222222-2222-2222-2222-222222222222', 'Lower back', 'Private note', false);
insert into storage.objects (bucket_id, name) values ('progress-photos', '22222222-2222-2222-2222-222222222222/front.jpg');
select test.refused($$ insert into public.workout_sessions (athlete_id, name) values ('33333333-3333-3333-3333-333333333333', 'Fake') $$, 'an athlete cannot write into someone else''s log');
select test.refused($$ insert into storage.objects (bucket_id, name) values ('progress-photos', '33333333-3333-3333-3333-333333333333/x.jpg') $$, 'an athlete cannot upload into someone else''s photo folder');
reset role;

-- ---------------------------------------------------------------------------
\echo '— Coach sees exactly what was shared (training + check-ins)'
select test.as_user('11111111-1111-1111-1111-111111111111'); set role authenticated;
select test.ok((select count(*) from public.workout_sessions) = 1, 'coach sees workouts (training shared)');
select test.ok((select count(*) from public.set_logs) = 1, 'coach sees sets (training shared)');
select test.ok((select count(*) from public.checkins) = 1, 'coach sees the check-in (check-ins shared)');
select test.ok((select count(*) from public.meals) = 0 and (select count(*) from public.meal_items) = 0, 'coach does NOT see meals (nutrition not shared)');
select test.ok((select count(*) from public.measurements) = 0, 'coach does NOT see measurements (progress not shared)');
select test.ok((select count(*) from public.progress_photos) = 0, 'coach does NOT see photo records (photos not shared)');
select test.ok((select count(*) from storage.objects) = 0, 'coach cannot open the photo files either');
select test.ok((select count(*) from public.recovery_logs) = 0, 'coach does NOT see recovery (not shared)');
select test.ok((select count(*) from public.pain_reports) = 1, 'coach sees only the pain report marked as shared');
select test.refused($$ insert into public.workout_sessions (athlete_id, name) values ('22222222-2222-2222-2222-222222222222', 'Fake') $$, 'a coach cannot write workouts for the athlete');
select test.no_rows($$ update public.checkins set notes = 'edited by coach' $$, 'a coach cannot edit the athlete''s check-in');
select test.refused($$ update public.coaching_links set scopes = '{training,nutrition,progress,checkins,photos,recovery,reminders}' $$, 'a coach cannot widen the sharing scopes');
select test.refused($$ insert into public.nutrition_targets (athlete_id, set_by, kcal, protein_g, carbs_g, fat_g) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 2600, 180, 300, 70) $$, 'a coach cannot set nutrition targets without the nutrition scope');
reset role;

\echo '— Strangers and other athletes see none of it'
select test.as_user('44444444-4444-4444-4444-444444444444'); set role authenticated;
select test.ok((select count(*) from public.workout_sessions) + (select count(*) from public.checkins)
             + (select count(*) from public.pain_reports) + (select count(*) from public.coaching_links)
             + (select count(*) from storage.objects) = 0, 'a stranger sees no athlete data at all');
reset role;

-- ---------------------------------------------------------------------------
\echo '— Athlete changes sharing; it applies immediately'
select test.as_user('22222222-2222-2222-2222-222222222222'); set role authenticated;
update public.coaching_links set scopes = '{training,checkins,nutrition,photos}' where athlete_id = '22222222-2222-2222-2222-222222222222';
select test.refused($$ update public.coaching_links set checkin_weekday = 1 $$, 'the athlete cannot change the coach''s check-in day');
reset role;
select test.as_user('11111111-1111-1111-1111-111111111111'); set role authenticated;
select test.ok((select count(*) from public.meals) = 1 and (select count(*) from public.meal_items) = 1, 'coach now sees meals');
select test.ok((select count(*) from storage.objects) = 1, 'coach can now open the progress photo');
insert into public.nutrition_targets (athlete_id, set_by, kcal, protein_g, carbs_g, fat_g)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 2600, 180, 300, 70);
select test.ok(true, 'coach can set nutrition targets once nutrition is shared');
update public.coaching_links set checkin_weekday = 4 where coach_id = '11111111-1111-1111-1111-111111111111';
select test.ok(true, 'the coach can change the check-in day');
reset role;

select test.as_user('22222222-2222-2222-2222-222222222222'); set role authenticated;
update public.coaching_links set status = 'paused' where athlete_id = '22222222-2222-2222-2222-222222222222';
reset role;
select test.as_user('11111111-1111-1111-1111-111111111111'); set role authenticated;
select test.ok((select count(*) from public.workout_sessions) = 0 and (select count(*) from public.meals) = 0, 'paused: coach sees no athlete data');
insert into public.messages (link_id, sender_id, body)
  select id, '11111111-1111-1111-1111-111111111111', 'Rest up, see you next week' from public.coaching_links;
select test.ok(true, 'paused: messaging still works');
reset role;
select test.as_user('22222222-2222-2222-2222-222222222222'); set role authenticated;
update public.coaching_links set status = 'active' where athlete_id = '22222222-2222-2222-2222-222222222222';
select test.ok((select count(*) from public.messages) = 1, 'the athlete reads the coach''s message');
reset role;
select id as link_id from public.coaching_links where athlete_id = '22222222-2222-2222-2222-222222222222' \gset
select test.as_user('44444444-4444-4444-4444-444444444444'); set role authenticated;
select test.ok((select count(*) from public.messages) = 0, 'a stranger cannot read the conversation');
select test.refused(format($$ insert into public.messages (link_id, sender_id, body) values (%L, '44444444-4444-4444-4444-444444444444', 'hi') $$, :'link_id'), 'a stranger cannot post into a conversation');
reset role;

-- ---------------------------------------------------------------------------
\echo '— Check-in review'
select test.as_user('11111111-1111-1111-1111-111111111111'); set role authenticated;
select public.review_checkin('cccccccc-0000-0000-0000-000000000001', 'Great week, add 2.5 kg to squats');
select test.ok((select status from public.checkins where id = 'cccccccc-0000-0000-0000-000000000001') = 'reviewed', 'the coach marks the check-in reviewed');
select public.acknowledge_pain_report(id) from public.pain_reports where shared_with_coach;
select test.ok((select status from public.pain_reports where shared_with_coach) = 'acknowledged', 'the coach acknowledges the shared pain report');
reset role;
select test.as_user('22222222-2222-2222-2222-222222222222'); set role authenticated;
select test.ok((select count(*) from public.feedback where target_type = 'checkin') = 1, 'the athlete sees the coach''s feedback');
select test.no_rows($$ update public.checkins set notes = 'changed after review' $$, 'the athlete cannot edit a reviewed check-in');
reset role;

-- ---------------------------------------------------------------------------
\echo '— Programs and assignments'
select test.as_user('11111111-1111-1111-1111-111111111111'); set role authenticated;
insert into public.exercises (name, muscle_group, owner_id) values ('Omar''s Pause Squat', 'Legs', '11111111-1111-1111-1111-111111111111');
insert into public.program_templates (id, owner_id, name, weeks) values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Upper / Lower Strength', 12);
insert into public.template_days (id, template_id, position, name, focus) values ('dddddddd-0000-0000-0000-0000000000d1', 'dddddddd-0000-0000-0000-000000000001', 1, 'Upper A', 'Chest, back, shoulders');
insert into public.template_exercises (day_id, exercise_id, position, sets, reps, target_load_kg)
  select 'dddddddd-0000-0000-0000-0000000000d1', id, 1, 5, '5', 105 from public.exercises where name = 'Bench Press';
insert into public.template_exercises (day_id, exercise_id, position, sets, reps)
  select 'dddddddd-0000-0000-0000-0000000000d1', id, 2, 3, '6' from public.exercises where name = 'Omar''s Pause Squat';
select test.ok((select count(*) from public.assign_program('dddddddd-0000-0000-0000-000000000001', '{22222222-2222-2222-2222-222222222222}', current_date)) = 1, 'the coach assigns the program to their athlete');
select test.refused($$ select public.assign_program('dddddddd-0000-0000-0000-000000000001', '{33333333-3333-3333-3333-333333333333}', current_date) $$, 'the coach cannot assign to someone they do not coach');
update public.template_exercises set sets = 9 where position = 1;
reset role;
select test.as_user('33333333-3333-3333-3333-333333333333'); set role authenticated;
select test.ok((select count(*) from public.program_templates) = 0, 'other users cannot see the coach''s templates');
select test.ok((select count(*) from public.exercises where owner_id is not null) = 0, 'other users cannot see the coach''s custom exercises');
reset role;
select test.as_user('22222222-2222-2222-2222-222222222222'); set role authenticated;
select test.ok((select status from public.assignments) = 'active', 'the athlete has the program as active');
select test.ok((select snapshot #>> '{days,0,exercises,0,sets}' from public.assignments) = '5', 'later template edits do not change the athlete''s copy');
select test.ok((select count(*) from public.exercises where name = 'Omar''s Pause Squat') = 1, 'the athlete can see their coach''s custom exercise');
select test.ok((select count(*) from public.program_templates) = 0, 'the athlete cannot open the coach''s template itself');
reset role;

-- ---------------------------------------------------------------------------
\echo '— Ending coaching'
select test.as_user('11111111-1111-1111-1111-111111111111'); set role authenticated;
update public.coaching_links set status = 'ended' where coach_id = '11111111-1111-1111-1111-111111111111';
select test.ok((select count(*) from public.workout_sessions) + (select count(*) from public.messages)
             + (select count(*) from public.assignments) + (select count(*) from public.feedback) = 0, 'after ending, the coach loses access to everything');
select test.ok((select count(*) from public.profiles) = 1, 'after ending, the coach no longer sees the athlete''s profile');
select test.refused($$ update public.coaching_links set status = 'active' $$, 'an ended link cannot be re-opened');
reset role;
select test.as_user('22222222-2222-2222-2222-222222222222'); set role authenticated;
select test.ok((select count(*) from public.workout_sessions) = 1 and (select count(*) from public.assignments) = 1, 'the athlete keeps all their history');
select test.ok((select count(*) from public.redeem_invite('SPARE001', '{training}')) = 1, 'the athlete can join a coach again after ending');
reset role;

\echo ''
\echo 'All permission tests passed.'
