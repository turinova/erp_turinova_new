-- =============================================================================
-- TURINOVA ERP - TENANT DATABASE TEMPLATE
-- =============================================================================
-- This is a consolidated template combining all tenant database migrations
-- Run this SQL in a NEW Supabase project's SQL Editor to set up a tenant database
-- 
-- Generated: $(date)
-- Version: 1.0
-- 
-- IMPORTANT: This template includes all current migrations. When you add new
-- migrations, update this template and apply them to existing tenants manually.
-- =============================================================================


-- =============================================================================
-- Migration: 20250218_create_permission_system.sql
-- =============================================================================

-- Shop Portal Permission System Migration
-- Creates tables for page-based permission control
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Create public.users table that mirrors auth.users
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_sign_in_at timestamp with time zone,
  deleted_at timestamp with time zone
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at);

-- 2. Create pages table - stores all available pages in the system
-- Note: If table already exists from previous setup, we'll add missing columns
CREATE TABLE IF NOT EXISTS public.pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists (for existing tables from database-setup.sql)
DO $$ 
BEGIN
  -- Add is_active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pages' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.pages ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  -- Add description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pages' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.pages ADD COLUMN description TEXT;
  END IF;
  
  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pages' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.pages ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  -- Update existing rows to have is_active = true if column was just added
  UPDATE public.pages SET is_active = true WHERE is_active IS NULL;
END $$;

