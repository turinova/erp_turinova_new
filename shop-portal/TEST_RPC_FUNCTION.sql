-- Test the RPC function in your ADMIN DATABASE
-- Run this in your Admin Database SQL Editor (ievpajfptwlozpafvjdt.supabase.co)

-- Test 1: Check if function exists
SELECT 
  routine_name, 
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'get_tenant_by_user_email';

-- Test 2: Try calling the function
SELECT * FROM public.get_tenant_by_user_email('admin@turinova.hu');

-- Test 3: Direct query to verify data exists
SELECT 
  tu.user_email,
  tu.role,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.is_active
FROM public.tenant_users tu
JOIN public.tenants t ON t.id = tu.tenant_id
WHERE tu.user_email = 'admin@turinova.hu';
