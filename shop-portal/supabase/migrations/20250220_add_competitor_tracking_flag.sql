-- Add competitor tracking flag to products
-- This allows users to mark specific products for competitor price monitoring
-- (Optional - for future use if needed for filtering)

-- Add flag to shoprenter_products table
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS competitor_tracking_enabled BOOLEAN DEFAULT false;

-- Add index for quick filtering of tracked products
CREATE INDEX IF NOT EXISTS idx_products_competitor_tracking 
ON public.shoprenter_products(competitor_tracking_enabled) 
WHERE competitor_tracking_enabled = true;

-- Add comment
COMMENT ON COLUMN public.shoprenter_products.competitor_tracking_enabled 
IS 'When true, this product will be included in competitor price monitoring (optional)';