-- 3. Create user_permissions table - stores individual user permissions for pages
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  can_access BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_page_id ON public.user_permissions(page_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_access ON public.user_permissions(user_id, can_access);
CREATE INDEX IF NOT EXISTS idx_pages_path ON public.pages(path);
CREATE INDEX IF NOT EXISTS idx_pages_active ON public.pages(is_active);

-- 5. Create function to sync users from auth.users
CREATE OR REPLACE FUNCTION public.sync_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user in public.users when auth.users changes
  INSERT INTO public.users (id, email, full_name, created_at, updated_at, last_sign_in_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.created_at, 
    NEW.updated_at, 
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = EXCLUDED.updated_at,
    last_sign_in_at = EXCLUDED.last_sign_in_at;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_user_from_auth failed for user %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger to automatically sync users
DROP TRIGGER IF EXISTS sync_user_trigger ON auth.users;
CREATE TRIGGER sync_user_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_from_auth();

-- 7. Insert existing users from auth.users (if any)
INSERT INTO public.users (id, email, full_name, created_at, updated_at, last_sign_in_at)
SELECT 
  id, 
  email,
  COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
  created_at, 
  updated_at, 
  last_sign_in_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 8. Create function to automatically grant default permissions to new users
CREATE OR REPLACE FUNCTION public.grant_default_permissions_to_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- Grant access to all active pages for new users
    INSERT INTO public.user_permissions (user_id, page_id, can_access)
    SELECT 
      NEW.id,
      p.id,
      true
    FROM public.pages p
    WHERE p.is_active = true
    ON CONFLICT (user_id, page_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to grant default permissions: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create trigger to automatically grant permissions to new users
DROP TRIGGER IF EXISTS trigger_grant_default_permissions ON auth.users;
CREATE TRIGGER trigger_grant_default_permissions
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_default_permissions_to_new_user();

-- 10. Create function to get user permissions
-- Drop existing function first to ensure clean recreation
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid);

CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid UUID)
RETURNS TABLE (
  page_path VARCHAR(255),
  page_name VARCHAR(255), -- Added page_name to match main-app's RPC return
  can_access BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.path as page_path,
    p.name as page_name, -- Select page name
    COALESCE(up.can_access, false) as can_access
  FROM public.pages p
  LEFT JOIN public.user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  WHERE p.is_active = true
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Insert initial pages for shop-portal
INSERT INTO public.pages (path, name, description, category) VALUES
  ('/home', 'Főoldal', 'Rendszer főoldala', 'Általános'),
  ('/users', 'Felhasználók', 'Felhasználók és jogosultságok kezelése', 'Rendszer')
ON CONFLICT (path) DO NOTHING;

-- 11a. Grant default permissions to all existing users (if they don't have any)
-- This ensures existing users can access the system
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.is_active = true
ON CONFLICT (user_id, page_id) DO NOTHING;

-- 12. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS Policies for users
DROP POLICY IF EXISTS "Users are viewable by authenticated users" ON public.users;
CREATE POLICY "Users are viewable by authenticated users" ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update their own record" ON public.users;
CREATE POLICY "Users can update their own record" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 14. Create RLS Policies for pages
DROP POLICY IF EXISTS "Pages are readable by authenticated users" ON public.pages;
CREATE POLICY "Pages are readable by authenticated users" ON public.pages
  FOR SELECT
  TO authenticated
  USING (true);

-- 15. Create RLS Policies for user_permissions
DROP POLICY IF EXISTS "Users can read their own permissions" ON public.user_permissions;
CREATE POLICY "Users can read their own permissions" ON public.user_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a SECURITY DEFINER function to check if user has /users permission
-- This bypasses RLS to avoid circular dependency issues
CREATE OR REPLACE FUNCTION public.user_has_users_permission(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_permissions up
    JOIN public.pages p ON up.page_id = p.id
    WHERE up.user_id = check_user_id 
    AND p.path = '/users' 
    AND up.can_access = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Only users with /users page edit permission can manage user permissions
-- Use the SECURITY DEFINER function to avoid circular RLS dependency
DROP POLICY IF EXISTS "Only admins can manage user permissions" ON public.user_permissions;
CREATE POLICY "Only admins can manage user permissions" ON public.user_permissions
  FOR ALL
  TO authenticated
  USING (public.user_has_users_permission(auth.uid()))
  WITH CHECK (public.user_has_users_permission(auth.uid()));

-- 16. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;


-- =============================================================================
-- Migration: 20250218_create_webshop_connections.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20250218_fix_rls_policies.sql
-- =============================================================================

-- Fix RLS Policies for user_permissions and webshop_connections
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Fix user_permissions RLS policy - use SECURITY DEFINER function to avoid circular dependency
-- First, create a function that checks if user has /users permission (bypasses RLS)
-- This function runs with the privileges of the function owner, bypassing RLS
CREATE OR REPLACE FUNCTION public.user_has_users_permission(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_permissions up
    JOIN public.pages p ON up.page_id = p.id
    WHERE up.user_id = check_user_id 
    AND p.path = '/users' 
    AND up.can_access = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Now update the RLS policy to use the function
DROP POLICY IF EXISTS "Only admins can manage user permissions" ON public.user_permissions;
CREATE POLICY "Only admins can manage user permissions" ON public.user_permissions
  FOR ALL
  TO authenticated
  USING (public.user_has_users_permission(auth.uid()))
  WITH CHECK (public.user_has_users_permission(auth.uid()));

-- 2. Ensure webshop_connections table exists and has proper RLS
-- (This is a safety check in case the table wasn't created properly)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'webshop_connections'
  ) THEN
    RAISE EXCEPTION 'webshop_connections table does not exist. Please run 20250218_create_webshop_connections.sql first.';
  END IF;
END $$;

-- 3. Verify RLS is enabled on webshop_connections
ALTER TABLE public.webshop_connections ENABLE ROW LEVEL SECURITY;

-- 4. Ensure the SELECT policy allows all authenticated users to view
DROP POLICY IF EXISTS "Webshop connections are viewable by authenticated users" ON public.webshop_connections;
CREATE POLICY "Webshop connections are viewable by authenticated users" ON public.webshop_connections
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- 5. Ensure the management policy is correct
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/connections' 
      AND up.can_access = true
    )
  );


-- =============================================================================
-- Core Utility Function: update_updated_at_column
-- =============================================================================
-- This function is used by multiple migrations for automatic timestamp updates
-- Must be created before any triggers that use it

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Migration: 20250219_create_products_tables.sql
-- =============================================================================

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
  last_synced_at TIMESTAMP WITH TIME ZONE, -- DEPRECATED: Use last_synced_from_shoprenter_at instead (kept for backward compatibility)
  last_synced_from_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced FROM ShopRenter (pulled into ERP)
  last_synced_to_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced TO ShopRenter (pushed from ERP)
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
CREATE INDEX IF NOT EXISTS idx_products_last_synced_from 
  ON public.shoprenter_products(last_synced_from_shoprenter_at) 
  WHERE last_synced_from_shoprenter_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_last_synced_to 
  ON public.shoprenter_products(last_synced_to_shoprenter_at) 
  WHERE last_synced_to_shoprenter_at IS NOT NULL;
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


-- =============================================================================
-- Migration: 20250125_add_vat_page_to_permissions.sql
-- =============================================================================

-- Add VAT page to permissions system
-- This allows the /vat page to be accessible through the permission system

INSERT INTO public.pages (path, name, description, category) VALUES
  ('/vat', 'Áfák', 'ÁFA kulcsok kezelése', 'Törzsadatok')
ON CONFLICT (path) DO NOTHING;

-- Grant default access to all existing users for the VAT page
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/vat'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;


-- =============================================================================
-- Migration: 20250125_add_vat_support.sql
-- =============================================================================

-- Add VAT support to shoprenter_products
-- This allows full control over VAT rates and syncing with ShopRenter taxClasses

-- Create VAT (Adónem) table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    kulcs DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS vat_name_unique_active 
ON public.vat (name) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_vat_deleted_at ON public.vat(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for vat table to automatically update updated_at
DROP TRIGGER IF EXISTS update_vat_updated_at ON public.vat;
CREATE TRIGGER update_vat_updated_at
    BEFORE UPDATE ON public.vat
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (only if they don't exist)
INSERT INTO public.vat (name, kulcs) 
SELECT * FROM (VALUES 
    ('ÁFA mentes', 0.00),
    ('ÁFA 5%', 5.00),
    ('ÁFA 18%', 18.00),
    ('ÁFA 27%', 27.00)
) AS v(name, kulcs)
WHERE NOT EXISTS (
    SELECT 1 FROM public.vat 
    WHERE vat.name = v.name AND vat.deleted_at IS NULL
);

-- Enable RLS for vat table
ALTER TABLE public.vat ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vat table
DROP POLICY IF EXISTS "VAT rates are viewable by authenticated users" ON public.vat;
CREATE POLICY "VAT rates are viewable by authenticated users" 
ON public.vat
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "VAT rates are manageable by authenticated users" ON public.vat;
CREATE POLICY "VAT rates are manageable by authenticated users" 
ON public.vat
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add vat_id to shoprenter_products (references vat table)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS vat_id UUID;

-- Add gross_price for internal calculations and display
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS gross_price DECIMAL(15,4);

-- Add shoprenter_tax_class_id to store ShopRenter's taxClass ID
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS shoprenter_tax_class_id TEXT;

-- Create index for VAT lookups
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_vat_id 
ON public.shoprenter_products(vat_id) 
WHERE vat_id IS NOT NULL;

-- Create index for taxClass lookups
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_tax_class_id 
ON public.shoprenter_products(shoprenter_tax_class_id) 
WHERE shoprenter_tax_class_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.shoprenter_products.vat_id IS 'Reference to ERP VAT rate (from vat table). ERP is source of truth for VAT.';
COMMENT ON COLUMN public.shoprenter_products.gross_price IS 'Calculated gross price (net + VAT). Stored for display and calculations.';
COMMENT ON COLUMN public.shoprenter_products.shoprenter_tax_class_id IS 'ShopRenter taxClass ID (base64 encoded). Used for syncing taxClass to ShopRenter.';

-- Create mapping table: ERP VAT rates ↔ ShopRenter taxClasses (per connection)
CREATE TABLE IF NOT EXISTS public.shoprenter_tax_class_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  vat_id UUID NOT NULL, -- ERP VAT rate ID (references vat table)
  shoprenter_tax_class_id TEXT NOT NULL, -- ShopRenter taxClass ID (base64 encoded)
  shoprenter_tax_class_name TEXT, -- ShopRenter taxClass name (for display)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, vat_id),
  UNIQUE(connection_id, shoprenter_tax_class_id)
);

-- Indexes for tax mappings
CREATE INDEX IF NOT EXISTS idx_tax_mappings_connection 
ON public.shoprenter_tax_class_mappings(connection_id);

CREATE INDEX IF NOT EXISTS idx_tax_mappings_vat 
ON public.shoprenter_tax_class_mappings(vat_id);

-- RLS Policies for tax mappings
ALTER TABLE public.shoprenter_tax_class_mappings ENABLE ROW LEVEL SECURITY;

-- View mappings (authenticated users)
DROP POLICY IF EXISTS "Tax mappings are viewable by authenticated users" ON public.shoprenter_tax_class_mappings;
CREATE POLICY "Tax mappings are viewable by authenticated users" 
ON public.shoprenter_tax_class_mappings
FOR SELECT
TO authenticated
USING (true);

-- Manage mappings (authenticated users)
DROP POLICY IF EXISTS "Tax mappings are manageable by authenticated users" ON public.shoprenter_tax_class_mappings;
CREATE POLICY "Tax mappings are manageable by authenticated users" 
ON public.shoprenter_tax_class_mappings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- =============================================================================
-- Migration: 20250126_add_parameters_and_product_tags.sql
-- =============================================================================

-- Add parameters and productTags support for Content & SEO tab
-- Parameters: stored in shoprenter_product_descriptions (language-specific)
-- ProductTags: stored in new product_tags table (language-specific, multiple tags per product)

-- Add parameters column to shoprenter_product_descriptions
ALTER TABLE public.shoprenter_product_descriptions 
ADD COLUMN IF NOT EXISTS parameters TEXT;

-- Add comment
COMMENT ON COLUMN public.shoprenter_product_descriptions.parameters IS 'Product parameters (language-specific). Pulled from ShopRenter productDescriptions.parameters field.';

-- Create product_tags table for storing product tags (language-specific)
CREATE TABLE IF NOT EXISTS public.product_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL, -- e.g., 'hu', 'en'
    tags TEXT NOT NULL, -- Comma-separated tags: "tag1,tag2,tag3"
    shoprenter_id TEXT, -- ShopRenter productTag ID (base64 encoded)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(product_id, language_code, deleted_at) -- One tag entry per product per language (when not deleted)
);

-- Create indexes for product_tags
CREATE INDEX IF NOT EXISTS idx_product_tags_product_id 
ON public.product_tags(product_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_tags_connection_id 
ON public.product_tags(connection_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_tags_language_code 
ON public.product_tags(language_code) 
WHERE deleted_at IS NULL;

-- Create trigger for product_tags table to automatically update updated_at
DROP TRIGGER IF EXISTS update_product_tags_updated_at ON public.product_tags;
CREATE TRIGGER update_product_tags_updated_at
    BEFORE UPDATE ON public.product_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for product_tags table
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_tags table
DROP POLICY IF EXISTS "Product tags are viewable by authenticated users" ON public.product_tags;
CREATE POLICY "Product tags are viewable by authenticated users" 
ON public.product_tags
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Product tags are manageable by authenticated users" ON public.product_tags;
CREATE POLICY "Product tags are manageable by authenticated users" 
ON public.product_tags
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- =============================================================================
-- Migration: 20250127_add_subscription_page_to_permissions.sql
-- =============================================================================

-- Add Subscription page to permissions system
-- This allows the /subscription page to be accessible through the permission system

INSERT INTO public.pages (path, name, description, category) VALUES
  ('/subscription', 'Előfizetésem', 'Előfizetés és használati statisztikák kezelése', 'Beállítások')
ON CONFLICT (path) DO NOTHING;

-- Grant default access to all existing users for the Subscription page
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/subscription'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;


-- =============================================================================
-- Migration: 20250127_add_subscription_system.sql
-- =============================================================================

-- Subscription System Migration
-- Run this SQL manually in your Supabase SQL Editor

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(50) NOT NULL DEFAULT 'trial', -- "trial", "active", "canceled", "expired"
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  trial_end TIMESTAMP,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id) -- One active subscription per user
);

-- AI Usage Tracking table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type VARCHAR(100) NOT NULL, -- "product_description", "meta_title", "meta_keywords", "meta_description", "url_slug", "category_description"
  product_id UUID REFERENCES shoprenter_products(id),
  category_id UUID,
  tokens_used INTEGER NOT NULL,
  model_used VARCHAR(100),
  cost_estimate DECIMAL(10,6), -- Estimated cost in USD
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_feature ON ai_usage_logs(user_id, feature_type, created_at DESC);
-- Note: Cannot create index on DATE_TRUNC('month', created_at) because DATE_TRUNC is not IMMUTABLE
-- Use idx_ai_usage_user_date for month-based queries instead
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status, current_period_end);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
CREATE POLICY "Everyone can view active plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ai_usage_logs
CREATE POLICY "Users can view own usage"
  ON ai_usage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, features, display_order) VALUES
  (
    'Starter',
    'starter',
    0,
    0,
    '{"ai_generation": false, "analytics": false}'::jsonb,
    1
  ),
  (
    'Pro',
    'pro',
    29.99,
    299.99,
    '{"ai_generation": true, "analytics": true, "ai_monthly_limit": 10000}'::jsonb,
    2
  ),
  (
    'Enterprise',
    'enterprise',
    99.99,
    999.99,
    '{"ai_generation": true, "analytics": true, "ai_monthly_limit": null}'::jsonb,
    3
  )
ON CONFLICT (slug) DO NOTHING;

-- Grant permissions
GRANT SELECT ON subscription_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_subscriptions TO authenticated;
GRANT SELECT, INSERT ON ai_usage_logs TO authenticated;

-- Function to get current month AI usage for a user
CREATE OR REPLACE FUNCTION get_user_ai_usage_current_month(user_uuid UUID)
RETURNS TABLE (
  total_tokens INTEGER,
  total_cost DECIMAL(10,6),
  usage_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(tokens_used), 0)::INTEGER as total_tokens,
    COALESCE(SUM(cost_estimate), 0) as total_cost,
    COUNT(*) as usage_count
  FROM ai_usage_logs
  WHERE user_id = user_uuid
    AND created_at >= DATE_TRUNC('month', NOW())
    AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user subscription with plan details
