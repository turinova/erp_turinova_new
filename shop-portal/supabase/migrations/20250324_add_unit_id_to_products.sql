-- Add unit_id column to shoprenter_products table
-- This creates a direct foreign key relationship to the units table
-- for better data integrity and performance

-- Add unit_id column (nullable initially for backfill)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_unit_id 
ON public.shoprenter_products(unit_id) 
WHERE deleted_at IS NULL AND unit_id IS NOT NULL;

-- Backfill existing data: match measurement_unit text to units.shortform
-- This updates products that have a measurement_unit in their descriptions
UPDATE public.shoprenter_products p
SET unit_id = u.id
FROM public.shoprenter_product_descriptions d
JOIN public.units u ON LOWER(TRIM(d.measurement_unit)) = LOWER(u.shortform)
WHERE p.id = d.product_id
  AND d.language_code = 'hu'
  AND p.unit_id IS NULL
  AND d.measurement_unit IS NOT NULL
  AND d.measurement_unit != '';

-- Set default to 'db' (Darab) for products without unit
UPDATE public.shoprenter_products
SET unit_id = (SELECT id FROM public.units WHERE shortform = 'db' AND deleted_at IS NULL LIMIT 1)
WHERE unit_id IS NULL
  AND deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.shoprenter_products.unit_id IS 'Reference to units table (measurement unit for product quantity). Source of truth for product unit.';
