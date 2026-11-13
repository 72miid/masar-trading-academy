-- The admin Edge Function uses the service_role client for subscription lifecycle operations.
-- Keep browser roles read-only; grant only the server role the required table privileges.
grant select, insert, update, delete on table public.subscriptions to service_role;