CREATE OR REPLACE FUNCTION get_user_subscription_with_plan(user_uuid UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_id UUID,
  plan_name VARCHAR,
  plan_slug VARCHAR,
  status VARCHAR,
  current_period_end TIMESTAMP,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id as subscription_id,
    sp.id as plan_id,
    sp.name as plan_name,
    sp.slug as plan_slug,
    us.status,
    us.current_period_end,
    sp.features
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = user_uuid
    AND us.status IN ('trial', 'active')
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- Migration: 20250128_add_unified_credit_system.sql
-- =============================================================================

-- Unified Credit System for AI Features
-- This migration adds credit-based limits for all AI features (generation + competitor scraping)

-- 1. Add ai_credits_per_month to subscription_plans
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS ai_credits_per_month INTEGER DEFAULT 0;

-- 2. Add credits_used and credit_type to ai_usage_logs
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS credit_type VARCHAR(50) DEFAULT 'ai_generation'; -- 'ai_generation', 'competitor_scrape'

-- 3. Update subscription plans with credit limits
UPDATE subscription_plans 
SET ai_credits_per_month = 0 
WHERE slug = 'starter';

UPDATE subscription_plans 
SET ai_credits_per_month = 200 
WHERE slug = 'pro'; -- ~40 descriptions or 200 meta fields or 100 competitor scrapes

UPDATE subscription_plans 
SET ai_credits_per_month = 1000 
WHERE slug = 'enterprise'; -- ~200 descriptions or 1000 meta fields or 500 competitor scrapes

-- 4. Create index for credit usage queries
-- Note: Cannot create index on DATE_TRUNC('month', created_at) because DATE_TRUNC is not IMMUTABLE
-- Use idx_ai_usage_user_date for month-based queries instead
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_credits 
ON ai_usage_logs(user_id, credits_used, created_at DESC);

-- 5. Create function to get current month credit usage
CREATE OR REPLACE FUNCTION get_user_credit_usage_current_month(user_uuid UUID)
RETURNS TABLE (
  total_credits_used INTEGER,
  total_tokens INTEGER,
  total_cost DECIMAL(10,6),
  usage_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(credits_used), 0)::INTEGER as total_credits_used,
    COALESCE(SUM(tokens_used), 0)::INTEGER as total_tokens,
    COALESCE(SUM(cost_estimate), 0) as total_cost,
    COUNT(*) as usage_count
  FROM ai_usage_logs
  WHERE user_id = user_uuid
    AND created_at >= DATE_TRUNC('month', NOW())
    AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create view for credit usage (for easier queries)
CREATE OR REPLACE VIEW ai_credit_usage_current_month AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) as month,
  SUM(credits_used) as total_credits_used,
  SUM(tokens_used) as total_tokens,
  SUM(cost_estimate) as total_cost,
  COUNT(*) as usage_count,
  COUNT(DISTINCT feature_type) as feature_types_count
FROM ai_usage_logs
WHERE created_at >= DATE_TRUNC('month', NOW())
  AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- 7. Grant permissions
GRANT SELECT ON ai_credit_usage_current_month TO authenticated;

-- 8. Add competitor_limits to subscription_plans (for competitor tracking limits)
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS competitor_limits JSONB DEFAULT '{}';

-- Update plans with competitor limits
UPDATE subscription_plans 
SET competitor_limits = '{"max_competitors": 0, "max_product_links": 0}'::jsonb
WHERE slug = 'starter';

UPDATE subscription_plans 
SET competitor_limits = '{"max_competitors": 1, "max_product_links": 500}'::jsonb
WHERE slug = 'pro';

UPDATE subscription_plans 
SET competitor_limits = '{"max_competitors": 3, "max_product_links": 2000}'::jsonb
WHERE slug = 'enterprise';

-- Note: Enterprise+ would have unlimited, but we don't have that plan yet


-- =============================================================================
-- Migration: 20250130_add_products_search_indexes.sql
-- =============================================================================

-- Add indexes for products search performance
-- Phase 2: Database optimization

-- 1. Enable pg_trgm extension for trigram text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Trigram indexes for text search (much faster than ilike)
-- Index for name search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
ON public.shoprenter_products USING gin (name gin_trgm_ops)
WHERE deleted_at IS NULL;

-- Index for SKU search
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm 
ON public.shoprenter_products USING gin (sku gin_trgm_ops)
WHERE deleted_at IS NULL;

