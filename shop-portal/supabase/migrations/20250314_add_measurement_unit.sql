-- Add measurement_unit column to shoprenter_product_descriptions table
-- This stores the measurement unit from ShopRenter productDescriptions.measurementUnit
-- Examples: "db", "kg", "m", "l", "pc", etc.

ALTER TABLE public.shoprenter_product_descriptions 
  ADD COLUMN IF NOT EXISTS measurement_unit TEXT;

-- Add index for measurement_unit searches (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS idx_descriptions_measurement_unit 
  ON public.shoprenter_product_descriptions(measurement_unit) 
  WHERE measurement_unit IS NOT NULL;

-- Comment on new column
COMMENT ON COLUMN public.shoprenter_product_descriptions.measurement_unit IS 
  'Measurement unit from ShopRenter productDescriptions.measurementUnit (e.g., "db", "kg", "m", "l", "pc"). Used for displaying quantity with unit (e.g., "5 db", "2 kg").';
