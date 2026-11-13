-- Allow each authenticated user to read only their own admin membership row.
-- This lets the admin Edge Function verify the caller without relying on a service-role lookup.
create policy admin_users_select_own on public.admin_users
for select to authenticated using (auth.uid() = user_id);
grant select on public.admin_users to authenticated;