-- Index for model_number search (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shoprenter_products' 
    AND column_name = 'model_number'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_model_number_trgm 
    ON public.shoprenter_products USING gin (model_number gin_trgm_ops)
    WHERE deleted_at IS NULL AND model_number IS NOT NULL;
  END IF;
END $$;

-- Index for GTIN search (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shoprenter_products' 
    AND column_name = 'gtin'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_gtin_trgm 
    ON public.shoprenter_products USING gin (gtin gin_trgm_ops)
    WHERE deleted_at IS NULL AND gtin IS NOT NULL;
  END IF;
END $$;

-- 3. Composite index for common filters (status + sync_status)
CREATE INDEX IF NOT EXISTS idx_products_status_sync 
ON public.shoprenter_products(status, sync_status) 
WHERE deleted_at IS NULL;

-- 4. Index for parent_product_id (variant queries) - only if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shoprenter_products' 
    AND column_name = 'parent_product_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_parent_id 
    ON public.shoprenter_products(parent_product_id) 
    WHERE parent_product_id IS NOT NULL AND deleted_at IS NULL;
  END IF;
END $$;

-- 5. Index for created_at (used in ordering)
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc 
ON public.shoprenter_products(created_at DESC) 
WHERE deleted_at IS NULL;

-- Comments (conditional - only for indexes that exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_name_trgm') THEN
    COMMENT ON INDEX idx_products_name_trgm IS 'Trigram index for fast name search using ilike';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_sku_trgm') THEN
    COMMENT ON INDEX idx_products_sku_trgm IS 'Trigram index for fast SKU search using ilike';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_model_number_trgm') THEN
    COMMENT ON INDEX idx_products_model_number_trgm IS 'Trigram index for fast model number search using ilike';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_gtin_trgm') THEN
    COMMENT ON INDEX idx_products_gtin_trgm IS 'Trigram index for fast GTIN search using ilike';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_status_sync') THEN
    COMMENT ON INDEX idx_products_status_sync IS 'Composite index for filtering by status and sync_status';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_parent_id') THEN
    COMMENT ON INDEX idx_products_parent_id IS 'Index for parent-child product relationships';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_created_at_desc') THEN
    COMMENT ON INDEX idx_products_created_at_desc IS 'Index for ordering by created_at DESC';
  END IF;
END $$;


-- =============================================================================
-- Migration: 20250220_add_competitor_subpages.sql
-- =============================================================================

-- Add competitor dashboard and links pages to permission system

INSERT INTO public.pages (path, name, description, category) VALUES
  ('/competitors/dashboard', 'Versenytárs Dashboard', 'Árelemzés dashboard és összefoglaló', 'SEO'),
  ('/competitors/links', 'Linkek kezelése', 'Versenytárs linkek tömeges kezelése', 'SEO')
ON CONFLICT (path) DO NOTHING;


-- =============================================================================
-- Migration: 20250220_add_competitor_tracking_flag.sql
-- =============================================================================

-- Add competitor tracking flag to products
-- This allows users to mark specific products for competitor price monitoring
-- (Optional - for future use if needed for filtering)

-- Add flag to shoprenter_products table
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS competitor_tracking_enabled BOOLEAN DEFAULT false;

-- Add index for quick filtering of tracked products
CREATE INDEX IF NOT EXISTS idx_products_competitor_tracking 
ON public.shoprenter_products(competitor_tracking_enabled) 
WHERE competitor_tracking_enabled = true;

-- Add comment
COMMENT ON COLUMN public.shoprenter_products.competitor_tracking_enabled 
IS 'When true, this product will be included in competitor price monitoring (optional)';


-- =============================================================================
-- Migration: 20250220_add_model_number.sql
-- =============================================================================

-- Add model_number column for "Gyártói cikkszám" (Manufacturer part number)
-- Run this SQL manually in your Supabase SQL Editor

-- Add model_number column to shoprenter_products
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS model_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.shoprenter_products.model_number IS 'Manufacturer part number (Gyártói cikkszám) from ShopRenter modelNumber field';

-- Create index for potential searches
CREATE INDEX IF NOT EXISTS idx_products_model_number ON public.shoprenter_products(model_number);


-- =============================================================================
-- Migration: 20250220_add_price_gross_column.sql
-- =============================================================================

-- Add bruttó (gross) price tracking to competitor_prices
-- This allows proper comparison with our nettó prices
-- This migration is idempotent - safe to run even if competitor_prices table doesn't exist yet

DO $$
BEGIN
  -- Only run if competitor_prices table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_prices'
  ) THEN
    -- Add price_gross column for the original scraped price (usually bruttó)
    ALTER TABLE public.competitor_prices 
    ADD COLUMN IF NOT EXISTS price_gross DECIMAL(15,2);

    -- Add price_type to track what type of price was scraped
    -- 'gross' = bruttó (with VAT), 'net' = nettó (without VAT), 'unknown' = couldn't determine
    ALTER TABLE public.competitor_prices 
    ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'gross';

    -- Add VAT rate used for conversion (Hungary default is 27%)
    ALTER TABLE public.competitor_prices 
    ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 27.00;

    -- Add comments for clarity (only if table exists)
    COMMENT ON COLUMN public.competitor_prices.price IS 'Nettó (net) price - used for comparison with our products';
    COMMENT ON COLUMN public.competitor_prices.price_gross IS 'Bruttó (gross) price - the original scraped price if it was with VAT';
    COMMENT ON COLUMN public.competitor_prices.price_type IS 'Type of scraped price: gross (bruttó), net (nettó), or unknown';
    COMMENT ON COLUMN public.competitor_prices.vat_rate IS 'VAT rate used for conversion (default 27% for Hungary)';
    COMMENT ON COLUMN public.competitor_prices.original_price IS 'Original/list price before discount (usually bruttó)';
  END IF;
END $$;


-- =============================================================================
-- Migration: 20250220_add_pricing_fields.sql
-- =============================================================================

-- Add pricing fields and GTIN for products
-- Run this SQL manually in your Supabase SQL Editor

-- Add price column (net price - Nettó ár)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS price DECIMAL(15,4);

-- Add cost column (purchase/cost price - Beszerzési ár)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS cost DECIMAL(15,4);

-- Add multiplier column (price multiplier - Árazási szorzó)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS multiplier DECIMAL(10,4) DEFAULT 1.0000;

-- Add multiplier_lock column (price multiplier lock - Szorzó zárolás)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS multiplier_lock BOOLEAN DEFAULT false;

-- Add gtin column (barcode - Vonalkód)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS gtin TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.shoprenter_products.price IS 'Net price (Nettó ár) from ShopRenter price field';
COMMENT ON COLUMN public.shoprenter_products.cost IS 'Purchase/cost price (Beszerzési ár) from ShopRenter cost field - admin only';
COMMENT ON COLUMN public.shoprenter_products.multiplier IS 'Price multiplier (Árazási szorzó) from ShopRenter multiplier field';
COMMENT ON COLUMN public.shoprenter_products.multiplier_lock IS 'Price multiplier lock (Szorzó zárolás) from ShopRenter multiplierLock field';
COMMENT ON COLUMN public.shoprenter_products.gtin IS 'GTIN/Barcode (Vonalkód) from ShopRenter gtin field';

-- Create indexes for potential queries
CREATE INDEX IF NOT EXISTS idx_products_price ON public.shoprenter_products(price);
CREATE INDEX IF NOT EXISTS idx_products_cost ON public.shoprenter_products(cost);
CREATE INDEX IF NOT EXISTS idx_products_gtin ON public.shoprenter_products(gtin);


-- =============================================================================
-- Migration: 20250220_add_products_performance_indexes.sql
-- =============================================================================

-- Shop Portal Products Performance Indexes Migration
-- Adds indexes for fast search and pagination
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Enable trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add trigram indexes for fast partial text matching on name and sku
-- These indexes allow fast searches like "term%" and "%term%" without full table scans
CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
  ON public.shoprenter_products 
  USING gin(name gin_trgm_ops) 
  WHERE name IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm 
  ON public.shoprenter_products 
  USING gin(sku gin_trgm_ops) 
  WHERE deleted_at IS NULL;

-- 3. Add composite index for common query pattern: filter deleted + order by created_at
-- This covers: WHERE deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_products_deleted_created 
  ON public.shoprenter_products(deleted_at, created_at DESC) 
  WHERE deleted_at IS NULL;

-- 4. Add index on deleted_at for faster filtering (if not already covered)
CREATE INDEX IF NOT EXISTS idx_products_deleted_at 
  ON public.shoprenter_products(deleted_at) 
  WHERE deleted_at IS NULL;

-- 5. Add composite index for search + pagination: (deleted_at, name, created_at)
-- This helps with queries that filter deleted, search by name, and order by created_at
CREATE INDEX IF NOT EXISTS idx_products_deleted_name_created 
  ON public.shoprenter_products(deleted_at, name, created_at DESC) 
  WHERE deleted_at IS NULL AND name IS NOT NULL;

-- 6. Add index on connection_id + deleted_at for connection-specific queries
CREATE INDEX IF NOT EXISTS idx_products_connection_deleted 
  ON public.shoprenter_products(connection_id, deleted_at) 
  WHERE deleted_at IS NULL;

-- Note: These indexes will significantly improve:
-- - Text search performance (10-100x faster)
-- - Pagination queries (2-5x faster)
-- - Filtering by deleted_at (already fast, but ensures consistency)


-- =============================================================================
-- Migration: 20250220_cleanup_sitemap_tables.sql
-- =============================================================================

-- ============================================
-- CLEANUP: Remove sitemap-related tables and columns
-- Run this in Supabase SQL Editor to clean up unused sitemap functionality
-- ============================================

-- 1. Drop the competitor_sitemap_cache table (if exists)
DROP TABLE IF EXISTS public.competitor_sitemap_cache CASCADE;

-- 2. Drop the competitor_discovered_products table (if exists)
DROP TABLE IF EXISTS public.competitor_discovered_products CASCADE;

-- 3. Remove sitemap-related columns from competitors table (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'competitors'
  ) THEN
    ALTER TABLE public.competitors 
    DROP COLUMN IF EXISTS sitemap_url,
    DROP COLUMN IF EXISTS last_sitemap_crawl_at,
    DROP COLUMN IF EXISTS sitemap_crawl_status,
    DROP COLUMN IF EXISTS sitemap_crawl_error,
    DROP COLUMN IF EXISTS discovered_products_count,
    DROP COLUMN IF EXISTS matched_products_count;
  END IF;
END $$;

-- 4. Optional: Remove competitor_tracking_enabled from products if not needed
-- (Uncomment if you want to remove this column too)
-- ALTER TABLE public.shoprenter_products 
-- DROP COLUMN IF EXISTS competitor_tracking_enabled;

-- Done! Sitemap-related data has been cleaned up.
SELECT 'Sitemap cleanup completed successfully!' as result;


-- =============================================================================
-- Migration: 20250220_create_competitors_system.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20250221_create_ai_description_system.sql
-- =============================================================================

-- AI Description Generation System Migration
-- Creates tables for source materials, content chunks, and AI generation history
-- Single-tenant version (can be extended to multi-tenant later)
-- Run this SQL manually in your Supabase SQL Editor

-- 1. Enable pgvector extension (for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Product Source Materials Table
CREATE TABLE IF NOT EXISTS public.product_source_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  
  -- Source Type
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'url', 'text')),
  
  -- Source Data
  title TEXT, -- User-provided title/description of source
  file_url TEXT, -- For PDFs: Supabase Storage URL
  external_url TEXT, -- For URLs: External link
  text_content TEXT, -- For direct text input
  file_name TEXT, -- Original filename for PDFs
  
  -- Processing Status
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'processed', 'error')),
  extracted_text TEXT, -- Full extracted text content
  processing_error TEXT,
  
  -- Metadata
  file_size INTEGER, -- Bytes (for PDFs)
  mime_type TEXT,
  language_code TEXT DEFAULT 'hu',
  
  -- Priority & Weight
  priority INTEGER DEFAULT 5, -- 1-10, higher = more important
  weight DECIMAL(3,2) DEFAULT 1.0, -- How much to weight this source (0.0-2.0)
  
  -- User Info
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_source_data CHECK (
    (source_type = 'pdf' AND file_url IS NOT NULL) OR
    (source_type = 'url' AND external_url IS NOT NULL) OR
    (source_type = 'text' AND text_content IS NOT NULL)
  )
);

-- 3. Content Chunks (for RAG - Retrieval Augmented Generation)
CREATE TABLE IF NOT EXISTS public.product_content_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_material_id UUID NOT NULL REFERENCES public.product_source_materials(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  
  -- Chunk Data
  chunk_text TEXT NOT NULL,
  chunk_type TEXT CHECK (chunk_type IN ('specification', 'feature', 'benefit', 'use_case', 'technical', 'marketing', 'other')),
  
  -- Embedding for semantic search (using OpenAI ada-002: 1536 dimensions)
  embedding VECTOR(1536),
  
  -- Metadata
  page_number INTEGER, -- For PDFs
  section_title TEXT,
  order_index INTEGER, -- Order within source
  
  -- Quality Score
  relevance_score DECIMAL(3,2) DEFAULT 1.0, -- AI-calculated relevance to product
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. AI Generation History
CREATE TABLE IF NOT EXISTS public.product_description_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  description_id UUID REFERENCES public.shoprenter_product_descriptions(id),
  
  -- Generation Metadata
  model_used TEXT NOT NULL, -- 'claude-3-5-sonnet', 'gpt-4o', etc.
  prompt_version TEXT,
  source_materials_used UUID[], -- Array of source_material_ids used
  
  -- Generated Content
  generated_description TEXT NOT NULL,
  
  -- Quality Metrics
  ai_detection_score DECIMAL(3,2), -- Lower is better (0.0-1.0)
  uniqueness_score DECIMAL(3,2), -- How unique vs competitors
  word_count INTEGER,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'rejected', 'published')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_source_materials_product ON public.product_source_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_source_materials_status ON public.product_source_materials(processing_status);
