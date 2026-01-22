-- Change multiplier columns from numeric(3,2) to numeric(5,3) for better accuracy
-- Date: 2026-01-22
-- Purpose: Increase multiplier precision from 2 to 3 decimal places

-- Main product tables
ALTER TABLE public.accessories 
ALTER COLUMN multiplier TYPE numeric(5,3);

ALTER TABLE public.materials 
ALTER COLUMN multiplier TYPE numeric(5,3);

ALTER TABLE public.linear_materials 
ALTER COLUMN multiplier TYPE numeric(5,3);

-- Quote accessories table
ALTER TABLE public.quote_accessories 
ALTER COLUMN multiplier TYPE numeric(5,3);

-- Price history tables
ALTER TABLE public.accessory_price_history 
ALTER COLUMN old_multiplier TYPE numeric(5,3),
ALTER COLUMN new_multiplier TYPE numeric(5,3);

-- Check if material_price_history table exists (it might not in all environments)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_price_history') THEN
    ALTER TABLE public.material_price_history 
    ALTER COLUMN old_multiplier TYPE numeric(5,3),
    ALTER COLUMN new_multiplier TYPE numeric(5,3);
  END IF;
END $$;

-- Check if linear_material_price_history table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'linear_material_price_history') THEN
    ALTER TABLE public.linear_material_price_history 
    ALTER COLUMN old_multiplier TYPE numeric(5,3),
    ALTER COLUMN new_multiplier TYPE numeric(5,3);
  END IF;
END $$;

-- Update comments
COMMENT ON COLUMN public.accessories.multiplier IS 'Price multiplier with 3 decimal places precision (e.g., 1.380)';
COMMENT ON COLUMN public.materials.multiplier IS 'Price multiplier with 3 decimal places precision (e.g., 1.380)';
COMMENT ON COLUMN public.linear_materials.multiplier IS 'Price multiplier with 3 decimal places precision (e.g., 1.380)';
COMMENT ON COLUMN public.quote_accessories.multiplier IS 'Price multiplier with 3 decimal places precision (e.g., 1.380)';
