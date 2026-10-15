-- ============================================================================
-- File storage. Every file lives under a folder named after its owner's id:
--   progress-photos/<athlete_id>/<file>   private, coach needs the photos scope
--   meal-photos/<athlete_id>/<file>       private, coach needs the nutrition scope
--   chat-images/<link_id>/<file>          private, people in that coaching link
--   avatars/<user_id>/<file>              readable by any signed-in user
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false),
       ('meal-photos', 'meal-photos', false),
       ('chat-images', 'chat-images', false),
       ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- The first folder of a path as a uuid (null if it is not one).
create or replace function public.path_owner(p_name text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return ((storage.foldername(p_name))[1])::uuid;
exception when others then
  return null;
end $$;

-- Owners manage their own files in the athlete-owned buckets.
create policy "storage: owners manage own files" on storage.objects
  for all to authenticated
  using (bucket_id in ('progress-photos', 'meal-photos', 'avatars') and public.path_owner(name) = (select auth.uid()))
  with check (bucket_id in ('progress-photos', 'meal-photos', 'avatars') and public.path_owner(name) = (select auth.uid()));

create policy "storage: coach reads shared progress photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and public.coach_can_see(public.path_owner(name), 'photos'));

create policy "storage: coach reads shared meal photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'meal-photos' and public.coach_can_see(public.path_owner(name), 'nutrition'));

create policy "storage: anyone signed in reads avatars" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

create policy "storage: chat images for people in the link" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images' and public.in_open_link(public.path_owner(name)));
create policy "storage: send chat images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images' and public.in_open_link(public.path_owner(name)));