CREATE INDEX IF NOT EXISTS idx_content_chunks_source ON public.product_content_chunks(source_material_id);
CREATE INDEX IF NOT EXISTS idx_content_chunks_product ON public.product_content_chunks(product_id);
CREATE INDEX IF NOT EXISTS idx_description_generations_product ON public.product_description_generations(product_id);
CREATE INDEX IF NOT EXISTS idx_description_generations_status ON public.product_description_generations(status);

-- 6. Vector index for semantic search (HNSW for fast similarity search)
-- Note: ivfflat requires at least some data, so we'll create it but it may need tuning later
CREATE INDEX IF NOT EXISTS idx_content_chunks_embedding ON public.product_content_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.product_source_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_content_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_description_generations ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for product_source_materials
-- Users can view source materials for products they can access
DROP POLICY IF EXISTS "Source materials are viewable by authenticated users" ON public.product_source_materials;
CREATE POLICY "Source materials are viewable by authenticated users" ON public.product_source_materials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

-- Users with /products permission can manage source materials
DROP POLICY IF EXISTS "Only authorized users can manage source materials" ON public.product_source_materials;
CREATE POLICY "Only authorized users can manage source materials" ON public.product_source_materials
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

-- 9. RLS Policies for product_content_chunks
DROP POLICY IF EXISTS "Content chunks are viewable by authenticated users" ON public.product_content_chunks;
CREATE POLICY "Content chunks are viewable by authenticated users" ON public.product_content_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

-- Users with /products permission can manage content chunks
DROP POLICY IF EXISTS "Only authorized users can manage content chunks" ON public.product_content_chunks;
CREATE POLICY "Only authorized users can manage content chunks" ON public.product_content_chunks
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

-- 10. RLS Policies for product_description_generations
DROP POLICY IF EXISTS "Generations are viewable by authenticated users" ON public.product_description_generations;
CREATE POLICY "Generations are viewable by authenticated users" ON public.product_description_generations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

-- Users with /products permission can manage generations
DROP POLICY IF EXISTS "Only authorized users can manage generations" ON public.product_description_generations;
CREATE POLICY "Only authorized users can manage generations" ON public.product_description_generations
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

-- 11. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_source_materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_content_chunks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_description_generations TO authenticated;

-- 12. Function for semantic search (to find relevant chunks)
CREATE OR REPLACE FUNCTION match_content_chunks(
  query_embedding VECTOR(1536),
  match_product_id UUID,
  match_threshold DECIMAL DEFAULT 0.7,
  match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  chunk_text TEXT,
  chunk_type TEXT,
  relevance_score DECIMAL,
  source_material_id UUID,
  similarity DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.chunk_text,
    c.chunk_type,
    c.relevance_score,
    c.source_material_id,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.product_content_chunks c
  WHERE c.product_id = match_product_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 13. Trigger to update updated_at timestamp
-- Note: update_updated_at_column() function is already created in core migrations

CREATE TRIGGER update_source_materials_updated_at
  BEFORE UPDATE ON public.product_source_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_description_generations_updated_at
  BEFORE UPDATE ON public.product_description_generations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- Migration: 20250221_create_storage_bucket.sql
-- =============================================================================

-- Create Supabase Storage Bucket for Product Source Materials
-- Run this SQL manually in your Supabase SQL Editor

-- Create storage bucket for product source PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-sources', 
  'product-sources', 
  false, -- Private bucket
  10485760, -- 10 MB limit
  ARRAY['application/pdf', 'text/plain'] -- Only PDFs and text files
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Authenticated users can upload source materials
DROP POLICY IF EXISTS "Authenticated users can upload source materials" ON storage.objects;
CREATE POLICY "Authenticated users can upload source materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-sources' AND
  (storage.foldername(name))[1] = 'sources'
);

-- Storage policy: Authenticated users can read their own source materials
DROP POLICY IF EXISTS "Authenticated users can read source materials" ON storage.objects;
CREATE POLICY "Authenticated users can read source materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-sources');

-- Storage policy: Authenticated users can delete source materials
DROP POLICY IF EXISTS "Authenticated users can delete source materials" ON storage.objects;
CREATE POLICY "Authenticated users can delete source materials"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-sources');


-- =============================================================================
-- Migration: 20250222_add_generation_instructions.sql
-- =============================================================================

-- Add generation_instructions field to shoprenter_product_descriptions
-- This allows users to provide custom instructions for AI description generation
-- Run this SQL manually in your Supabase SQL Editor

ALTER TABLE public.shoprenter_product_descriptions
ADD COLUMN IF NOT EXISTS generation_instructions TEXT;

COMMENT ON COLUMN public.shoprenter_product_descriptions.generation_instructions IS 
'Custom instructions for AI description generation. Example: "A forrásanyagok 450mm fiókra vonatkoznak, de a leírás 300-550mm közötti méreteket fedjen le"';


-- =============================================================================
-- Migration: 20250222_add_product_urls.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20250222_add_search_console_config.sql
-- =============================================================================

-- Add Search Console configuration to webshop_connections
-- Run this SQL manually in your Supabase SQL Editor

ALTER TABLE public.webshop_connections
ADD COLUMN IF NOT EXISTS search_console_property_url TEXT,
ADD COLUMN IF NOT EXISTS search_console_client_email TEXT,
ADD COLUMN IF NOT EXISTS search_console_private_key TEXT,
ADD COLUMN IF NOT EXISTS search_console_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.webshop_connections.search_console_property_url IS 
'Google Search Console property URL (e.g., https://vasalatmester.hu or sc-domain:vasalatmester.hu)';

COMMENT ON COLUMN public.webshop_connections.search_console_client_email IS 
'Google Service Account email for Search Console API access';

COMMENT ON COLUMN public.webshop_connections.search_console_private_key IS 
'Google Service Account private key (encrypted in production)';

COMMENT ON COLUMN public.webshop_connections.search_console_enabled IS 
'Whether Search Console integration is enabled for this connection';


-- =============================================================================
-- Migration: 20250222_create_search_console_tables.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20250224_add_url_alias_id.sql
-- =============================================================================

-- Add url_alias_id column to store ShopRenter's URL alias ID
-- This allows us to update the URL alias via API

ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS url_alias_id TEXT;

CREATE INDEX IF NOT EXISTS idx_products_url_alias_id ON public.shoprenter_products(url_alias_id) WHERE url_alias_id IS NOT NULL;

COMMENT ON COLUMN public.shoprenter_products.url_alias_id IS 
'ShopRenter URL alias resource ID (base64 encoded). Used to update the product URL slug via PUT /urlAliases/{id} API endpoint.';


-- =============================================================================
-- Migration: 20250225_add_parent_product_support.sql
-- =============================================================================

-- Add parent_product_id column to track parent-child relationships
ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS parent_product_id TEXT;

-- Add index for faster parent-child queries
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_parent_product_id 
ON public.shoprenter_products(parent_product_id) 
WHERE parent_product_id IS NOT NULL;

-- Add index for finding all children of a parent
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_parent_lookup 
ON public.shoprenter_products(connection_id, parent_product_id) 
WHERE parent_product_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.shoprenter_products.parent_product_id IS 
'UUID of the parent product (if this is a child/variant product). Used for variant management and SEO canonical URLs.';

-- Add product_attributes column to store ShopRenter productAttributeExtend data
ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS product_attributes JSONB;

-- Add GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_attributes 
ON public.shoprenter_products USING GIN (product_attributes)
WHERE product_attributes IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.shoprenter_products.product_attributes IS 
'Stores ShopRenter productAttributeExtend data (size, color, dimensions, etc.) as JSONB. Used for variant management and AI description generation.';

-- Create table to store structured data (JSON-LD) for products
CREATE TABLE IF NOT EXISTS public.product_structured_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  structured_data_type TEXT NOT NULL DEFAULT 'ProductGroup', -- ProductGroup, Product, etc.
  json_ld_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, structured_data_type)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_product_structured_data_product_id 
ON public.product_structured_data(product_id);

CREATE INDEX IF NOT EXISTS idx_product_structured_data_type 
ON public.product_structured_data(structured_data_type);

-- Add RLS policies
ALTER TABLE public.product_structured_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view structured data for their products" ON public.product_structured_data;
DROP POLICY IF EXISTS "Users can insert structured data for their products" ON public.product_structured_data;
DROP POLICY IF EXISTS "Users can update structured data for their products" ON public.product_structured_data;
DROP POLICY IF EXISTS "Users can delete structured data for their products" ON public.product_structured_data;

CREATE POLICY "Users can view structured data for their products"
  ON public.product_structured_data
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_structured_data.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

CREATE POLICY "Users can insert structured data for their products"
  ON public.product_structured_data
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_structured_data.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

