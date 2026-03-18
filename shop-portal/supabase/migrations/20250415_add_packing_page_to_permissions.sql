-- Add Csomagolás (packing) page to permissions system (Rendelések section)
-- Run on TENANT database

INSERT INTO public.pages (path, name, description, category, is_active) VALUES
('/pack', 'Csomagolás', 'Rendelések csomagolása és szkennelése; csomag kész → átadva / átvehető', 'Rendelések', true)
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
WHERE p.path = '/pack'
AND NOT EXISTS (
  SELECT 1
  FROM public.user_permissions up
  WHERE up.user_id = u.id AND up.page_id = p.id
)
ON CONFLICT (user_id, page_id) DO NOTHING;
