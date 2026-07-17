-- Frontok — Ajánlatok + Megrendelések pages for permission system.
-- Grant access via user_permissions manually (same as /fronttervezo).

INSERT INTO public.pages (path, name, description, category, is_active)
VALUES
  (
    '/fronttervezo-quotes',
    'Front ajánlatok',
    'Nettfront / Fronttervező ajánlatok listája',
    'Frontok',
    true
  ),
  (
    '/fronttervezo-orders',
    'Front megrendelések',
    'Nettfront / Fronttervező megrendelések listája',
    'Frontok',
    true
  )
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();
