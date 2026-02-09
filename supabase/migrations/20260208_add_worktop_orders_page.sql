-- Add Munkalap megrendelések (worktop-orders) page to pages table for permission system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/worktop-orders',
  'Munkalap megrendelések',
  'Munkalap megrendelések kezelése és megtekintése',
  'Munkalap',
  true
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;
