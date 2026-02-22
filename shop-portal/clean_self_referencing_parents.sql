-- Clean self-referencing parent_product_id values
-- This fixes products where parent_product_id = id (invalid self-reference)
-- Run this to clean existing data without needing a full sync

-- Step 1: Fix products where parent_product_id points to itself
UPDATE shoprenter_products
SET parent_product_id = NULL
WHERE parent_product_id IS NOT NULL
  AND parent_product_id::text = id::text
  AND deleted_at IS NULL;

-- Step 2: Verify the fix (should return 0 rows after running)
SELECT 
  'Products with parent_product_id pointing to themselves (should be 0)' as check_name,
  COUNT(*) as count
FROM shoprenter_products
WHERE parent_product_id IS NOT NULL
  AND parent_product_id::text = id::text
  AND deleted_at IS NULL;
