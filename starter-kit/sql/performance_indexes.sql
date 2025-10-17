-- Performance optimization indexes for brands table
-- These indexes will significantly improve query performance

-- Index for filtering by deleted_at and id (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_brands_deleted_id ON brands (deleted_at, id);

-- Index for filtering by deleted_at and ordering by created_at
CREATE INDEX IF NOT EXISTS idx_brands_deleted_created ON brands (deleted_at, created_at DESC);

-- Index for filtering by deleted_at and ordering by name (for list queries)
CREATE INDEX IF NOT EXISTS idx_brands_deleted_name ON brands (deleted_at, name ASC);

-- Index for filtering by deleted_at and ordering by updated_at
CREATE INDEX IF NOT EXISTS idx_brands_deleted_updated ON brands (deleted_at, updated_at DESC);

-- Composite index for search queries (name and comment)
CREATE INDEX IF NOT EXISTS idx_brands_search ON brands (deleted_at, name, comment) WHERE deleted_at IS NULL;

-- Index for unique name constraint (if not already exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_name_unique ON brands (name) WHERE deleted_at IS NULL;

-- Analyze the table to update statistics
ANALYZE brands;

-- Show index usage statistics (run this after some queries to verify indexes are being used)
-- SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'brands';
