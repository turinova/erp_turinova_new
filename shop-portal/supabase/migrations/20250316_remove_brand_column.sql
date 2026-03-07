-- Remove brand column from shoprenter_products table
-- Brand is now redundant - we use erp_manufacturer_id to join with manufacturers table
-- This migration removes the brand column and its index

-- Drop index first
DROP INDEX IF EXISTS idx_shoprenter_products_brand;

-- Drop column
ALTER TABLE public.shoprenter_products 
  DROP COLUMN IF EXISTS brand;
