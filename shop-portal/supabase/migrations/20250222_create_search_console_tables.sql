-- Search Console Integration Tables
-- Stores Google Search Console performance data for products
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Product Search Performance (aggregated by date)
CREATE TABLE IF NOT EXISTS public.product_search_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- Date range
  date DATE NOT NULL,
  
  -- Performance metrics
  impressions INTEGER DEFAULT 0,      -- How many times shown in search
  clicks INTEGER DEFAULT 0,           -- How many clicks
  ctr DECIMAL(5,4) DEFAULT 0,         -- Click-through rate (0.0000-1.0000)
  position DECIMAL(5,2) DEFAULT 0,   -- Average position in search results
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one record per product per date
  UNIQUE(product_id, date)
);

-- 2. Product Search Queries (individual queries that led to product)
CREATE TABLE IF NOT EXISTS public.product_search_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- Query data
  query TEXT NOT NULL,                -- The search query
  date DATE NOT NULL,                 -- Date of the query
  
  -- Performance metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  position DECIMAL(5,2) DEFAULT 0,
  
  -- Query intent classification (for AI optimization)
  intent TEXT CHECK (intent IN ('informational', 'commercial', 'transactional', 'navigational', 'unknown')),
  
  -- Metadata
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one record per product per query per date
  UNIQUE(product_id, query, date)
);

-- 3. Product Indexing Status (from Search Console URL Inspection)
CREATE TABLE IF NOT EXISTS public.product_indexing_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- Indexing status
  is_indexed BOOLEAN DEFAULT false,
  last_crawled TIMESTAMP WITH TIME ZONE,
  coverage_state TEXT,               -- 'Submitted and indexed', 'Discovered - currently not indexed', etc.
  indexing_state TEXT,                -- 'Indexing allowed', 'Indexing not selected', etc.
  
  -- Issues
  has_issues BOOLEAN DEFAULT false,
  issues JSONB,                       -- Array of indexing issues if any
  
  -- Metadata
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  check_count INTEGER DEFAULT 0,      -- How many times we've checked this URL
  
  -- Unique constraint: one record per product
  UNIQUE(product_id)
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_perf_product ON public.product_search_performance(product_id);
CREATE INDEX IF NOT EXISTS idx_search_perf_date ON public.product_search_performance(date);
CREATE INDEX IF NOT EXISTS idx_search_perf_connection ON public.product_search_performance(connection_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_product ON public.product_search_queries(product_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_query ON public.product_search_queries(query);
CREATE INDEX IF NOT EXISTS idx_search_queries_date ON public.product_search_queries(date);
CREATE INDEX IF NOT EXISTS idx_indexing_status_product ON public.product_indexing_status(product_id);
CREATE INDEX IF NOT EXISTS idx_indexing_status_indexed ON public.product_indexing_status(is_indexed) WHERE is_indexed = false;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.product_search_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_indexing_status ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for product_search_performance
DROP POLICY IF EXISTS "Search performance is viewable by authenticated users" ON public.product_search_performance;
CREATE POLICY "Search performance is viewable by authenticated users" ON public.product_search_performance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Only authorized users can manage search performance" ON public.product_search_performance;
CREATE POLICY "Only authorized users can manage search performance" ON public.product_search_performance
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  );

-- 7. RLS Policies for product_search_queries
DROP POLICY IF EXISTS "Search queries are viewable by authenticated users" ON public.product_search_queries;
CREATE POLICY "Search queries are viewable by authenticated users" ON public.product_search_queries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Only authorized users can manage search queries" ON public.product_search_queries;
CREATE POLICY "Only authorized users can manage search queries" ON public.product_search_queries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  );

-- 8. RLS Policies for product_indexing_status
DROP POLICY IF EXISTS "Indexing status is viewable by authenticated users" ON public.product_indexing_status;
CREATE POLICY "Indexing status is viewable by authenticated users" ON public.product_indexing_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Only authorized users can manage indexing status" ON public.product_indexing_status;
CREATE POLICY "Only authorized users can manage indexing status" ON public.product_indexing_status
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  );

-- 9. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_search_performance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_search_queries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_indexing_status TO authenticated;
