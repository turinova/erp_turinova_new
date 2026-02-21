-- Remove SEO-related features from database
-- ShopRenter handles canonical URLs and structured data automatically

-- 1. Drop product_structured_data table
DROP TABLE IF EXISTS public.product_structured_data CASCADE;

-- 2. Remove canonical_url column from shoprenter_products
ALTER TABLE public.shoprenter_products
DROP COLUMN IF EXISTS canonical_url;

-- Verify removal
DO $$
BEGIN
  -- Check if table was dropped
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'product_structured_data'
  ) THEN
    RAISE EXCEPTION 'product_structured_data table still exists';
  END IF;
  
  -- Check if column was dropped
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shoprenter_products' 
    AND column_name = 'canonical_url'
  ) THEN
    RAISE EXCEPTION 'canonical_url column still exists';
  END IF;
  
  RAISE NOTICE 'SEO features successfully removed from database';
END $$;
