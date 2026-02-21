-- Category Sync & AI Description Generation - Database Schema
-- Creates tables for ShopRenter categories, descriptions, and product-category relations

-- Categories table
CREATE TABLE IF NOT EXISTS public.shoprenter_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- ShopRenter identifiers
  shoprenter_id TEXT NOT NULL, -- Base64 encoded category ID from ShopRenter
  shoprenter_inner_id TEXT, -- Inner ID (numeric)
  
  -- Category data
  name TEXT, -- Will be populated from categoryDescriptions
  picture TEXT, -- Image filename
  sort_order INTEGER DEFAULT 0,
  status INTEGER DEFAULT 1, -- 1 = active, 0 = inactive
  products_status INTEGER DEFAULT 1, -- Status of products in category
  
  -- Hierarchy
  parent_category_id UUID REFERENCES public.shoprenter_categories(id) ON DELETE SET NULL,
  parent_category_shoprenter_id TEXT, -- For initial sync before parent exists
  
  -- URLs
  url_slug TEXT,
  url_alias_id TEXT,
  category_url TEXT, -- Full URL: https://shopname.shoprenter.hu/category-slug
  
  -- Sync tracking
  sync_status TEXT DEFAULT 'pending', -- pending, synced, error
  sync_error TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  date_created TIMESTAMP WITH TIME ZONE,
  date_updated TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(connection_id, shoprenter_id)
);

-- Indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_connection ON public.shoprenter_categories(connection_id);
CREATE INDEX IF NOT EXISTS idx_categories_shoprenter_id ON public.shoprenter_categories(shoprenter_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.shoprenter_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_categories_status ON public.shoprenter_categories(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_sync_status ON public.shoprenter_categories(sync_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_url_slug ON public.shoprenter_categories(url_slug) WHERE deleted_at IS NULL;

-- Category descriptions table (multi-language)
CREATE TABLE IF NOT EXISTS public.shoprenter_category_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.shoprenter_categories(id) ON DELETE CASCADE,
  
  -- ShopRenter identifiers
  shoprenter_id TEXT NOT NULL, -- Base64 encoded description ID
  language_id TEXT NOT NULL, -- ShopRenter language ID
  
  -- Description data
  name TEXT,
  meta_keywords TEXT,
  meta_description TEXT,
  description TEXT, -- Long description (HTML)
  custom_title TEXT,
  robots_meta_tag TEXT DEFAULT '0',
  footer_seo_text TEXT,
  heading TEXT,
  short_description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(category_id, language_id)
);

-- Indexes for category descriptions
CREATE INDEX IF NOT EXISTS idx_category_descriptions_category ON public.shoprenter_category_descriptions(category_id);
CREATE INDEX IF NOT EXISTS idx_category_descriptions_language ON public.shoprenter_category_descriptions(language_id);
CREATE INDEX IF NOT EXISTS idx_category_descriptions_shoprenter_id ON public.shoprenter_category_descriptions(shoprenter_id);

-- Product-Category Relations table
CREATE TABLE IF NOT EXISTS public.shoprenter_product_category_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- ShopRenter identifiers
  shoprenter_id TEXT NOT NULL, -- Base64 encoded relation ID
  
  -- Relations
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.shoprenter_categories(id) ON DELETE CASCADE,
  
  -- ShopRenter IDs for sync
  product_shoprenter_id TEXT NOT NULL,
  category_shoprenter_id TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(connection_id, shoprenter_id),
  UNIQUE(product_id, category_id) -- One product can only be in a category once
);

-- Indexes for product-category relations
CREATE INDEX IF NOT EXISTS idx_product_category_relations_product ON public.shoprenter_product_category_relations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_category_relations_category ON public.shoprenter_product_category_relations(category_id);
CREATE INDEX IF NOT EXISTS idx_product_category_relations_connection ON public.shoprenter_product_category_relations(connection_id);
CREATE INDEX IF NOT EXISTS idx_product_category_relations_shoprenter_id ON public.shoprenter_product_category_relations(shoprenter_id);

-- Category AI Generation History table
CREATE TABLE IF NOT EXISTS public.category_description_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.shoprenter_categories(id) ON DELETE CASCADE,
  
  -- Generation data
  generated_description TEXT NOT NULL,
  model TEXT DEFAULT 'claude-3-5-sonnet-20241022',
  tokens_used INTEGER,
  source_products_count INTEGER, -- How many products were analyzed
  
  -- Metadata
  generation_instructions TEXT,
  language TEXT DEFAULT 'hu',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for category generations
CREATE INDEX IF NOT EXISTS idx_category_generations_category ON public.category_description_generations(category_id);
CREATE INDEX IF NOT EXISTS idx_category_generations_created_at ON public.category_description_generations(created_at DESC);

-- RLS Policies
ALTER TABLE public.shoprenter_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoprenter_category_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoprenter_product_category_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_description_generations ENABLE ROW LEVEL SECURITY;

-- Categories: All authenticated users can view categories
CREATE POLICY "Categories are viewable by authenticated users" ON public.shoprenter_categories
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Categories: Only users with /categories page permission can manage categories
CREATE POLICY "Only authorized users can manage categories" ON public.shoprenter_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/categories' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/categories' 
      AND up.can_access = true
    )
  );

-- Category descriptions: All authenticated users can view descriptions
CREATE POLICY "Category descriptions are viewable by authenticated users" ON public.shoprenter_category_descriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_categories sc
      WHERE sc.id = shoprenter_category_descriptions.category_id
      AND sc.deleted_at IS NULL
    )
  );

-- Category descriptions: Only users with /categories page permission can manage descriptions
CREATE POLICY "Only authorized users can manage category descriptions" ON public.shoprenter_category_descriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/categories' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/categories' 
      AND up.can_access = true
    )
  );

-- Product-category relations: All authenticated users can view relations
CREATE POLICY "Product-category relations are viewable by authenticated users" ON public.shoprenter_product_category_relations
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Product-category relations: Only users with /categories or /products page permission can manage relations
CREATE POLICY "Only authorized users can manage product-category relations" ON public.shoprenter_product_category_relations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND (p.path = '/categories' OR p.path = '/products')
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND (p.path = '/categories' OR p.path = '/products')
      AND up.can_access = true
    )
  );

-- Category generations: All authenticated users can view generations
CREATE POLICY "Category generations are viewable by authenticated users" ON public.category_description_generations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_categories sc
      WHERE sc.id = category_description_generations.category_id
      AND sc.deleted_at IS NULL
    )
  );

-- Category generations: Only users with /categories page permission can insert generations
CREATE POLICY "Only authorized users can insert category generations" ON public.category_description_generations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/categories' 
      AND up.can_access = true
    )
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoprenter_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoprenter_category_descriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoprenter_product_category_relations TO authenticated;
GRANT SELECT, INSERT ON public.category_description_generations TO authenticated;

-- Add /categories page to pages table
INSERT INTO public.pages (path, name, description, category) VALUES
  ('/categories', 'Kategóriák', 'ShopRenter kategóriák kezelése', 'Törzsadatok')
ON CONFLICT (path) DO NOTHING;
