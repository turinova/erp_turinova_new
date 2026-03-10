-- Add purchasing pages to permissions system
-- These pages will be under the "Beszerzés" navigation section

INSERT INTO public.pages (path, name, description, category, is_active) VALUES
('/purchase-orders', 'Beszerzési rendelések', 'Beszerzési rendelések kezelése', 'Beszerzés', true),
('/purchase-orders/new', 'Új beszerzési rendelés', 'Új beszerzési rendelés létrehozása', 'Beszerzés', true),
('/purchase-orders/[id]', 'Beszerzési rendelés szerkesztése', 'Beszerzési rendelés szerkesztése', 'Beszerzés', true),
('/shipments', 'Szállítmányok', 'Szállítmányok kezelése', 'Beszerzés', true),
('/shipments/[id]/receiving', 'Szállítmány bevételezés', 'Szállítmány bevételezése', 'Beszerzés', true),
('/stock', 'Készlet', 'Készlet nyilvántartás', 'Beszerzés', true)
ON CONFLICT (path) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;
