-- ============================================
-- SQL Test Queries for Structured Data & Canonical URLs
-- ============================================

-- Test 1: Check structured data for products
SELECT 
  psd.id,
  psd.structured_data_type,
  psd.json_ld_data->>'@type' as schema_type,
  psd.created_at,
  psd.updated_at,
  sp.sku,
  sp.name
FROM product_structured_data psd
JOIN shoprenter_products sp ON sp.id = psd.product_id
ORDER BY psd.updated_at DESC
LIMIT 10;

-- Test 2: Check canonical URLs (FIXED - with proper type casting)
-- Note: parent_product_id is TEXT, id is UUID, so we need to cast
-- IMPORTANT: Parent products should have canonical_url = NULL (they ARE the canonical)
-- Only child products should have canonical_url pointing to parent
SELECT 
  child.id,
  child.sku,
  child.product_url as child_url,
  child.canonical_url,
  parent.sku as parent_sku,
  parent.product_url as parent_url,
  parent.canonical_url as parent_canonical_url, -- Should be NULL
  CASE 
    WHEN parent.canonical_url IS NULL THEN '✅ Correct'
    ELSE '❌ ERROR: Parent should not have canonical_url'
  END as parent_status
FROM shoprenter_products child
JOIN shoprenter_products parent ON parent.id::text = child.parent_product_id
WHERE child.parent_product_id IS NOT NULL
  AND child.deleted_at IS NULL
ORDER BY child.updated_at DESC
LIMIT 10;

-- Test 3: Find parent products with children that have canonical URLs
SELECT 
  parent.id,
  parent.sku as parent_sku,
  parent.product_url as parent_url,
  COUNT(child.id) as total_children,
  COUNT(CASE WHEN child.canonical_url IS NOT NULL THEN 1 END) as children_with_canonical
FROM shoprenter_products parent
LEFT JOIN shoprenter_products child ON child.parent_product_id = parent.id::text
WHERE parent.id IN (
  SELECT DISTINCT parent_product_id::uuid 
  FROM shoprenter_products 
  WHERE parent_product_id IS NOT NULL
)
GROUP BY parent.id, parent.sku, parent.product_url
HAVING COUNT(child.id) > 0
ORDER BY total_children DESC
LIMIT 10;

-- Test 4: Find products with incorrect canonical URLs
-- a) Child products missing canonical URLs
-- b) Parent products that incorrectly have canonical URLs set
SELECT 
  'Child missing canonical' as issue_type,
  child.id,
  child.sku,
  child.product_url,
  child.canonical_url,
  parent.sku as parent_sku,
  parent.product_url as parent_url
FROM shoprenter_products child
JOIN shoprenter_products parent ON parent.id::text = child.parent_product_id
WHERE child.parent_product_id IS NOT NULL
  AND child.canonical_url IS NULL
  AND child.status = 1
  AND child.deleted_at IS NULL
UNION ALL
SELECT 
  'Parent has canonical (ERROR)' as issue_type,
  parent.id,
  parent.sku,
  parent.product_url,
  parent.canonical_url,
  NULL as parent_sku,
  NULL as parent_url
FROM shoprenter_products parent
WHERE parent.id IN (
  SELECT DISTINCT parent_product_id::uuid 
  FROM shoprenter_products 
  WHERE parent_product_id IS NOT NULL
)
  AND parent.canonical_url IS NOT NULL
  AND parent.status = 1
  AND parent.deleted_at IS NULL
ORDER BY issue_type, sku
LIMIT 30;

-- Test 5: Find parent products without structured data
SELECT 
  parent.id,
  parent.sku,
  parent.name,
  COUNT(child.id) as child_count,
  CASE WHEN psd.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_structured_data
FROM shoprenter_products parent
LEFT JOIN shoprenter_products child ON child.parent_product_id = parent.id::text
LEFT JOIN product_structured_data psd ON psd.product_id = parent.id
WHERE parent.id IN (
  SELECT DISTINCT parent_product_id::uuid 
  FROM shoprenter_products 
  WHERE parent_product_id IS NOT NULL
)
  AND parent.status = 1
  AND parent.deleted_at IS NULL
GROUP BY parent.id, parent.sku, parent.name, psd.id
HAVING COUNT(child.id) > 0
ORDER BY child_count DESC
LIMIT 20;

-- Test 6: Summary statistics
SELECT 
  'Total Products' as metric,
  COUNT(*)::text as value
FROM shoprenter_products
WHERE deleted_at IS NULL
UNION ALL
SELECT 
  'Parent Products (unique)' as metric,
  COUNT(DISTINCT parent_product_id)::text as value
FROM shoprenter_products
WHERE parent_product_id IS NOT NULL
  AND deleted_at IS NULL
UNION ALL
SELECT 
  'Child Products' as metric,
  COUNT(*)::text as value
FROM shoprenter_products
WHERE parent_product_id IS NOT NULL
  AND deleted_at IS NULL
UNION ALL
SELECT 
  'Children with Canonical URL (correct)' as metric,
  COUNT(*)::text as value
FROM shoprenter_products
WHERE parent_product_id IS NOT NULL
  AND canonical_url IS NOT NULL
  AND deleted_at IS NULL
UNION ALL
SELECT 
  'Children Missing Canonical URL (needs fix)' as metric,
  COUNT(*)::text as value
FROM shoprenter_products
WHERE parent_product_id IS NOT NULL
  AND canonical_url IS NULL
  AND deleted_at IS NULL
UNION ALL
SELECT 
  'Parents with Canonical URL (ERROR - should be NULL)' as metric,
  COUNT(*)::text as value
FROM shoprenter_products
WHERE id IN (
  SELECT DISTINCT parent_product_id::uuid 
  FROM shoprenter_products 
  WHERE parent_product_id IS NOT NULL
)
  AND canonical_url IS NOT NULL
  AND deleted_at IS NULL
UNION ALL
SELECT 
  'Products with Structured Data' as metric,
  COUNT(DISTINCT product_id)::text as value
FROM product_structured_data
UNION ALL
SELECT 
  'ProductGroup Schemas' as metric,
  COUNT(*)::text as value
FROM product_structured_data
WHERE structured_data_type = 'ProductGroup'
UNION ALL
SELECT 
  'Product Schemas' as metric,
  COUNT(*)::text as value
FROM product_structured_data
WHERE structured_data_type = 'Product';
