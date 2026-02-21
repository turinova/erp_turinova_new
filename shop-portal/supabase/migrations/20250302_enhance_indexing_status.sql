-- Enhanced URL Inspection Data
-- Adds fields for mobile usability, Core Web Vitals, structured data, and page fetch state
-- Part of Phase 1: Enhanced URL Inspection API

-- Add new columns to product_indexing_status table
ALTER TABLE public.product_indexing_status 
  ADD COLUMN IF NOT EXISTS page_fetch_state TEXT,
  ADD COLUMN IF NOT EXISTS page_fetch_error TEXT,
  ADD COLUMN IF NOT EXISTS mobile_usability_issues JSONB,
  ADD COLUMN IF NOT EXISTS mobile_usability_passed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS core_web_vitals JSONB,
  ADD COLUMN IF NOT EXISTS structured_data_issues JSONB,
  ADD COLUMN IF NOT EXISTS rich_results_eligible TEXT[],
  ADD COLUMN IF NOT EXISTS sitemap_status TEXT,
  ADD COLUMN IF NOT EXISTS sitemap_url TEXT;

-- Add index for mobile usability issues
CREATE INDEX IF NOT EXISTS idx_indexing_status_mobile_issues 
  ON public.product_indexing_status(product_id) 
  WHERE mobile_usability_issues IS NOT NULL;

-- Add index for Core Web Vitals
CREATE INDEX IF NOT EXISTS idx_indexing_status_cwv 
  ON public.product_indexing_status(product_id) 
  WHERE core_web_vitals IS NOT NULL;

-- Add index for structured data issues
CREATE INDEX IF NOT EXISTS idx_indexing_status_structured_data 
  ON public.product_indexing_status(product_id) 
  WHERE structured_data_issues IS NOT NULL;

-- Add index for page fetch errors
CREATE INDEX IF NOT EXISTS idx_indexing_status_fetch_errors 
  ON public.product_indexing_status(product_id) 
  WHERE page_fetch_state != 'SUCCESS';

-- Comment on new columns
COMMENT ON COLUMN public.product_indexing_status.page_fetch_state IS 'Page fetch state from URL Inspection API (SUCCESS, SOFT_404, BLOCKED_ROBOTS_TXT, etc.)';
COMMENT ON COLUMN public.product_indexing_status.page_fetch_error IS 'Error message if page fetch failed';
COMMENT ON COLUMN public.product_indexing_status.mobile_usability_issues IS 'Array of mobile usability issues from URL Inspection API';
COMMENT ON COLUMN public.product_indexing_status.mobile_usability_passed IS 'Whether mobile usability test passed';
COMMENT ON COLUMN public.product_indexing_status.core_web_vitals IS 'Core Web Vitals scores (LCP, INP, CLS) from URL Inspection API';
COMMENT ON COLUMN public.product_indexing_status.structured_data_issues IS 'Array of structured data validation errors';
COMMENT ON COLUMN public.product_indexing_status.rich_results_eligible IS 'Array of rich result types this page is eligible for (Product, FAQ, Breadcrumb, etc.)';
COMMENT ON COLUMN public.product_indexing_status.sitemap_status IS 'Sitemap status (IN_SITEMAP, NOT_IN_SITEMAP, etc.)';
COMMENT ON COLUMN public.product_indexing_status.sitemap_url IS 'URL of the sitemap containing this page';
