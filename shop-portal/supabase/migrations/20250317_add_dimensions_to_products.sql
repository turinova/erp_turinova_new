-- Add dimension and weight columns to shoprenter_products table
-- Dimensions: width (szélesség), height (magasság), length (hosszúság)
-- Weight: weight (súly) with weight unit reference

ALTER TABLE public.shoprenter_products 
  ADD COLUMN IF NOT EXISTS width NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS height NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS length NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS weight NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS erp_weight_unit_id UUID REFERENCES public.weight_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shoprenter_volume_unit_id TEXT, -- ShopRenter lengthClass ID (for dimensions - cm, m, mm)
  ADD COLUMN IF NOT EXISTS shoprenter_weight_unit_id TEXT; -- ShopRenter weightClass ID (for weight - kg, g, etc.)

-- Add indexes for dimensions and weight
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_dimensions 
  ON public.shoprenter_products(width, height, length) 
  WHERE width IS NOT NULL OR height IS NOT NULL OR length IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shoprenter_products_weight 
  ON public.shoprenter_products(weight) 
  WHERE weight IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shoprenter_products_erp_weight_unit_id 
  ON public.shoprenter_products(erp_weight_unit_id) 
  WHERE erp_weight_unit_id IS NOT NULL;

-- Comments on new columns
COMMENT ON COLUMN public.shoprenter_products.width IS 'Product width in cm (szélesség)';
COMMENT ON COLUMN public.shoprenter_products.height IS 'Product height in cm (magasság)';
COMMENT ON COLUMN public.shoprenter_products.length IS 'Product length in cm (hosszúság)';
COMMENT ON COLUMN public.shoprenter_products.weight IS 'Product weight (súly)';
COMMENT ON COLUMN public.shoprenter_products.erp_weight_unit_id IS 'ERP weight unit ID (from weight_units table)';
COMMENT ON COLUMN public.shoprenter_products.shoprenter_volume_unit_id IS 'ShopRenter lengthClass ID (for dimensions - default: cm)';
COMMENT ON COLUMN public.shoprenter_products.shoprenter_weight_unit_id IS 'ShopRenter weightClass ID (for weight)';
