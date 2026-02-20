-- Add model_number column for "Gyártói cikkszám" (Manufacturer part number)
-- Run this SQL manually in your Supabase SQL Editor

-- Add model_number column to shoprenter_products
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS model_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.shoprenter_products.model_number IS 'Manufacturer part number (Gyártói cikkszám) from ShopRenter modelNumber field';

-- Create index for potential searches
CREATE INDEX IF NOT EXISTS idx_products_model_number ON public.shoprenter_products(model_number);
