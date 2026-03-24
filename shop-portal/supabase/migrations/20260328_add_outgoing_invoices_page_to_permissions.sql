-- Kimenő számlák — page + default user permissions (tenant DB)

INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/finance/outgoing-invoices',
  'Kimenő számlák',
  'Kimenő számlák és díjbekérők listája, szűrése és kapcsolódó rendelések',
  'Pénzügy',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/finance/outgoing-invoices'
AND NOT EXISTS (
  SELECT 1
  FROM public.user_permissions up
  WHERE up.user_id = u.id AND up.page_id = p.id
)
ON CONFLICT (user_id, page_id) DO NOTHING;
