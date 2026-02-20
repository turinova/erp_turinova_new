-- ============================================
-- CLEANUP: Remove sitemap-related tables and columns
-- Run this in Supabase SQL Editor to clean up unused sitemap functionality
-- ============================================

-- 1. Drop the competitor_sitemap_cache table (if exists)
DROP TABLE IF EXISTS public.competitor_sitemap_cache CASCADE;

-- 2. Drop the competitor_discovered_products table (if exists)
DROP TABLE IF EXISTS public.competitor_discovered_products CASCADE;

-- 3. Remove sitemap-related columns from competitors table
ALTER TABLE public.competitors 
DROP COLUMN IF EXISTS sitemap_url,
DROP COLUMN IF EXISTS last_sitemap_crawl_at,
DROP COLUMN IF EXISTS sitemap_crawl_status,
DROP COLUMN IF EXISTS sitemap_crawl_error,
DROP COLUMN IF EXISTS discovered_products_count,
DROP COLUMN IF EXISTS matched_products_count;

-- 4. Optional: Remove competitor_tracking_enabled from products if not needed
-- (Uncomment if you want to remove this column too)
-- ALTER TABLE public.shoprenter_products 
-- DROP COLUMN IF EXISTS competitor_tracking_enabled;

-- Done! Sitemap-related data has been cleaned up.
SELECT 'Sitemap cleanup completed successfully!' as result;
