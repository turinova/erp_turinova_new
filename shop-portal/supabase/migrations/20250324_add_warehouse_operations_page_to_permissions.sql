-- Add warehouse operations pages to permissions system
-- These pages will be under the "Raktár" navigation section

INSERT INTO public.pages (path, name, description, category, is_active) VALUES
('/warehouse-operations', 'Raktári műveletek', 'Raktári műveletek megtekintése', 'Raktár', true),
('/warehouse-operations/[id]', 'Raktári művelet részletei', 'Raktári művelet részleteinek megtekintése', 'Raktár', true)
ON CONFLICT (path) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;