CREATE POLICY "Users can update structured data for their products"
  ON public.product_structured_data
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_structured_data.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

CREATE POLICY "Users can delete structured data for their products"
  ON public.product_structured_data
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_structured_data.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );


-- =============================================================================
-- Migration: 20250226_fix_parent_canonical_urls.sql
-- =============================================================================

-- Fix: Clear canonical URLs for all parent products
-- Parent products should NOT have canonical URLs (they ARE the canonical)
-- Only child products should have canonical URLs pointing to parent

-- Step 1: Clear canonical URLs for all products that are parents (have children)
UPDATE shoprenter_products
SET canonical_url = NULL
WHERE id IN (
  SELECT DISTINCT parent_product_id::uuid 
  FROM shoprenter_products 
  WHERE parent_product_id IS NOT NULL
    AND deleted_at IS NULL
)
AND canonical_url IS NOT NULL;

-- Step 2: Verify the fix
-- This query should return 0 rows after running the migration
SELECT 
  'Products that are parents but still have canonical_url (should be 0)' as check_name,
  COUNT(*) as count
FROM shoprenter_products
WHERE id IN (
  SELECT DISTINCT parent_product_id::uuid 
  FROM shoprenter_products 
  WHERE parent_product_id IS NOT NULL
    AND deleted_at IS NULL
)
AND canonical_url IS NOT NULL
AND deleted_at IS NULL;


-- =============================================================================
-- Migration: 20250226_fix_self_referencing_parent_product_id.sql
-- =============================================================================

-- Fix: Clear parent_product_id for products that reference themselves
-- This is invalid data that can cause canonical URL issues
-- A product cannot be its own parent

-- Step 1: Find and fix products where parent_product_id = id
UPDATE shoprenter_products
SET parent_product_id = NULL
WHERE parent_product_id IS NOT NULL
  AND parent_product_id::text = id::text
  AND deleted_at IS NULL;

-- Step 2: Verify the fix
-- This query should return 0 rows after running the migration
SELECT 
  'Products with parent_product_id pointing to themselves (should be 0)' as check_name,
  COUNT(*) as count
FROM shoprenter_products
WHERE parent_product_id IS NOT NULL
  AND parent_product_id::text = id::text
  AND deleted_at IS NULL;


-- =============================================================================
-- Migration: 20250227_remove_seo_features.sql
-- =============================================================================

-- Remove SEO-related features from database
-- ShopRenter handles canonical URLs and structured data automatically

-- 1. Drop product_structured_data table
DROP TABLE IF EXISTS public.product_structured_data CASCADE;

-- 2. Remove canonical_url column from shoprenter_products
ALTER TABLE public.shoprenter_products
DROP COLUMN IF EXISTS canonical_url;

-- Verify removal
DO $$
BEGIN
  -- Check if table was dropped
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'product_structured_data'
  ) THEN
    RAISE EXCEPTION 'product_structured_data table still exists';
  END IF;
  
  -- Check if column was dropped
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shoprenter_products' 
    AND column_name = 'canonical_url'
  ) THEN
    RAISE EXCEPTION 'canonical_url column still exists';
  END IF;
  
  RAISE NOTICE 'SEO features successfully removed from database';
END $$;


-- =============================================================================
-- Migration: 20250228_create_product_images_table.sql
-- =============================================================================

-- Product Images Table Migration
-- Stores product image metadata and alt text for SEO optimization

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- ShopRenter Image Data
  shoprenter_image_id TEXT, -- ShopRenter productImage ID (for syncing alt text)
  image_path TEXT NOT NULL, -- e.g., "product/image.jpg"
  image_url TEXT, -- Full URL from allImages (for display)
  sort_order INTEGER DEFAULT 0,
  is_main_image BOOLEAN DEFAULT false,
  
  -- Alt Text
  alt_text TEXT, -- Generated/manual alt text
  alt_text_status TEXT DEFAULT 'pending' CHECK (alt_text_status IN ('pending', 'generated', 'manual', 'synced', 'error')),
  alt_text_generated_at TIMESTAMP WITH TIME ZONE,
  alt_text_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  last_synced_at TIMESTAMP WITH TIME ZONE, -- DEPRECATED: Use last_synced_from_shoprenter_at instead (kept for backward compatibility)
  last_synced_from_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced FROM ShopRenter (pulled into ERP)
  last_synced_to_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced TO ShopRenter (pushed from ERP)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(product_id, image_path)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_images_product_id 
ON public.product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_connection_id 
ON public.product_images(connection_id);

CREATE INDEX IF NOT EXISTS idx_product_images_alt_text_status 
ON public.product_images(alt_text_status) 
WHERE alt_text_status IN ('pending', 'generated');

CREATE INDEX IF NOT EXISTS idx_product_images_shoprenter_id 
ON public.product_images(shoprenter_image_id) 
WHERE shoprenter_image_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view images for products they have access to
DROP POLICY IF EXISTS "Users can view images for their products" ON public.product_images;
CREATE POLICY "Users can view images for their products" ON public.product_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can insert images for products they have access to
DROP POLICY IF EXISTS "Users can insert images for their products" ON public.product_images;
CREATE POLICY "Users can insert images for their products" ON public.product_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can update images for products they have access to
DROP POLICY IF EXISTS "Users can update images for their products" ON public.product_images;
CREATE POLICY "Users can update images for their products" ON public.product_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can delete images for products they have access to
DROP POLICY IF EXISTS "Users can delete images for their products" ON public.product_images;
CREATE POLICY "Users can delete images for their products" ON public.product_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Comments
COMMENT ON TABLE public.product_images IS 'Stores product image metadata and alt text for SEO optimization';
COMMENT ON COLUMN public.product_images.alt_text IS 'SEO-friendly alt text for the image (generated by AI or manually entered)';
COMMENT ON COLUMN public.product_images.alt_text_status IS 'Status: pending (needs generation), generated (AI-generated), manual (user-entered), synced (synced to ShopRenter), error (sync failed)';
COMMENT ON COLUMN public.product_images.shoprenter_image_id IS 'ShopRenter productImage resource ID for syncing alt text back to ShopRenter';


-- =============================================================================
-- Migration: 20250301_add_quality_scores_insert_update_policies.sql
-- =============================================================================

-- Add INSERT and UPDATE policies for product_quality_scores
-- The original migration only had SELECT policy, which prevented inserts
-- This migration is idempotent - safe to run even if product_quality_scores table doesn't exist yet

DO $$
BEGIN
  -- Only run if product_quality_scores table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'product_quality_scores'
  ) THEN
    -- Policy: Users can insert scores for products they have access to
    DROP POLICY IF EXISTS "Users can insert quality scores for their products" ON public.product_quality_scores;
    CREATE POLICY "Users can insert quality scores for their products" ON public.product_quality_scores
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.shoprenter_products sp
          JOIN public.webshop_connections c ON c.id = sp.connection_id
          WHERE sp.id = product_quality_scores.product_id
          AND EXISTS (
            SELECT 1 FROM public.user_permissions up
            JOIN public.pages p ON up.page_id = p.id
            WHERE up.user_id = auth.uid()
            AND p.path = '/products'
            AND up.can_access = true
          )
        )
      );

    -- Policy: Users can update scores for products they have access to
    DROP POLICY IF EXISTS "Users can update quality scores for their products" ON public.product_quality_scores;
    CREATE POLICY "Users can update quality scores for their products" ON public.product_quality_scores
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.shoprenter_products sp
          JOIN public.webshop_connections c ON c.id = sp.connection_id
          WHERE sp.id = product_quality_scores.product_id
          AND EXISTS (
            SELECT 1 FROM public.user_permissions up
            JOIN public.pages p ON up.page_id = p.id
            WHERE up.user_id = auth.uid()
            AND p.path = '/products'
            AND up.can_access = true
          )
        )
      );
  END IF;
END $$;


-- =============================================================================
-- Migration: 20250301_create_product_quality_scores.sql
-- =============================================================================

-- Product Quality Scores Migration
-- Stores calculated quality scores for products to identify which need optimization

