-- Add Munki beállítások (munki-settings) page to pages table for permission system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/munki-settings',
  'Munki beállítások',
  'Munkapult konfiguráció díjak kezelése',
  'Beállítások',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;
