-- Add pos-orders page to permission system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES ('/pos-orders', 'Rendelések', 'POS rendelések kezelése', 'Értékesítés', TRUE)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = now();

SELECT * FROM public.pages WHERE path = '/pos-orders';

