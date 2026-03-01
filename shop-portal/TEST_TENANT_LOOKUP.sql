-- Test the tenant lookup RPC function
-- Run this in your ADMIN DATABASE to verify it works

-- Test with one of your user emails
SELECT * FROM public.get_tenant_by_user_email('admin@turinova.hu');

-- Test with another user
SELECT * FROM public.get_tenant_by_user_email('mezo.david@baugeneral.hu');

-- Test with third user
SELECT * FROM public.get_tenant_by_user_email('veres.istvan@hirosablak.hu');

-- Also check the tenant_users table directly
SELECT 
  tu.user_email,
  tu.user_id_in_tenant_db,
  tu.role,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.supabase_url,
  t.is_active
FROM public.tenant_users tu
JOIN public.tenants t ON t.id = tu.tenant_id
WHERE tu.user_email IN (
  'admin@turinova.hu',
  'mezo.david@baugeneral.hu',
  'veres.istvan@hirosablak.hu'
);
