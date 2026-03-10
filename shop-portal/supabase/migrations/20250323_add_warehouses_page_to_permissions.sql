-- Add warehouses page to permissions system
INSERT INTO pages (path, name, description, category, is_active) VALUES
('/warehouses', 'Raktárak', 'Raktárak kezelése', 'Törzsadatok', true)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;
