-- Performance optimization indexes for search functionality
-- This migration adds trigram indexes and composite indexes to improve search performance

-- ============================================================================
-- ENABLE PG_TRGM EXTENSION FOR TRIGRAM INDEXES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- TRIGRAM INDEXES FOR ILIKE PATTERN MATCHING
-- ============================================================================
-- These indexes enable efficient ILIKE searches with pattern matching
-- GIN indexes are ideal for text search operations

-- Materials name trigram index (for prefix and pattern searches)
CREATE INDEX IF NOT EXISTS idx_materials_name_trgm 
ON public.materials 
USING gin (name gin_trgm_ops) 
WHERE deleted_at IS NULL;

-- Linear materials name trigram index (for prefix and pattern searches)
CREATE INDEX IF NOT EXISTS idx_linear_materials_name_trgm 
ON public.linear_materials 
USING gin (name gin_trgm_ops) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- COMPOSITE INDEXES FOR FILTERED SEARCHES
-- ============================================================================
-- These indexes optimize queries that filter by deleted_at and search by name
-- The order matters: deleted_at first (most selective), then name

-- Materials composite index (deleted_at, name)
CREATE INDEX IF NOT EXISTS idx_materials_deleted_name 
ON public.materials (deleted_at, name) 
WHERE deleted_at IS NULL;

-- Linear materials composite index (deleted_at, name)
CREATE INDEX IF NOT EXISTS idx_linear_materials_deleted_name 
ON public.linear_materials (deleted_at, name) 
WHERE deleted_at IS NULL;

