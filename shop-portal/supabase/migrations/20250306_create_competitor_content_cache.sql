-- Create competitor content cache table
-- Caches scraped competitor content to avoid re-scraping on every description generation
CREATE TABLE IF NOT EXISTS public.competitor_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  content JSONB NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_competitor_content_cache_url 
ON public.competitor_content_cache(url);

CREATE INDEX IF NOT EXISTS idx_competitor_content_cache_expires 
ON public.competitor_content_cache(expires_at) 
WHERE expires_at > NOW();

-- Add comment
COMMENT ON TABLE public.competitor_content_cache IS 
'Caches scraped competitor product page content to speed up AI description generation. Content expires after 7 days.';

COMMENT ON COLUMN public.competitor_content_cache.url IS 
'Competitor product page URL (unique identifier)';

COMMENT ON COLUMN public.competitor_content_cache.content IS 
'Cached competitor content (keywords, phrases, features, benefits, etc.) as JSONB';

COMMENT ON COLUMN public.competitor_content_cache.expires_at IS 
'When this cache entry expires (typically 7 days from scraped_at)';

-- Enable RLS
ALTER TABLE public.competitor_content_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to read/write cache
CREATE POLICY "Allow authenticated users to read competitor content cache"
ON public.competitor_content_cache
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert competitor content cache"
ON public.competitor_content_cache
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update competitor content cache"
ON public.competitor_content_cache
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete competitor content cache"
ON public.competitor_content_cache
FOR DELETE
TO authenticated
USING (true);
