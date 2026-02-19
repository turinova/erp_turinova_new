-- Shop Portal Webshop Connections Migration
-- Creates table for managing webshop connections (ShopRenter, Unas, Shopify, etc.)
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Create webshop_connections table
CREATE TABLE IF NOT EXISTS public.webshop_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL, -- "Előtag" (prefix/name for the connection)
  connection_type VARCHAR(50) NOT NULL DEFAULT 'shoprenter', -- 'shoprenter', 'unas', 'shopify'
  api_url TEXT NOT NULL, -- ShopRenter API URL
  username VARCHAR(255) NOT NULL,
  password TEXT NOT NULL, -- TODO: Encrypt in production (currently stored as-is like main-app)
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  last_test_status VARCHAR(50), -- 'success', 'failed', null
  last_test_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webshop_connections_type ON public.webshop_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_webshop_connections_active ON public.webshop_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_webshop_connections_deleted ON public.webshop_connections(deleted_at);
CREATE INDEX IF NOT EXISTS idx_webshop_connections_name ON public.webshop_connections(name);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.webshop_connections ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- All authenticated users can view connections
DROP POLICY IF EXISTS "Webshop connections are viewable by authenticated users" ON public.webshop_connections;
CREATE POLICY "Webshop connections are viewable by authenticated users" ON public.webshop_connections
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Only users with /connections page permission can manage connections
DROP POLICY IF EXISTS "Only admins can manage webshop connections" ON public.webshop_connections;
CREATE POLICY "Only admins can manage webshop connections" ON public.webshop_connections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/connections' 
      AND up.can_access = true
    )
  );

-- 5. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webshop_connections TO authenticated;

-- 6. Add /connections page to pages table
INSERT INTO public.pages (path, name, description, category) VALUES
  ('/connections', 'Kapcsolatok', 'Webshop kapcsolatok kezelése', 'Beállítások')
ON CONFLICT (path) DO NOTHING;
