-- MASAR PRO identity and subscription foundation
-- Run in Supabase SQL Editor. Review policies before production use.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profile_insert_own" on public.profiles;
-- Profile creation is handled only by the auth trigger; client inserts are not granted.
drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name',''))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_masar on auth.users;
create trigger on_auth_user_created_masar after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_customer_id text,
  provider_subscription_id text not null unique,
  status text not null check (status in ('trialing','active','past_due','canceled','incomplete','expired')),
  price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id,status);
alter table public.subscriptions enable row level security;
drop policy if exists "subscription_select_own" on public.subscriptions;
create policy "subscription_select_own" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
-- Intentionally no INSERT/UPDATE/DELETE policy for clients. Only trusted server code may mutate subscriptions.

create table if not exists public.payment_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Restrict profile fields users can mutate; never expose subscription writes to browser clients.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;


create table if not exists public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
