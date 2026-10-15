-- ============================================================================
-- Tighten who can call the SECURITY DEFINER functions (from Supabase's security advisor).
--   - Nobody signed out can call any of them.
--   - The sign-up trigger is never callable through the API.
--   - Permission helpers stay callable by signed-in users: the policies need that,
--     and each one only answers a yes/no question about the caller's own links.
-- ============================================================================

revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.coach_can_see(uuid, public.share_scope) from public, anon;
revoke execute on function public.is_current_coach_of(uuid) from public, anon;
revoke execute on function public.is_active_coach_of(uuid) from public, anon;
revoke execute on function public.was_coached_by(uuid) from public, anon;
revoke execute on function public.in_open_link(uuid) from public, anon;
revoke execute on function public.owns_template(uuid) from public, anon;
revoke execute on function public.owns_template_day(uuid) from public, anon;

grant execute on function public.coach_can_see(uuid, public.share_scope) to authenticated;
grant execute on function public.is_current_coach_of(uuid) to authenticated;
grant execute on function public.is_active_coach_of(uuid) to authenticated;
grant execute on function public.was_coached_by(uuid) to authenticated;
grant execute on function public.in_open_link(uuid) to authenticated;
grant execute on function public.owns_template(uuid) to authenticated;
grant execute on function public.owns_template_day(uuid) to authenticated;
