-- Competitor Price Analysis System
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Create competitors table (stores competitor website info)
CREATE TABLE IF NOT EXISTS public.competitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Info
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  
  -- Configuration (stores AI learning data)
  scrape_config JSONB DEFAULT '{}', -- Learned patterns, selectors, etc.
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create competitor_product_links table (links your products to competitor pages)
CREATE TABLE IF NOT EXISTS public.competitor_product_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Relations
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  
  -- Competitor product info
  competitor_url TEXT NOT NULL, -- The actual product page URL on competitor site
  competitor_sku TEXT, -- Their SKU/article number if known
  competitor_product_name TEXT, -- Product name on competitor site
  
  -- Matching info
  matching_method TEXT DEFAULT 'manual', -- 'mpn', 'ean', 'manual', 'ai'
  matching_confidence DECIMAL(5,2), -- 0-100 confidence score
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, competitor_id)
);

-- 3. Create competitor_prices table (price history)
CREATE TABLE IF NOT EXISTS public.competitor_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Relation
  competitor_product_link_id UUID NOT NULL REFERENCES public.competitor_product_links(id) ON DELETE CASCADE,
  
  -- Price data
  price DECIMAL(15,2),
  original_price DECIMAL(15,2), -- Original/list price (if on sale)
  currency TEXT DEFAULT 'HUF',
  in_stock BOOLEAN,
  
  -- Extracted data
  extracted_product_name TEXT,
  extracted_data JSONB, -- Any other extracted data
  
  -- Scrape metadata
  raw_html_hash TEXT, -- To detect page changes
  scrape_duration_ms INTEGER,
  ai_model_used TEXT, -- Which AI model extracted the data
  
  -- Timestamps
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_competitors_active ON public.competitors(is_active);
CREATE INDEX IF NOT EXISTS idx_competitor_links_product ON public.competitor_product_links(product_id);
CREATE INDEX IF NOT EXISTS idx_competitor_links_competitor ON public.competitor_product_links(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_links_active ON public.competitor_product_links(is_active);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_link ON public.competitor_prices(competitor_product_link_id);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_scraped_at ON public.competitor_prices(scraped_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_product_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_prices ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for competitors
DROP POLICY IF EXISTS "Competitors are viewable by authenticated users" ON public.competitors;
CREATE POLICY "Competitors are viewable by authenticated users" ON public.competitors
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only authorized users can manage competitors" ON public.competitors;
CREATE POLICY "Only authorized users can manage competitors" ON public.competitors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/competitors' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/competitors' 
      AND up.can_access = true
    )
  );

-- 7. Create RLS Policies for competitor_product_links
DROP POLICY IF EXISTS "Competitor links are viewable by authenticated users" ON public.competitor_product_links;
CREATE POLICY "Competitor links are viewable by authenticated users" ON public.competitor_product_links
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only authorized users can manage competitor links" ON public.competitor_product_links;
CREATE POLICY "Only authorized users can manage competitor links" ON public.competitor_product_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/competitors' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/competitors' 
      AND up.can_access = true
    )
  );

-- 8. Create RLS Policies for competitor_prices
DROP POLICY IF EXISTS "Competitor prices are viewable by authenticated users" ON public.competitor_prices;
CREATE POLICY "Competitor prices are viewable by authenticated users" ON public.competitor_prices
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only authorized users can manage competitor prices" ON public.competitor_prices;
CREATE POLICY "Only authorized users can manage competitor prices" ON public.competitor_prices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/competitors' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/competitors' 
      AND up.can_access = true
    )
  );

-- 9. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_product_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_prices TO authenticated;

-- 10. Add /competitors page to pages table (for permission system)
INSERT INTO public.pages (path, name, description, category) VALUES
  ('/competitors', 'Versenytársak', 'Versenytárs árak figyelése és elemzése', 'SEO')
ON CONFLICT (path) DO NOTHING;

-- 11. Insert initial competitors (the 3 sites mentioned)
INSERT INTO public.competitors (name, website_url, is_active) VALUES
  ('VasalatWebshop', 'https://www.vasalatwebshop.hu', true),
  ('Bútorkellék', 'https://butorkellek.eu', true),
  ('Vasalatfutár', 'https://vasalatfutar.hu', true)
ON CONFLICT DO NOTHING;
