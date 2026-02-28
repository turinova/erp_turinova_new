-- Add indexes for products search performance
-- Phase 2: Database optimization

-- 1. Enable pg_trgm extension for trigram text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Trigram indexes for text search (much faster than ilike)
-- Index for name search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
ON public.shoprenter_products USING gin (name gin_trgm_ops)
WHERE deleted_at IS NULL;

-- Index for SKU search
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm 
ON public.shoprenter_products USING gin (sku gin_trgm_ops)
WHERE deleted_at IS NULL;

-- Index for model_number search
CREATE INDEX IF NOT EXISTS idx_products_model_number_trgm 
ON public.shoprenter_products USING gin (model_number gin_trgm_ops)
WHERE deleted_at IS NULL AND model_number IS NOT NULL;

-- Index for GTIN search
CREATE INDEX IF NOT EXISTS idx_products_gtin_trgm 
ON public.shoprenter_products USING gin (gtin gin_trgm_ops)
WHERE deleted_at IS NULL AND gtin IS NOT NULL;

-- 3. Composite index for common filters (status + sync_status)
CREATE INDEX IF NOT EXISTS idx_products_status_sync 
ON public.shoprenter_products(status, sync_status) 
WHERE deleted_at IS NULL;

-- 4. Index for parent_product_id (variant queries)
CREATE INDEX IF NOT EXISTS idx_products_parent_id 
ON public.shoprenter_products(parent_product_id) 
WHERE parent_product_id IS NOT NULL AND deleted_at IS NULL;

-- 5. Index for created_at (used in ordering)
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc 
ON public.shoprenter_products(created_at DESC) 
WHERE deleted_at IS NULL;

-- Comments
COMMENT ON INDEX idx_products_name_trgm IS 'Trigram index for fast name search using ilike';
COMMENT ON INDEX idx_products_sku_trgm IS 'Trigram index for fast SKU search using ilike';
COMMENT ON INDEX idx_products_model_number_trgm IS 'Trigram index for fast model number search using ilike';
COMMENT ON INDEX idx_products_gtin_trgm IS 'Trigram index for fast GTIN search using ilike';
COMMENT ON INDEX idx_products_status_sync IS 'Composite index for filtering by status and sync_status';
COMMENT ON INDEX idx_products_parent_id IS 'Index for parent-child product relationships';
COMMENT ON INDEX idx_products_created_at_desc IS 'Index for ordering by created_at DESC';
