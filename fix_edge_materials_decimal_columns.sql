-- Fix edge_materials thickness and width columns to support decimals
-- Change from INTEGER to DECIMAL(5,2) to support values like 0.4, 2.5, etc.

-- First, check current column types
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'edge_materials' AND column_name IN ('thickness', 'width');

-- Change thickness from INTEGER to DECIMAL(5,2)
ALTER TABLE public.edge_materials 
ALTER COLUMN thickness TYPE DECIMAL(5,2) USING thickness::DECIMAL(5,2);

-- Change width from INTEGER to DECIMAL(5,2)
ALTER TABLE public.edge_materials 
ALTER COLUMN width TYPE DECIMAL(5,2) USING width::DECIMAL(5,2);

-- Also fix price if needed (should already be DECIMAL, but making sure)
ALTER TABLE public.edge_materials 
ALTER COLUMN price TYPE DECIMAL(10,2) USING price::DECIMAL(10,2);

-- Verify changes
-- SELECT column_name, data_type, numeric_precision, numeric_scale 
-- FROM information_schema.columns 
-- WHERE table_name = 'edge_materials' AND column_name IN ('thickness', 'width', 'price');

