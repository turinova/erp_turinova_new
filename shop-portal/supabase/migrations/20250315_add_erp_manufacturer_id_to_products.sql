-- Add erp_manufacturer_id column to shoprenter_products table
-- This stores the ERP manufacturer ID (from manufacturers table) for products
-- This is separate from manufacturer_id which stores the ShopRenter manufacturer ID

ALTER TABLE public.shoprenter_products 
  ADD COLUMN IF NOT EXISTS erp_manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE SET NULL;

-- Add index for erp_manufacturer_id searches
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_erp_manufacturer_id 
  ON public.shoprenter_products(erp_manufacturer_id) 
  WHERE erp_manufacturer_id IS NOT NULL;

-- Comment on new column
COMMENT ON COLUMN public.shoprenter_products.erp_manufacturer_id IS 'ERP manufacturer ID (from manufacturers table). This is the global manufacturer/brand that can be used across all platforms. Separate from manufacturer_id which is the ShopRenter-specific manufacturer ID.';
