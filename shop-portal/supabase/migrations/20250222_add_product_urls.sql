-- Add product URL fields to shoprenter_products table
-- This allows tracking product URLs for sitemap and Search Console integration
-- Run this SQL manually in your Supabase SQL Editor

ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS product_url TEXT;

ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS url_slug TEXT;

ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS canonical_url TEXT;

ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS last_url_synced_at TIMESTAMP WITH TIME ZONE;

-- Add index for URL lookups
CREATE INDEX IF NOT EXISTS idx_products_url_slug ON public.shoprenter_products(url_slug) WHERE url_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_product_url ON public.shoprenter_products(product_url) WHERE product_url IS NOT NULL;

COMMENT ON COLUMN public.shoprenter_products.product_url IS 
'Full product URL from ShopRenter (e.g., https://vasalatmester.hu/riex-drawer-slide-400mm). Used for sitemap generation and Search Console integration.';

COMMENT ON COLUMN public.shoprenter_products.url_slug IS 
'URL slug/alias from ShopRenter (e.g., riex-drawer-slide-400mm). Extracted from urlAliases API resource.';

COMMENT ON COLUMN public.shoprenter_products.canonical_url IS 
'Canonical URL if different from product_url. Used for SEO to avoid duplicate content issues.';
