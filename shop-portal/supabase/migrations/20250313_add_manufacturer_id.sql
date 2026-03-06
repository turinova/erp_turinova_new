-- Add manufacturer_id column to shoprenter_products table
-- This stores the ShopRenter manufacturer ID for syncing back

ALTER TABLE public.shoprenter_products 
  ADD COLUMN IF NOT EXISTS manufacturer_id TEXT;

-- Add index for manufacturer_id searches
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_manufacturer_id 
  ON public.shoprenter_products(manufacturer_id) 
  WHERE manufacturer_id IS NOT NULL;

-- Comment on new column
COMMENT ON COLUMN public.shoprenter_products.manufacturer_id IS 'ShopRenter manufacturer resource ID (for syncing manufacturer back to ShopRenter)';
