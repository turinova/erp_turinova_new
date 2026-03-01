-- Register Current Database as First Tenant
-- 
-- IMPORTANT: This migration MUST be run in the ADMIN DATABASE
-- It registers your current database as the first tenant
--
-- Prerequisites:
-- 1. Admin Database must be set up (run 20250131_create_admin_database_structure.sql)
-- 2. Current database must be set up (run 20250131_create_tenant_database_setup.sql)
-- 3. You need the connection details for your current database (tenant database)
--
-- After running this, you MUST manually update the tenant record with correct connection details

-- 1. Create first tenant (your current database)
-- NOTE: Replace the placeholder values with your actual current database connection details
INSERT INTO public.tenants (
  name,
  slug,
  supabase_project_id,
  supabase_url,
  supabase_anon_key,
  supabase_service_role_key,
  is_active,
  subscription_status,
  created_at
)
SELECT 
  'First Tenant', -- Change this to your tenant name
  'tenant-1', -- Change this to your desired slug
  'your-current-project-id', -- TODO: Replace with your current Supabase project ID
  'https://your-current-project.supabase.co', -- TODO: Replace with your current NEXT_PUBLIC_SUPABASE_URL
  'your-current-anon-key', -- TODO: Replace with your current NEXT_PUBLIC_SUPABASE_ANON_KEY
  'your-current-service-key', -- TODO: Replace with your current SUPABASE_SERVICE_ROLE_KEY
  true,
  'active',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenants WHERE slug = 'tenant-1'
);

-- 2. Get tenant ID for mapping users
DO $$
DECLARE
  first_tenant_id UUID;
BEGIN
  -- Get the tenant we just created
  SELECT id INTO first_tenant_id
  FROM public.tenants
  WHERE slug = 'tenant-1'
  LIMIT 1;

  IF first_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant not found. Please create the tenant first.';
  END IF;

  RAISE NOTICE 'Tenant ID: %', first_tenant_id;
  RAISE NOTICE 'IMPORTANT: You must now manually:';
  RAISE NOTICE '1. Update the tenant record with correct Supabase connection details';
  RAISE NOTICE '2. Map users from the tenant database to this tenant';
  RAISE NOTICE '3. Create a subscription for this tenant';
END $$;

-- 3. Add helper function to get tenant by user email
CREATE OR REPLACE FUNCTION public.get_tenant_by_user_email(user_email_param TEXT)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name VARCHAR,
  tenant_slug VARCHAR,
  supabase_url TEXT,
  supabase_anon_key TEXT,
  user_id_in_tenant_db UUID,
  user_role VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.slug,
    t.supabase_url,
    t.supabase_anon_key,
    tu.user_id_in_tenant_db,
    tu.role
  FROM public.tenants t
  INNER JOIN public.tenant_users tu ON tu.tenant_id = t.id
  WHERE tu.user_email = user_email_param
    AND t.is_active = true
    AND t.deleted_at IS NULL
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
