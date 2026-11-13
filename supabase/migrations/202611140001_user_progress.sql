create table public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_progress_is_object check (jsonb_typeof(progress) = 'object'),
  constraint user_progress_size_limit check (pg_column_size(progress) <= 1048576)
);

alter table public.user_progress enable row level security;

revoke all on table public.user_progress from public, anon, authenticated;
grant select, insert, update on table public.user_progress to authenticated;
grant all on table public.user_progress to service_role;

create policy user_progress_select_own
  on public.user_progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_progress_insert_own
  on public.user_progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_progress_update_own
  on public.user_progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.set_user_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_progress_set_updated_at
before update on public.user_progress
for each row execute function public.set_user_progress_updated_at();

notify pgrst, 'reload schema';
