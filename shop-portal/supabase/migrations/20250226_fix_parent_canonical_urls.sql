-- Fix: Clear canonical URLs for all parent products
-- Parent products should NOT have canonical URLs (they ARE the canonical)
-- Only child products should have canonical URLs pointing to parent

-- Step 1: Clear canonical URLs for all products that are parents (have children)
UPDATE shoprenter_products
SET canonical_url = NULL
WHERE id IN (
  SELECT DISTINCT parent_product_id::uuid 
  FROM shoprenter_products 
  WHERE parent_product_id IS NOT NULL
    AND deleted_at IS NULL
)
AND canonical_url IS NOT NULL;

-- Step 2: Verify the fix
-- This query should return 0 rows after running the migration
SELECT 
  'Products that are parents but still have canonical_url (should be 0)' as check_name,
  COUNT(*) as count
FROM shoprenter_products
WHERE id IN (
  SELECT DISTINCT parent_product_id::uuid 
  FROM shoprenter_products 
  WHERE parent_product_id IS NOT NULL
    AND deleted_at IS NULL
)
AND canonical_url IS NOT NULL
AND deleted_at IS NULL;
