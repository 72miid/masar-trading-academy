-- The access-check and protected-content Edge Functions verify administrator membership using service_role.
-- Grant read-only access so administrators are recognized consistently across server-side gates.
grant select on table public.admin_users to service_role;
