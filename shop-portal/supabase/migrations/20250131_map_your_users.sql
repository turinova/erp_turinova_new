-- Map Users to Tenant
-- Run this in your ADMIN DATABASE
-- This maps your existing users to tenant-1

-- User 1: admin@turinova.hu (set as owner)
INSERT INTO public.tenant_users (
  tenant_id,
  user_email,
  user_id_in_tenant_db,
  role,
  created_at
)
VALUES (
  (SELECT id FROM public.tenants WHERE slug = 'tenant-1'),
  'admin@turinova.hu',
  'a500ff04-ebe4-4169-9554-dc043ab7f9a6',
  'owner',
  '2026-02-18 07:33:39.126372+00'::timestamp with time zone
)
ON CONFLICT (tenant_id, user_email) DO UPDATE
SET 
  user_id_in_tenant_db = EXCLUDED.user_id_in_tenant_db,
  role = EXCLUDED.role;

-- User 2: mezo.david@baugeneral.hu
INSERT INTO public.tenant_users (
  tenant_id,
  user_email,
  user_id_in_tenant_db,
  role,
  created_at
)
VALUES (
  (SELECT id FROM public.tenants WHERE slug = 'tenant-1'),
  'mezo.david@baugeneral.hu',
  '2685780e-417d-49d0-942b-53e84a3fe289',
  'user',
  '2026-02-18 09:53:23.015569+00'::timestamp with time zone
)
ON CONFLICT (tenant_id, user_email) DO UPDATE
SET 
  user_id_in_tenant_db = EXCLUDED.user_id_in_tenant_db,
  role = EXCLUDED.role;

-- User 3: veres.istvan@hirosablak.hu
INSERT INTO public.tenant_users (
  tenant_id,
  user_email,
  user_id_in_tenant_db,
  role,
  created_at
)
VALUES (
  (SELECT id FROM public.tenants WHERE slug = 'tenant-1'),
  'veres.istvan@hirosablak.hu',
  '21087272-b67f-463f-9f26-fb4de05a4e96',
  'user',
  '2026-02-19 13:11:48.983651+00'::timestamp with time zone
)
ON CONFLICT (tenant_id, user_email) DO UPDATE
SET 
  user_id_in_tenant_db = EXCLUDED.user_id_in_tenant_db,
  role = EXCLUDED.role;

-- Verify the users were mapped
SELECT 
  tu.user_email,
  tu.role,
  tu.user_id_in_tenant_db,
  t.name as tenant_name,
  t.slug as tenant_slug
FROM public.tenant_users tu
JOIN public.tenants t ON t.id = tu.tenant_id
WHERE t.slug = 'tenant-1'
ORDER BY tu.created_at;
