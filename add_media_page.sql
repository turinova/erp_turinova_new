-- Add media page to pages table
-- This should be run in the database to add the /media page to the navigation system

INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/media',
  'Média',
  'Média fájlok kezelése és feltöltése',
  'Rendszer',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();
