-- Performance optimization indexes for home page dashboard
-- This migration adds indexes on timestamp columns to improve query performance

-- ============================================================================
-- QUOTES TIMESTAMP INDEXES
-- ============================================================================
-- These indexes optimize date range queries for quote status tracking

-- Index for ordered_at timestamp
CREATE INDEX IF NOT EXISTS idx_quotes_ordered_at 
ON public.quotes(ordered_at) 
WHERE deleted_at IS NULL;

-- Index for in_production_at timestamp
CREATE INDEX IF NOT EXISTS idx_quotes_in_production_at 
ON public.quotes(in_production_at) 
WHERE deleted_at IS NULL;

-- Index for ready_at timestamp
CREATE INDEX IF NOT EXISTS idx_quotes_ready_at 
ON public.quotes(ready_at) 
WHERE deleted_at IS NULL;

-- Index for finished_at timestamp
CREATE INDEX IF NOT EXISTS idx_quotes_finished_at 
ON public.quotes(finished_at) 
WHERE deleted_at IS NULL;

-- Index for cancelled_at timestamp
CREATE INDEX IF NOT EXISTS idx_quotes_cancelled_at 
ON public.quotes(cancelled_at) 
WHERE deleted_at IS NULL;

-- Index for production_date (used in weekly cutting chart)
CREATE INDEX IF NOT EXISTS idx_quotes_production_date 
ON public.quotes(production_date) 
WHERE deleted_at IS NULL AND production_machine_id IS NOT NULL;

-- Composite index for production_date + production_machine_id (for weekly cutting)
CREATE INDEX IF NOT EXISTS idx_quotes_production_date_machine 
ON public.quotes(production_date, production_machine_id) 
WHERE deleted_at IS NULL AND production_machine_id IS NOT NULL;

-- ============================================================================
-- SHOP ORDER ITEMS TIMESTAMP INDEXES
-- ============================================================================
-- Index for created_at timestamp (used in monthly supplier orders)
CREATE INDEX IF NOT EXISTS idx_shop_order_items_created_at 
ON public.shop_order_items(created_at) 
WHERE deleted_at IS NULL;

-- Composite index for created_at + status (for status counting)
CREATE INDEX IF NOT EXISTS idx_shop_order_items_created_at_status 
ON public.shop_order_items(created_at, status) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- QUOTES SOURCE AND STATUS INDEXES
-- ============================================================================
-- Index for customer portal quotes (source + status)
CREATE INDEX IF NOT EXISTS idx_quotes_source_status 
ON public.quotes(source, status) 
WHERE deleted_at IS NULL;

-- Composite index for customer portal draft quotes
CREATE INDEX IF NOT EXISTS idx_quotes_customer_portal_draft 
ON public.quotes(source, status, created_at DESC) 
WHERE deleted_at IS NULL AND source = 'customer_portal' AND status = 'draft';

