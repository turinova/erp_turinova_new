-- Add product_class_shoprenter_id column to shoprenter_products table
-- This stores the ShopRenter Product Class ID for quick lookups and attribute filtering

ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS product_class_shoprenter_id TEXT;

-- Create index for faster Product Class lookups
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_product_class_shoprenter_id 
ON public.shoprenter_products(product_class_shoprenter_id) 
WHERE product_class_shoprenter_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.shoprenter_products.product_class_shoprenter_id IS 
'ShopRenter Product Class ID (base64 encoded). Used to filter available attributes for a product based on its Product Class.';
