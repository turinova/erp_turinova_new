-- Fix: Clear parent_product_id for products that reference themselves
-- This is invalid data that can cause canonical URL issues
-- A product cannot be its own parent

-- Step 1: Find and fix products where parent_product_id = id
UPDATE shoprenter_products
SET parent_product_id = NULL
WHERE parent_product_id IS NOT NULL
  AND parent_product_id::text = id::text
  AND deleted_at IS NULL;

-- Step 2: Verify the fix
-- This query should return 0 rows after running the migration
SELECT 
  'Products with parent_product_id pointing to themselves (should be 0)' as check_name,
  COUNT(*) as count
FROM shoprenter_products
WHERE parent_product_id IS NOT NULL
  AND parent_product_id::text = id::text
  AND deleted_at IS NULL;
