-- Add brand/manufacturer field to shoprenter_products table
-- Brand is pulled from ShopRenter productExtend.manufacturer.name

ALTER TABLE public.shoprenter_products 
  ADD COLUMN IF NOT EXISTS brand TEXT;

-- Add index for brand searches
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_brand 
  ON public.shoprenter_products(brand) 
  WHERE brand IS NOT NULL;

-- Comment on new column
COMMENT ON COLUMN public.shoprenter_products.brand IS 'Product brand/manufacturer name from ShopRenter manufacturer resource';
