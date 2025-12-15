-- Add invoices page to pages table
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES ('/invoices', 'Kimenő számlák', 'Kimenő számlák listázása és kezelése', 'Pénzügy', true)
ON CONFLICT (path) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = now();

