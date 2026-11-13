-- Keep auth.uid() evaluation out of per-row expressions for better RLS performance.
drop policy if exists profile_select_own on public.profiles;
create policy profile_select_own on public.profiles
for select to authenticated using ((select auth.uid()) = id);

drop policy if exists profile_update_own on public.profiles;
create policy profile_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists subscription_select_own on public.subscriptions;
create policy subscription_select_own on public.subscriptions
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists admin_users_select_own on public.admin_users;
create policy admin_users_select_own on public.admin_users
for select to authenticated using ((select auth.uid()) = user_id);
