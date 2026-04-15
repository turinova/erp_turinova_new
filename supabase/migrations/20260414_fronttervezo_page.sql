-- Fronttervező — register page only. Grant access via user_permissions manually (no bulk grant).
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/fronttervezo',
  'Fronttervező',
  'Konyha front tervezés',
  'Általános',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();
