-- Nettfront anyagok törzsadat page for permission system.
-- Grant access via user_permissions manually.

INSERT INTO public.pages (path, name, description, category, is_active)
VALUES
  (
    '/nettfront-skus',
    'Nettfront anyagok',
    'Nettfront SKU katalógus (árak, színek, aktív státusz)',
    'Törzsadatok',
    true
  )
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();
