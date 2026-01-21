-- Add Munki (worktop configurator) page to pages table for permission system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/worktop-config',
  'Munki',
  'Munkapult konfigurátor',
  'Eszközök',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();