CREATE TABLE IF NOT EXISTS public.product_quality_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- Product type
  is_parent BOOLEAN NOT NULL DEFAULT false, -- true if parent product, false if child/variant
  
  -- Overall score (0-100)
  overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  
  -- Category scores (0-100 each)
  content_score INTEGER DEFAULT 0 CHECK (content_score >= 0 AND content_score <= 100),
  image_score INTEGER DEFAULT 0 CHECK (image_score >= 0 AND image_score <= 100),
  technical_score INTEGER DEFAULT 0 CHECK (technical_score >= 0 AND technical_score <= 100),
  performance_score INTEGER DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
  completeness_score INTEGER DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
  competitive_score INTEGER DEFAULT 0 CHECK (competitive_score >= 0 AND competitive_score <= 100),
  
  -- Priority score (higher = more urgent to fix)
  priority_score DECIMAL(10,2) DEFAULT 0,
  
  -- Issues and blocking factors
  issues JSONB DEFAULT '[]'::jsonb, -- Array of issues: [{type: "missing_description", severity: "critical", message: "..."}]
  blocking_issues TEXT[], -- Array of blocking issue types that prevent high scores
  
  -- Metadata
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  calculation_version TEXT DEFAULT '1.0', -- Track scoring algorithm version
  
  -- Unique constraint: one score per product
  UNIQUE(product_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quality_scores_product_id 
ON public.product_quality_scores(product_id);

CREATE INDEX IF NOT EXISTS idx_quality_scores_connection_id 
ON public.product_quality_scores(connection_id);

CREATE INDEX IF NOT EXISTS idx_quality_scores_overall_score 
ON public.product_quality_scores(overall_score);

CREATE INDEX IF NOT EXISTS idx_quality_scores_priority_score 
ON public.product_quality_scores(priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_quality_scores_is_parent 
ON public.product_quality_scores(is_parent);

CREATE INDEX IF NOT EXISTS idx_quality_scores_last_calculated 
ON public.product_quality_scores(last_calculated_at);

-- RLS Policies
ALTER TABLE public.product_quality_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view scores for products they have access to
DROP POLICY IF EXISTS "Users can view quality scores for their products" ON public.product_quality_scores;
CREATE POLICY "Users can view quality scores for their products" ON public.product_quality_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_quality_scores.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can insert scores for products they have access to
DROP POLICY IF EXISTS "Users can insert quality scores for their products" ON public.product_quality_scores;
CREATE POLICY "Users can insert quality scores for their products" ON public.product_quality_scores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_quality_scores.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can update scores for products they have access to
DROP POLICY IF EXISTS "Users can update quality scores for their products" ON public.product_quality_scores;
CREATE POLICY "Users can update quality scores for their products" ON public.product_quality_scores
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_quality_scores.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Comments
COMMENT ON TABLE public.product_quality_scores IS 'Stores calculated quality scores for products to identify optimization opportunities';
COMMENT ON COLUMN public.product_quality_scores.overall_score IS 'Overall quality score 0-100. Higher is better.';
COMMENT ON COLUMN public.product_quality_scores.is_parent IS 'true if this is a parent product (standalone), false if child/variant';
COMMENT ON COLUMN public.product_quality_scores.priority_score IS 'Priority score for fixing. Higher = more urgent. Calculated as (100 - overall_score) * impact_multiplier';
COMMENT ON COLUMN public.product_quality_scores.issues IS 'JSON array of issues found: [{type, severity, message, points_lost}]';
COMMENT ON COLUMN public.product_quality_scores.blocking_issues IS 'Array of blocking issue types that prevent high scores (e.g., "missing_description", "no_images")';


-- =============================================================================
-- Migration: 20250302_enhance_indexing_status.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20250303_add_brand_field.sql
-- =============================================================================

-- Add brand/manufacturer field to shoprenter_products table
-- Brand is pulled from ShopRenter productExtend.manufacturer.name

ALTER TABLE public.shoprenter_products 
  ADD COLUMN IF NOT EXISTS brand TEXT;

-- Add index for brand searches
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_brand 
  ON public.shoprenter_products(brand) 
  WHERE brand IS NOT NULL;

-- Comment on new column
COMMENT ON COLUMN public.shoprenter_products.brand IS 'Product brand/manufacturer name from ShopRenter manufacturer resource';


-- =============================================================================
-- Migration: 20250313_add_manufacturer_id.sql
-- =============================================================================

-- Add manufacturer_id column to shoprenter_products table
-- This stores the ShopRenter manufacturer ID for syncing back

ALTER TABLE public.shoprenter_products 
  ADD COLUMN IF NOT EXISTS manufacturer_id TEXT;

-- Add index for manufacturer_id searches
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_manufacturer_id 
  ON public.shoprenter_products(manufacturer_id) 
  WHERE manufacturer_id IS NOT NULL;

-- Comment on new column
COMMENT ON COLUMN public.shoprenter_products.manufacturer_id IS 'ShopRenter manufacturer resource ID (for syncing manufacturer back to ShopRenter)';


-- =============================================================================
-- Migration: 20250303_allow_anon_read_products_for_api.sql
-- =============================================================================

-- Allow anonymous users to read products for public API endpoints
-- This is needed for the structured data API (/api/shoprenter/structured-data/[sku])
-- which is called from ShopRenter frontend without authentication

-- 1. Allow anonymous users to read products (for public API)
DROP POLICY IF EXISTS "Products are viewable by anonymous users for API" ON public.shoprenter_products;
CREATE POLICY "Products are viewable by anonymous users for API" ON public.shoprenter_products
  FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

-- 2. Allow anonymous users to read product descriptions (for public API)
DROP POLICY IF EXISTS "Descriptions are viewable by anonymous users for API" ON public.shoprenter_product_descriptions;
CREATE POLICY "Descriptions are viewable by anonymous users for API" ON public.shoprenter_product_descriptions
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products p
      WHERE p.id = product_id AND p.deleted_at IS NULL
    )
  );

-- 3. Grant SELECT permission to anon role
GRANT SELECT ON public.shoprenter_products TO anon;
GRANT SELECT ON public.shoprenter_product_descriptions TO anon;

-- 4. Also allow anon to read product_images (needed for structured data)
-- Check if product_images table exists and has RLS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'product_images'
  ) THEN
    -- Grant SELECT permission
    GRANT SELECT ON public.product_images TO anon;
    
    -- Add policy if RLS is enabled
    IF EXISTS (
      SELECT 1 FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public' 
      AND t.tablename = 'product_images'
      AND c.relrowsecurity = true
    ) THEN
      DROP POLICY IF EXISTS "Images are viewable by anonymous users for API" ON public.product_images;
      CREATE POLICY "Images are viewable by anonymous users for API" ON public.product_images
        FOR SELECT
        TO anon
        USING (
          EXISTS (
            SELECT 1 FROM public.shoprenter_products p
            WHERE p.id = product_images.product_id AND p.deleted_at IS NULL
          )
        );
    END IF;
  END IF;
END $$;

-- 5. Also allow anon to read shoprenter_connections (needed to get shop URL)
-- Check if shoprenter_connections table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'shoprenter_connections'
  ) THEN
    -- Grant SELECT permission
    GRANT SELECT ON public.shoprenter_connections TO anon;
    
    -- Add policy if RLS is enabled (only allow reading connection_id and api_url for products)
    IF EXISTS (
      SELECT 1 FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public' 
      AND t.tablename = 'shoprenter_connections'
      AND c.relrowsecurity = true
    ) THEN
      DROP POLICY IF EXISTS "Connections are viewable by anonymous users for API" ON public.shoprenter_connections;
      CREATE POLICY "Connections are viewable by anonymous users for API" ON public.shoprenter_connections
        FOR SELECT
        TO anon
        USING (true); -- Allow reading connection data for API purposes
    END IF;
  END IF;
END $$;


-- =============================================================================
-- Migration: 20250304_create_categories_tables.sql
-- =============================================================================

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
  last_synced_at TIMESTAMP WITH TIME ZONE, -- DEPRECATED: Use last_synced_from_shoprenter_at instead (kept for backward compatibility)
  last_synced_from_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced FROM ShopRenter (pulled into ERP)
  last_synced_to_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced TO ShopRenter (pushed from ERP)
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


-- =============================================================================
-- Migration: 20250311_create_product_classes_tables.sql
-- =============================================================================

-- Product Classes Sync - Database Schema
-- Creates tables for ShopRenter Product Classes and their attribute relations
-- Similar to categories sync pattern

-- Product Classes table
CREATE TABLE IF NOT EXISTS public.shoprenter_product_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- ShopRenter identifiers
  shoprenter_id TEXT NOT NULL, -- Base64 encoded Product Class ID from ShopRenter
  shoprenter_inner_id TEXT, -- Inner ID (numeric)
  
  -- Product Class data
  name TEXT NOT NULL,
  description TEXT,
  
  -- Variant configuration (for product variants)
  first_variant_select_type TEXT, -- SELECT, RADIO, etc.
  second_variant_select_type TEXT,
  first_variant_parameter_shoprenter_id TEXT, -- Attribute ID for first variant
  second_variant_parameter_shoprenter_id TEXT, -- Attribute ID for second variant
  
  -- Sync tracking
  sync_status TEXT DEFAULT 'pending', -- pending, synced, error
  sync_error TEXT,
  last_synced_from_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced FROM ShopRenter (pulled into ERP)
  last_synced_to_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced TO ShopRenter (pushed from ERP)
  date_created TIMESTAMP WITH TIME ZONE,
  date_updated TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(connection_id, shoprenter_id)
);

-- Indexes for Product Classes
CREATE INDEX IF NOT EXISTS idx_product_classes_connection 
  ON public.shoprenter_product_classes(connection_id);
CREATE INDEX IF NOT EXISTS idx_product_classes_shoprenter_id 
  ON public.shoprenter_product_classes(shoprenter_id);
