-- Shop Portal Products Performance Indexes Migration
-- Adds indexes for fast search and pagination
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Enable trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add trigram indexes for fast partial text matching on name and sku
-- These indexes allow fast searches like "term%" and "%term%" without full table scans
CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
  ON public.shoprenter_products 
  USING gin(name gin_trgm_ops) 
  WHERE name IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm 
  ON public.shoprenter_products 
  USING gin(sku gin_trgm_ops) 
  WHERE deleted_at IS NULL;

-- 3. Add composite index for common query pattern: filter deleted + order by created_at
-- This covers: WHERE deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_products_deleted_created 
  ON public.shoprenter_products(deleted_at, created_at DESC) 
  WHERE deleted_at IS NULL;

-- 4. Add index on deleted_at for faster filtering (if not already covered)
CREATE INDEX IF NOT EXISTS idx_products_deleted_at 
  ON public.shoprenter_products(deleted_at) 
  WHERE deleted_at IS NULL;

-- 5. Add composite index for search + pagination: (deleted_at, name, created_at)
-- This helps with queries that filter deleted, search by name, and order by created_at
CREATE INDEX IF NOT EXISTS idx_products_deleted_name_created 
  ON public.shoprenter_products(deleted_at, name, created_at DESC) 
  WHERE deleted_at IS NULL AND name IS NOT NULL;

-- 6. Add index on connection_id + deleted_at for connection-specific queries
CREATE INDEX IF NOT EXISTS idx_products_connection_deleted 
  ON public.shoprenter_products(connection_id, deleted_at) 
  WHERE deleted_at IS NULL;

-- Note: These indexes will significantly improve:
-- - Text search performance (10-100x faster)
-- - Pagination queries (2-5x faster)
-- - Filtering by deleted_at (already fast, but ensures consistency)
