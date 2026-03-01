-- Map Users to Tenant
-- 
-- IMPORTANT: This script helps you map users from your tenant database to the tenant
-- Run this AFTER you've:
-- 1. Created the admin database
-- 2. Registered your tenant database
-- 3. Have the tenant_id from the tenant registration
--
-- This script should be run in the ADMIN DATABASE
-- You'll need to manually provide the user emails and IDs from your tenant database

-- Example: Map users to tenant
-- Replace 'tenant-1' with your actual tenant slug
-- Replace the user emails and IDs with actual values from your tenant database

-- Option 1: Manual mapping (recommended for first setup)
-- Uncomment and fill in the values:

/*
INSERT INTO public.tenant_users (
  tenant_id,
  user_email,
  user_id_in_tenant_db,
  role,
  created_at
)
SELECT 
  (SELECT id FROM public.tenants WHERE slug = 'tenant-1'),
  'user@example.com', -- Replace with actual user email from tenant database
  'user-uuid-from-tenant-db', -- Replace with actual user ID from tenant database auth.users
  'user', -- or 'owner', 'admin'
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_users 
  WHERE user_email = 'user@example.com'
    AND tenant_id = (SELECT id FROM public.tenants WHERE slug = 'tenant-1')
);
*/

-- Option 2: Bulk mapping script (if you have many users)
-- This requires connecting to the tenant database to fetch users
-- For now, use Option 1 and map users manually

-- Helper query to check mapped users:
-- SELECT 
--   tu.user_email,
--   tu.role,
--   t.name as tenant_name,
--   t.slug as tenant_slug
-- FROM public.tenant_users tu
-- JOIN public.tenants t ON t.id = tu.tenant_id
-- WHERE t.slug = 'tenant-1';
