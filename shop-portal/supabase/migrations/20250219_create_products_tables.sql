-- Shop Portal Products Migration
-- Creates tables for managing ShopRenter products and descriptions
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Create shoprenter_products table
CREATE TABLE IF NOT EXISTS public.shoprenter_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- ShopRenter IDs (for sync)
  shoprenter_id TEXT NOT NULL,
  shoprenter_inner_id TEXT,
  sku TEXT NOT NULL,
  
  -- Basic Info (just enough to identify)
  name TEXT, -- Primary name from description
  
  -- Status
  status INTEGER DEFAULT 1, -- 1=active, 0=inactive
  
  -- Sync Metadata
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending', -- 'synced', 'pending', 'error'
  sync_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(connection_id, shoprenter_id),
  UNIQUE(connection_id, sku)
);

-- 2. Create shoprenter_product_descriptions table
CREATE TABLE IF NOT EXISTS public.shoprenter_product_descriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL DEFAULT 'hu', -- 'hu', 'en', etc.
  
  -- SEO & Content Fields
  name TEXT NOT NULL,
  meta_title TEXT,
  meta_keywords TEXT,
  meta_description TEXT,
  short_description TEXT,
  description TEXT,
  
  -- ShopRenter Sync
  shoprenter_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, language_code)
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_connection ON public.shoprenter_products(connection_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.shoprenter_products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.shoprenter_products(status);
CREATE INDEX IF NOT EXISTS idx_products_sync_status ON public.shoprenter_products(sync_status);
CREATE INDEX IF NOT EXISTS idx_descriptions_product ON public.shoprenter_product_descriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_descriptions_language ON public.shoprenter_product_descriptions(language_code);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.shoprenter_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoprenter_product_descriptions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for shoprenter_products
-- All authenticated users can view products
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON public.shoprenter_products;
CREATE POLICY "Products are viewable by authenticated users" ON public.shoprenter_products
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Only users with /products page permission can manage products
DROP POLICY IF EXISTS "Only authorized users can manage products" ON public.shoprenter_products;
CREATE POLICY "Only authorized users can manage products" ON public.shoprenter_products
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

-- 6. Create RLS Policies for shoprenter_product_descriptions
-- All authenticated users can view descriptions
DROP POLICY IF EXISTS "Descriptions are viewable by authenticated users" ON public.shoprenter_product_descriptions;
CREATE POLICY "Descriptions are viewable by authenticated users" ON public.shoprenter_product_descriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

-- Only users with /products page permission can manage descriptions
DROP POLICY IF EXISTS "Only authorized users can manage descriptions" ON public.shoprenter_product_descriptions;
CREATE POLICY "Only authorized users can manage descriptions" ON public.shoprenter_product_descriptions
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

-- 7. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoprenter_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoprenter_product_descriptions TO authenticated;

-- 8. Add /products page to pages table
INSERT INTO public.pages (path, name, description, category) VALUES
  ('/products', 'Termékek', 'ShopRenter termékek kezelése', 'Törzsadatok')
ON CONFLICT (path) DO NOTHING;