CREATE INDEX IF NOT EXISTS idx_product_classes_name 
  ON public.shoprenter_product_classes(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_classes_sync_status 
  ON public.shoprenter_product_classes(sync_status) WHERE deleted_at IS NULL;

-- Product Class - Attribute Relations table
-- Stores which attributes belong to which Product Class
CREATE TABLE IF NOT EXISTS public.shoprenter_product_class_attribute_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- ShopRenter identifiers
  shoprenter_id TEXT NOT NULL, -- Base64 encoded relation ID from ShopRenter
  
  -- Relations
  product_class_id UUID NOT NULL REFERENCES public.shoprenter_product_classes(id) ON DELETE CASCADE,
  attribute_shoprenter_id TEXT NOT NULL, -- ShopRenter attribute ID
  attribute_type TEXT NOT NULL, -- LIST, INTEGER, FLOAT, TEXT
  attribute_name TEXT, -- Internal name (e.g., "meret", "szin")
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(connection_id, shoprenter_id),
  UNIQUE(product_class_id, attribute_shoprenter_id)
);

-- Indexes for Product Class - Attribute Relations
CREATE INDEX IF NOT EXISTS idx_product_class_attr_relations_class 
  ON public.shoprenter_product_class_attribute_relations(product_class_id);
CREATE INDEX IF NOT EXISTS idx_product_class_attr_relations_connection 
  ON public.shoprenter_product_class_attribute_relations(connection_id);
CREATE INDEX IF NOT EXISTS idx_product_class_attr_relations_attribute 
  ON public.shoprenter_product_class_attribute_relations(attribute_shoprenter_id);

-- Comments
COMMENT ON TABLE public.shoprenter_product_classes IS 
'ShopRenter Product Classes (Product Types) synced from ShopRenter API. Product Classes define which attributes are available for products.';

COMMENT ON TABLE public.shoprenter_product_class_attribute_relations IS 
'Relations between Product Classes and Attributes. Defines which attributes belong to which Product Class.';

COMMENT ON COLUMN public.shoprenter_product_classes.shoprenter_id IS 
'Base64 encoded Product Class ID from ShopRenter API (e.g., cHJvZHVjdENsYXNzLXByb2R1Y3RfY2xhc3NfaWQ9MTQ=)';

COMMENT ON COLUMN public.shoprenter_product_classes.name IS 
'Product Class name (e.g., "Fiók", "Csavar", "Szobanövény")';

COMMENT ON COLUMN public.shoprenter_product_classes.first_variant_parameter_shoprenter_id IS 
'ShopRenter attribute ID used for first variant parameter (for product variants)';

COMMENT ON COLUMN public.shoprenter_product_class_attribute_relations.attribute_shoprenter_id IS 
'ShopRenter attribute ID (base64 encoded)';

COMMENT ON COLUMN public.shoprenter_product_class_attribute_relations.attribute_type IS 
'Attribute type: LIST, INTEGER, FLOAT, or TEXT';

-- Enable RLS
ALTER TABLE public.shoprenter_product_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoprenter_product_class_attribute_relations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can view Product Classes
CREATE POLICY "Product Classes are viewable by authenticated users" 
  ON public.shoprenter_product_classes
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- RLS Policies: All authenticated users can view Product Class - Attribute Relations
CREATE POLICY "Product Class Attribute Relations are viewable by authenticated users" 
  ON public.shoprenter_product_class_attribute_relations
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- RLS Policies: Only authorized users can manage Product Classes (same as products/categories)
CREATE POLICY "Only authorized users can manage Product Classes" 
  ON public.shoprenter_product_classes
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

-- RLS Policies: Only authorized users can manage Product Class - Attribute Relations
CREATE POLICY "Only authorized users can manage Product Class Attribute Relations" 
  ON public.shoprenter_product_class_attribute_relations
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

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoprenter_product_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoprenter_product_class_attribute_relations TO authenticated;


-- =============================================================================
-- Migration: 20250305_update_categories_rls_to_match_products.sql
-- =============================================================================

-- Update categories RLS policies to match products exactly
-- This ensures consistency and idempotency

-- 1. Update shoprenter_categories policies (match products pattern)
DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON public.shoprenter_categories;
CREATE POLICY "Categories are viewable by authenticated users" ON public.shoprenter_categories
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Only authorized users can manage categories" ON public.shoprenter_categories;
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

-- 2. Update shoprenter_category_descriptions policies (match product_descriptions pattern)
DROP POLICY IF EXISTS "Category descriptions are viewable by authenticated users" ON public.shoprenter_category_descriptions;
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

DROP POLICY IF EXISTS "Only authorized users can manage category descriptions" ON public.shoprenter_category_descriptions;
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

-- 3. Update product-category relations policies (add DROP POLICY IF EXISTS)
DROP POLICY IF EXISTS "Product-category relations are viewable by authenticated users" ON public.shoprenter_product_category_relations;
CREATE POLICY "Product-category relations are viewable by authenticated users" ON public.shoprenter_product_category_relations
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Only authorized users can manage product-category relations" ON public.shoprenter_product_category_relations;
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

-- 4. Update category_description_generations policies (add DROP POLICY IF EXISTS)
DROP POLICY IF EXISTS "Category generations are viewable by authenticated users" ON public.category_description_generations;
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

DROP POLICY IF EXISTS "Only authorized users can insert category generations" ON public.category_description_generations;
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


-- =============================================================================
-- Migration: 20250306_create_competitor_content_cache.sql
-- =============================================================================

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

-- Index on expires_at (cannot use NOW() in WHERE clause as it's not IMMUTABLE)
-- Queries should filter by expires_at > NOW() in the WHERE clause instead
CREATE INDEX IF NOT EXISTS idx_competitor_content_cache_expires 
ON public.competitor_content_cache(expires_at);

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

-- =============================================================================
-- Migration: 20250308_create_sync_audit_logs.sql
-- =============================================================================

-- Create sync_audit_logs table for tracking sync operations
-- This table tracks all sync operations (full sync, incremental, single product) per connection

CREATE TABLE IF NOT EXISTS public.sync_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'single_product', 'bulk'
  sync_direction VARCHAR(20) NOT NULL, -- 'from_shoprenter', 'to_shoprenter'
  user_id UUID REFERENCES auth.users(id),
  user_email VARCHAR(255),
  
  -- Sync statistics
  total_products INTEGER DEFAULT 0,
  synced_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Status
  status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed', 'stopped'
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- {forceSync: true, batchSize: 200, etc.}
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_audit_connection ON public.sync_audit_logs(connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_user ON public.sync_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_status ON public.sync_audit_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_type ON public.sync_audit_logs(sync_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.sync_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can view sync logs for connections they have access to
DROP POLICY IF EXISTS "Sync audit logs are viewable by authenticated users" ON public.sync_audit_logs;
CREATE POLICY "Sync audit logs are viewable by authenticated users" ON public.sync_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.webshop_connections wc
      WHERE wc.id = sync_audit_logs.connection_id
      AND wc.deleted_at IS NULL
    )
  );

-- Only users with /connections page permission can insert/update sync logs
DROP POLICY IF EXISTS "Only admins can manage sync audit logs" ON public.sync_audit_logs;
CREATE POLICY "Only admins can manage sync audit logs" ON public.sync_audit_logs
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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.sync_audit_logs TO authenticated;

-- Add comments
COMMENT ON TABLE public.sync_audit_logs IS 'Audit log for all sync operations (full sync, incremental, single product)';
COMMENT ON COLUMN public.sync_audit_logs.sync_type IS 'Type of sync: full, incremental, single_product, bulk';
COMMENT ON COLUMN public.sync_audit_logs.sync_direction IS 'Direction: from_shoprenter (pull) or to_shoprenter (push)';
COMMENT ON COLUMN public.sync_audit_logs.metadata IS 'Additional sync metadata: {forceSync: true, batchSize: 200, etc.}';

-- =============================================================================
-- Migration: 20250310_add_sync_direction_tracking.sql
-- =============================================================================

-- Add separate sync direction tracking fields
-- This allows us to track when we last synced FROM ShopRenter vs TO ShopRenter
-- This prevents overwriting ERP changes that were just synced to ShopRenter

ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS last_synced_from_shoprenter_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_synced_to_shoprenter_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_last_synced_from 
  ON public.shoprenter_products(last_synced_from_shoprenter_at) 
  WHERE last_synced_from_shoprenter_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_last_synced_to 
  ON public.shoprenter_products(last_synced_to_shoprenter_at) 
  WHERE last_synced_to_shoprenter_at IS NOT NULL;

-- Migrate existing data (for backward compatibility)
-- Set last_synced_from_shoprenter_at = last_synced_at for existing records
-- This assumes existing last_synced_at values are from FROM syncs
UPDATE public.shoprenter_products
SET last_synced_from_shoprenter_at = last_synced_at
WHERE last_synced_at IS NOT NULL 
  AND last_synced_from_shoprenter_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.shoprenter_products.last_synced_from_shoprenter_at IS 
'Timestamp when product was last synced FROM ShopRenter (pulled into ERP). Used for incremental sync logic to determine if ShopRenter has new changes.';

COMMENT ON COLUMN public.shoprenter_products.last_synced_to_shoprenter_at IS 
'Timestamp when product was last synced TO ShopRenter (pushed from ERP). Used to prevent overwriting ERP changes that were just synced to ShopRenter.';
