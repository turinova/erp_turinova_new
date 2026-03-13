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
  measurement_unit TEXT, -- Measurement unit from ShopRenter (e.g., "db", "kg", "m", "l", "pc")
  
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

-- 3.5. Create trigger to auto-update updated_at for shoprenter_products
DROP TRIGGER IF EXISTS update_shoprenter_products_updated_at ON public.shoprenter_products;
CREATE TRIGGER update_shoprenter_products_updated_at
  BEFORE UPDATE ON public.shoprenter_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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
-- Migration: 20250315_add_units_page_to_permissions.sql
-- =============================================================================

-- Add Units page to permissions system
-- This allows the /units page to be accessible through the permission system

INSERT INTO public.pages (path, name, description, category) VALUES
  ('/units', 'Mértékegységek', 'Mértékegységek kezelése', 'Törzsadatok')
ON CONFLICT (path) DO NOTHING;

-- Grant default access to all existing users for the Units page
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/units'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;

-- Add Manufacturers page to permissions system
-- This allows the /manufacturers page to be accessible through the permission system

INSERT INTO public.pages (path, name, description, category) VALUES
  ('/manufacturers', 'Gyártók', 'Gyártók kezelése', 'Törzsadatok')
ON CONFLICT (path) DO NOTHING;

-- Grant default access to all existing users for the Manufacturers page
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/manufacturers'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;

-- =============================================================================
-- Migration: 20250317_add_weight_units_page_to_permissions.sql
-- =============================================================================

-- Add Weight Units page to permissions system
-- This allows the /weight-units page to be accessible through the permission system

INSERT INTO public.pages (path, name, description, category) VALUES
  ('/weight-units', 'Súlymértékek', 'Súlymértékek kezelése', 'Törzsadatok')
ON CONFLICT (path) DO NOTHING;

-- Grant default access to all existing users for the Weight Units page
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/weight-units'
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

-- =============================================================================
-- Migration: 20250324_add_unit_id_to_products.sql
-- =============================================================================

-- Add unit_id column to shoprenter_products table
-- This creates a direct foreign key relationship to the units table
-- for better data integrity and performance

ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_unit_id 
ON public.shoprenter_products(unit_id) 
WHERE deleted_at IS NULL AND unit_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.shoprenter_products.unit_id IS 'Reference to units table (measurement unit for product quantity). Source of truth for product unit.';

-- =============================================================================
-- Migration: 20250315_create_units_table.sql
-- =============================================================================

-- Create units table for measurement units management
-- This table stores measurement units (mértékegységek) used in products

CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    shortform VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS units_name_unique_active 
ON public.units (name) 
WHERE deleted_at IS NULL;

-- Add unique constraint on shortform (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS units_shortform_unique_active 
ON public.units (shortform) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_units_deleted_at ON public.units(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for units table to automatically update updated_at
DROP TRIGGER IF EXISTS update_units_updated_at ON public.units;
CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON public.units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (only if they don't exist)
INSERT INTO public.units (name, shortform) 
SELECT * FROM (VALUES 
    ('Darab', 'db'),
    ('Kilogramm', 'kg'),
    ('Gramm', 'g'),
    ('Méter', 'm'),
    ('Centiméter', 'cm'),
    ('Milliméter', 'mm'),
    ('Liter', 'l'),
    ('Milliliter', 'ml'),
    ('Piece', 'pc'),
    ('Doboz', 'box'),
    ('Csomag', 'pack')
) AS v(name, shortform)
WHERE NOT EXISTS (
    SELECT 1 FROM public.units 
    WHERE units.name = v.name AND units.deleted_at IS NULL
);

-- Enable RLS for units table
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- RLS Policies for units table
DROP POLICY IF EXISTS "Units are viewable by authenticated users" ON public.units;
CREATE POLICY "Units are viewable by authenticated users" 
ON public.units
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Units are manageable by authenticated users" ON public.units;
CREATE POLICY "Units are manageable by authenticated users" 
ON public.units
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;


-- Create manufacturers table for brand/manufacturer management
-- This table stores manufacturers/brands used in products
-- Global table (like units, vat) - shared across all platforms

CREATE TABLE IF NOT EXISTS public.manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    website TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS manufacturers_name_unique_active 
ON public.manufacturers (name) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_manufacturers_deleted_at ON public.manufacturers(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for manufacturers table to automatically update updated_at
DROP TRIGGER IF EXISTS update_manufacturers_updated_at ON public.manufacturers;
CREATE TRIGGER update_manufacturers_updated_at
    BEFORE UPDATE ON public.manufacturers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for manufacturers table
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manufacturers table
DROP POLICY IF EXISTS "Manufacturers are viewable by authenticated users" ON public.manufacturers;
CREATE POLICY "Manufacturers are viewable by authenticated users" 
ON public.manufacturers
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Manufacturers are manageable by authenticated users" ON public.manufacturers;
CREATE POLICY "Manufacturers are manageable by authenticated users" 
ON public.manufacturers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturers TO authenticated;


-- =============================================================================
-- Migration: 20250317_create_weight_units_table.sql
-- =============================================================================

-- Create weight_units table for weight unit management
-- This table stores weight units (súlymértékek) used in products
-- Global table (like units, vat, manufacturers) - shared across all platforms

CREATE TABLE IF NOT EXISTS public.weight_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    shortform VARCHAR NOT NULL,
    shoprenter_weight_class_id TEXT, -- ShopRenter weightClass ID (for mapping)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS weight_units_name_unique_active 
ON public.weight_units (name) 
WHERE deleted_at IS NULL;

-- Add unique constraint on shortform (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS weight_units_shortform_unique_active 
ON public.weight_units (shortform) 
WHERE deleted_at IS NULL;

-- Add index for shoprenter_weight_class_id
CREATE INDEX IF NOT EXISTS idx_weight_units_shoprenter_id 
ON public.weight_units(shoprenter_weight_class_id) 
WHERE shoprenter_weight_class_id IS NOT NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_weight_units_deleted_at ON public.weight_units(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for weight_units table to automatically update updated_at
DROP TRIGGER IF EXISTS update_weight_units_updated_at ON public.weight_units;
CREATE TRIGGER update_weight_units_updated_at
    BEFORE UPDATE ON public.weight_units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (only if they don't exist)
INSERT INTO public.weight_units (name, shortform) 
SELECT * FROM (VALUES 
    ('Kilogramm', 'kg'),
    ('Gramm', 'g'),
    ('Ton', 't'),
    ('Pound', 'lb'),
    ('Ounce', 'oz')
) AS v(name, shortform)
WHERE NOT EXISTS (
    SELECT 1 FROM public.weight_units 
    WHERE weight_units.name = v.name AND weight_units.deleted_at IS NULL
);

-- Enable RLS for weight_units table
ALTER TABLE public.weight_units ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weight_units table
DROP POLICY IF EXISTS "Weight units are viewable by authenticated users" ON public.weight_units;
CREATE POLICY "Weight units are viewable by authenticated users" 
ON public.weight_units
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Weight units are manageable by authenticated users" ON public.weight_units;
CREATE POLICY "Weight units are manageable by authenticated users" 
ON public.weight_units
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_units TO authenticated;


-- =============================================================================
-- Migration: 20250322_create_suppliers_table.sql
-- =============================================================================

-- Create suppliers table
-- This table stores supplier/beslállító master data

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL, -- Cég neve
    short_name VARCHAR, -- Rövid név / alias (optional)
    email VARCHAR, -- E-mail cím
    phone VARCHAR, -- Telefonszám
    website VARCHAR, -- Weboldal
    tax_number VARCHAR, -- Adószám
    eu_tax_number VARCHAR, -- Közösségi adószám
    note TEXT, -- Megjegyzés
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'inactive')), -- Státusz: Aktív / Inaktív
    default_payment_method_id UUID, -- Will reference payment_methods table (to be created later)
    default_payment_terms_days INTEGER, -- Fizetési határidő (napokban, pl. 8, 14, 30, 60)
    default_vat_id UUID REFERENCES public.vat(id) ON DELETE SET NULL, -- Alapértelmezett ÁFA
    default_currency_id UUID, -- Will reference currencies table (to be created later)
    default_order_channel VARCHAR CHECK (default_order_channel IN ('email', 'phone', 'in_person', 'internet')), -- Alapértelmezett rendelési csatorna
    default_order_email VARCHAR, -- Alapértelmezett rendelési e-mail cím
    email_template_subject TEXT, -- E-mail sablon tárgya
    email_template_body TEXT, -- E-mail sablon törzse
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_unique_active 
ON public.suppliers (name) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_suppliers_deleted_at ON public.suppliers(deleted_at) WHERE deleted_at IS NULL;

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS ix_suppliers_status ON public.suppliers(status) WHERE deleted_at IS NULL;

-- Add index for tax_number searches
CREATE INDEX IF NOT EXISTS ix_suppliers_tax_number ON public.suppliers(tax_number) WHERE deleted_at IS NULL AND tax_number IS NOT NULL;

-- Create trigger for suppliers table to automatically update updated_at
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for suppliers table
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers table
DROP POLICY IF EXISTS "Suppliers are viewable by authenticated users" ON public.suppliers;
CREATE POLICY "Suppliers are viewable by authenticated users" 
ON public.suppliers
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Suppliers are manageable by authenticated users" ON public.suppliers;
CREATE POLICY "Suppliers are manageable by authenticated users" 
ON public.suppliers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;


-- =============================================================================
-- Migration: 20250322_create_supplier_addresses_table.sql
-- =============================================================================

-- Create supplier_addresses table
-- This table stores multiple addresses for each supplier

CREATE TABLE IF NOT EXISTS public.supplier_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    address_type VARCHAR NOT NULL CHECK (address_type IN ('headquarters', 'billing', 'shipping', 'other')), -- Típus: Székhely / Számlázási cím / Szállítási cím / Egyéb
    country VARCHAR NOT NULL, -- Ország
    postal_code VARCHAR, -- Irányítószám
    city VARCHAR NOT NULL, -- Város
    street VARCHAR, -- Utca, házszám
    address_line_2 VARCHAR, -- További címadatok
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add index for supplier_id lookups
CREATE INDEX IF NOT EXISTS ix_supplier_addresses_supplier_id ON public.supplier_addresses(supplier_id) WHERE deleted_at IS NULL;

-- Add index for address_type filtering
CREATE INDEX IF NOT EXISTS ix_supplier_addresses_type ON public.supplier_addresses(address_type) WHERE deleted_at IS NULL;

-- Create trigger for supplier_addresses table to automatically update updated_at
DROP TRIGGER IF EXISTS update_supplier_addresses_updated_at ON public.supplier_addresses;
CREATE TRIGGER update_supplier_addresses_updated_at
    BEFORE UPDATE ON public.supplier_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for supplier_addresses table
ALTER TABLE public.supplier_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_addresses table
DROP POLICY IF EXISTS "Supplier addresses are viewable by authenticated users" ON public.supplier_addresses;
CREATE POLICY "Supplier addresses are viewable by authenticated users" 
ON public.supplier_addresses
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Supplier addresses are manageable by authenticated users" ON public.supplier_addresses;
CREATE POLICY "Supplier addresses are manageable by authenticated users" 
ON public.supplier_addresses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_addresses TO authenticated;


-- =============================================================================
-- Migration: 20250322_create_supplier_bank_accounts_table.sql
-- =============================================================================

-- Create supplier_bank_accounts table
-- This table stores multiple bank accounts for each supplier

CREATE TABLE IF NOT EXISTS public.supplier_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    bank_name VARCHAR NOT NULL, -- Bank neve
    account_number VARCHAR NOT NULL, -- Számlaszám / IBAN
    swift_bic VARCHAR, -- SWIFT/BIC (optional)
    currency_id UUID, -- Will reference currencies table (to be created later)
    is_default BOOLEAN DEFAULT false, -- Alapértelmezett bank
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add index for supplier_id lookups
CREATE INDEX IF NOT EXISTS ix_supplier_bank_accounts_supplier_id ON public.supplier_bank_accounts(supplier_id) WHERE deleted_at IS NULL;

-- Add index for is_default filtering
CREATE INDEX IF NOT EXISTS ix_supplier_bank_accounts_default ON public.supplier_bank_accounts(is_default) WHERE deleted_at IS NULL AND is_default = true;

-- Create trigger for supplier_bank_accounts table to automatically update updated_at
DROP TRIGGER IF EXISTS update_supplier_bank_accounts_updated_at ON public.supplier_bank_accounts;
CREATE TRIGGER update_supplier_bank_accounts_updated_at
    BEFORE UPDATE ON public.supplier_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for supplier_bank_accounts table
ALTER TABLE public.supplier_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_bank_accounts table
DROP POLICY IF EXISTS "Supplier bank accounts are viewable by authenticated users" ON public.supplier_bank_accounts;
CREATE POLICY "Supplier bank accounts are viewable by authenticated users" 
ON public.supplier_bank_accounts
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Supplier bank accounts are manageable by authenticated users" ON public.supplier_bank_accounts;
CREATE POLICY "Supplier bank accounts are manageable by authenticated users" 
ON public.supplier_bank_accounts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_bank_accounts TO authenticated;


-- =============================================================================
-- Migration: 20250322_create_supplier_order_channels_table.sql
-- =============================================================================

-- Create supplier_order_channels table
-- This table stores order channel details, especially URL templates for internet-based ordering

CREATE TABLE IF NOT EXISTS public.supplier_order_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    channel_type VARCHAR NOT NULL CHECK (channel_type IN ('email', 'phone', 'in_person', 'internet')), -- Rendelési csatorna típusa
    name VARCHAR, -- Név (pl. "Webshop keresés SKU alapján")
    url_template TEXT, -- URL sablon (pl. "https://www.zar-vasalas.hu/shop_searchcomplex.php?search={{sku}}&overlay=search_error_no")
    description TEXT, -- Leírás (rövid magyarázat)
    is_default BOOLEAN DEFAULT false, -- Alapértelmezett csatorna
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add index for supplier_id lookups
CREATE INDEX IF NOT EXISTS ix_supplier_order_channels_supplier_id ON public.supplier_order_channels(supplier_id) WHERE deleted_at IS NULL;

-- Add index for channel_type filtering
CREATE INDEX IF NOT EXISTS ix_supplier_order_channels_type ON public.supplier_order_channels(channel_type) WHERE deleted_at IS NULL;

-- Add index for is_default filtering
CREATE INDEX IF NOT EXISTS ix_supplier_order_channels_default ON public.supplier_order_channels(is_default) WHERE deleted_at IS NULL AND is_default = true;

-- Create trigger for supplier_order_channels table to automatically update updated_at
DROP TRIGGER IF EXISTS update_supplier_order_channels_updated_at ON public.supplier_order_channels;
CREATE TRIGGER update_supplier_order_channels_updated_at
    BEFORE UPDATE ON public.supplier_order_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for supplier_order_channels table
ALTER TABLE public.supplier_order_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_order_channels table
DROP POLICY IF EXISTS "Supplier order channels are viewable by authenticated users" ON public.supplier_order_channels;
CREATE POLICY "Supplier order channels are viewable by authenticated users" 
ON public.supplier_order_channels
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Supplier order channels are manageable by authenticated users" ON public.supplier_order_channels;
CREATE POLICY "Supplier order channels are manageable by authenticated users" 
ON public.supplier_order_channels
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_order_channels TO authenticated;


-- =============================================================================
-- Migration: 20250322_create_payment_methods_table.sql
-- =============================================================================

-- Create payment_methods table for storing payment method options
-- This table stores available payment methods for suppliers and orders

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  comment TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT payment_methods_name_key UNIQUE (name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_active 
ON public.payment_methods (active) 
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_payment_methods_name 
ON public.payment_methods (name) 
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_payment_methods_deleted_at 
ON public.payment_methods (deleted_at);

-- Create trigger for payment_methods table to automatically update updated_at
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for payment_methods table
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_methods table
DROP POLICY IF EXISTS "Payment methods are viewable by authenticated users" ON public.payment_methods;
CREATE POLICY "Payment methods are viewable by authenticated users" 
ON public.payment_methods
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Payment methods are manageable by authenticated users" ON public.payment_methods;
CREATE POLICY "Payment methods are manageable by authenticated users" 
ON public.payment_methods
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;

-- Insert default payment methods
INSERT INTO public.payment_methods (name, comment, active) VALUES
  ('Készpénz', 'Készpénzes fizetés átvételkor', true),
  ('Bankkártya', 'Bankkártyás fizetés POS terminálon', true),
  ('Átutalás', 'Banki átutalás előre vagy utólag', true),
  ('Díjbekérő', 'Proforma számla alapján', true),
  ('Utánvét', 'Utánvétes fizetés szállításkor', true),
  ('Online fizetés', 'Online bankkártyás fizetés', true)
ON CONFLICT ON CONSTRAINT payment_methods_name_key DO NOTHING;

-- Add foreign key constraint to suppliers table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'suppliers_default_payment_method_id_fkey'
  ) THEN
    ALTER TABLE public.suppliers 
    ADD CONSTRAINT suppliers_default_payment_method_id_fkey 
    FOREIGN KEY (default_payment_method_id) 
    REFERENCES public.payment_methods(id) 
    ON DELETE SET NULL;
  END IF;
END $$;


-- =============================================================================
-- Migration: 20250322_create_currencies_table.sql
-- =============================================================================

-- Create currencies table
-- This table stores available currencies for suppliers and orders

CREATE TABLE IF NOT EXISTS public.currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    code VARCHAR(3) NOT NULL, -- ISO currency code (HUF, EUR, USD, etc.)
    symbol VARCHAR(10), -- Currency symbol (Ft, €, $, etc.)
    rate DECIMAL(10,4) NOT NULL DEFAULT 1.0000, -- Exchange rate relative to base currency
    is_base BOOLEAN DEFAULT false, -- Whether this is the base currency
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS currencies_name_unique_active 
ON public.currencies (name) 
WHERE deleted_at IS NULL;

-- Add unique constraint on code (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS currencies_code_unique_active 
ON public.currencies (code) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_currencies_deleted_at ON public.currencies(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for currencies table to automatically update updated_at
DROP TRIGGER IF EXISTS update_currencies_updated_at ON public.currencies;
CREATE TRIGGER update_currencies_updated_at
    BEFORE UPDATE ON public.currencies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for currencies table
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for currencies table
DROP POLICY IF EXISTS "Currencies are viewable by authenticated users" ON public.currencies;
CREATE POLICY "Currencies are viewable by authenticated users" 
ON public.currencies
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Currencies are manageable by authenticated users" ON public.currencies;
CREATE POLICY "Currencies are manageable by authenticated users" 
ON public.currencies
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.currencies TO authenticated;

-- Insert sample data with HUF as base currency
-- Insert only if they don't already exist (checking by name)
INSERT INTO public.currencies (name, code, symbol, rate, is_base) 
SELECT * FROM (VALUES 
    ('Forint', 'HUF', 'Ft', 1.0000, true),
    ('Euró', 'EUR', '€', 0.0025, false),
    ('Amerikai dollár', 'USD', '$', 0.0027, false),
    ('Font', 'GBP', '£', 0.0021, false)
) AS v(name, code, symbol, rate, is_base)
WHERE NOT EXISTS (
    SELECT 1 FROM public.currencies 
    WHERE currencies.name = v.name AND currencies.deleted_at IS NULL
);

-- Add foreign key constraint to suppliers table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'suppliers_default_currency_id_fkey'
  ) THEN
    ALTER TABLE public.suppliers 
    ADD CONSTRAINT suppliers_default_currency_id_fkey 
    FOREIGN KEY (default_currency_id) 
    REFERENCES public.currencies(id) 
    ON DELETE SET NULL;
  END IF;
END $$;


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

-- Add measurement_unit column to shoprenter_product_descriptions
ALTER TABLE public.shoprenter_product_descriptions 
ADD COLUMN IF NOT EXISTS measurement_unit TEXT;

-- Add index for measurement_unit searches
CREATE INDEX IF NOT EXISTS idx_descriptions_measurement_unit 
  ON public.shoprenter_product_descriptions(measurement_unit) 
  WHERE measurement_unit IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.shoprenter_product_descriptions.measurement_unit IS 
  'Measurement unit from ShopRenter productDescriptions.measurementUnit (e.g., "db", "kg", "m", "l", "pc"). Used for displaying quantity with unit (e.g., "5 db", "2 kg").';

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
-- Migration: 20250316_remove_brand_column.sql
-- =============================================================================

-- Remove brand column from shoprenter_products table
-- Brand is now redundant - we use erp_manufacturer_id to join with manufacturers table
-- This migration removes the brand column and its index

-- Drop index first
DROP INDEX IF EXISTS idx_shoprenter_products_brand;

-- Drop column
ALTER TABLE public.shoprenter_products 
  DROP COLUMN IF EXISTS brand;


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

-- Add erp_manufacturer_id column to shoprenter_products table
-- This stores the ERP manufacturer ID (from manufacturers table) for products
-- This is separate from manufacturer_id which stores the ShopRenter manufacturer ID

ALTER TABLE public.shoprenter_products 
  ADD COLUMN IF NOT EXISTS erp_manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE SET NULL;

-- Add index for erp_manufacturer_id searches
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_erp_manufacturer_id 
  ON public.shoprenter_products(erp_manufacturer_id) 
  WHERE erp_manufacturer_id IS NOT NULL;

-- Comment on new column
COMMENT ON COLUMN public.shoprenter_products.erp_manufacturer_id IS 'ERP manufacturer ID (from manufacturers table). This is the global manufacturer/brand that can be used across all platforms. Separate from manufacturer_id which is the ShopRenter-specific manufacturer ID.';

-- Comment on new column
COMMENT ON COLUMN public.shoprenter_products.manufacturer_id IS 'ShopRenter manufacturer resource ID (for syncing manufacturer back to ShopRenter)';


-- =============================================================================
-- Migration: 20250317_add_dimensions_to_products.sql
-- =============================================================================

-- Add dimension and weight columns to shoprenter_products table
-- Dimensions: width (szélesség), height (magasság), length (hosszúság)
-- Weight: weight (súly) with weight unit reference

ALTER TABLE public.shoprenter_products 
  ADD COLUMN IF NOT EXISTS width NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS height NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS length NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS weight NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS erp_weight_unit_id UUID REFERENCES public.weight_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shoprenter_volume_unit_id TEXT, -- ShopRenter lengthClass ID (for dimensions - cm, m, mm)
  ADD COLUMN IF NOT EXISTS shoprenter_weight_unit_id TEXT; -- ShopRenter weightClass ID (for weight - kg, g, etc.)

-- Add indexes for dimensions and weight
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_dimensions 
  ON public.shoprenter_products(width, height, length) 
  WHERE width IS NOT NULL OR height IS NOT NULL OR length IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shoprenter_products_weight 
  ON public.shoprenter_products(weight) 
  WHERE weight IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shoprenter_products_erp_weight_unit_id 
  ON public.shoprenter_products(erp_weight_unit_id) 
  WHERE erp_weight_unit_id IS NOT NULL;

-- Comments on new columns
COMMENT ON COLUMN public.shoprenter_products.width IS 'Product width in cm (szélesség)';
COMMENT ON COLUMN public.shoprenter_products.height IS 'Product height in cm (magasság)';
COMMENT ON COLUMN public.shoprenter_products.length IS 'Product length in cm (hosszúság)';
COMMENT ON COLUMN public.shoprenter_products.weight IS 'Product weight (súly)';
COMMENT ON COLUMN public.shoprenter_products.erp_weight_unit_id IS 'ERP weight unit ID (from weight_units table)';
COMMENT ON COLUMN public.shoprenter_products.shoprenter_volume_unit_id IS 'ShopRenter lengthClass ID (for dimensions - default: cm)';
COMMENT ON COLUMN public.shoprenter_products.shoprenter_weight_unit_id IS 'ShopRenter weightClass ID (for weight)';


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

-- =============================================================================
-- Migration: 20250319_create_customer_groups_table.sql
-- =============================================================================

-- Create customer_groups table for pricing system
-- This table stores customer groups (vevőcsoportok) used for different pricing tiers
-- Maps to ShopRenter customer groups

CREATE TABLE IF NOT EXISTS public.customer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- ShopRenter sync
    shoprenter_customer_group_id TEXT,
    
    -- Price calculation
    price_multiplier DECIMAL(10,4) DEFAULT NULL,
    
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on code (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS customer_groups_code_unique_active 
ON public.customer_groups (code) 
WHERE deleted_at IS NULL;

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS customer_groups_name_unique_active 
ON public.customer_groups (name) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_customer_groups_deleted_at ON public.customer_groups(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_customer_groups_active ON public.customer_groups(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_groups_multiplier ON public.customer_groups(price_multiplier) WHERE price_multiplier IS NOT NULL AND deleted_at IS NULL;

-- Create trigger for customer_groups table to automatically update updated_at
DROP TRIGGER IF EXISTS update_customer_groups_updated_at ON public.customer_groups;
CREATE TRIGGER update_customer_groups_updated_at
    BEFORE UPDATE ON public.customer_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for customer_groups table
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_groups table
DROP POLICY IF EXISTS "Customer groups are viewable by authenticated users" ON public.customer_groups;
CREATE POLICY "Customer groups are viewable by authenticated users" 
ON public.customer_groups
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer groups are manageable by authenticated users" ON public.customer_groups;
CREATE POLICY "Customer groups are manageable by authenticated users" 
ON public.customer_groups
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_groups TO authenticated;

-- Add comments
COMMENT ON TABLE public.customer_groups IS 'Customer groups (vevőcsoportok) for pricing tiers. Maps to ShopRenter customer groups.';
COMMENT ON COLUMN public.customer_groups.code IS 'Unique code for the customer group (e.g., CUSTOMERS, RETAILERS, VIP)';
COMMENT ON COLUMN public.customer_groups.shoprenter_customer_group_id IS 'ShopRenter customer group ID after sync';
COMMENT ON COLUMN public.customer_groups.price_multiplier IS 'Multiplier for auto-calculating prices (e.g., 1.1 = cost * 1.1). NULL means manual pricing.';
COMMENT ON COLUMN public.customer_groups.is_default IS 'Whether this is the default customer group';

-- =============================================================================
-- Migration: 20250319_add_customer_groups_page_to_permissions.sql
-- =============================================================================

-- Add Customer Groups page to permissions system
-- This allows the /customer-groups page to be accessible through the permission system

INSERT INTO public.pages (path, name, description, category) VALUES
  ('/customer-groups', 'Vevőcsoportok', 'Vevőcsoportok kezelése', 'Árazás')
ON CONFLICT (path) DO NOTHING;

-- Grant default access to all existing users for the Customer Groups page
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/customer-groups'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;

-- =============================================================================
-- Migration: 20250321_add_promotions_page_to_permissions.sql
-- =============================================================================

-- Add promotions page to permission system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/promotions',
  'Akciók',
  'Termék akciók és mennyiségi árazás kezelése',
  'Árszabás',
  true
)
ON CONFLICT (path) DO NOTHING;

-- Grant default access to all existing users for the Promotions page
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path = '/promotions'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;

-- =============================================================================
-- Migration: 20250319_create_product_customer_group_prices_table.sql
-- =============================================================================

-- Create product_customer_group_prices table for pricing system
-- This table stores different prices for products based on customer groups
-- Maps to ShopRenter customerGroupProductPrice resource

CREATE TABLE IF NOT EXISTS public.product_customer_group_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES shoprenter_products(id) ON DELETE CASCADE,
    customer_group_id UUID NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
    
    price DECIMAL(15,4) NOT NULL, -- Price for this customer group
    
    -- ShopRenter sync
    shoprenter_customer_group_price_id TEXT,
    last_synced_at TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(product_id, customer_group_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_group_prices_product ON public.product_customer_group_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_group_prices_group ON public.product_customer_group_prices(customer_group_id);
CREATE INDEX IF NOT EXISTS idx_product_group_prices_active ON public.product_customer_group_prices(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_group_prices_synced ON public.product_customer_group_prices(last_synced_at) WHERE last_synced_at IS NOT NULL;

-- Create trigger for product_customer_group_prices table to automatically update updated_at
DROP TRIGGER IF EXISTS update_product_customer_group_prices_updated_at ON public.product_customer_group_prices;
CREATE TRIGGER update_product_customer_group_prices_updated_at
    BEFORE UPDATE ON public.product_customer_group_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for product_customer_group_prices table
ALTER TABLE public.product_customer_group_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_customer_group_prices table
DROP POLICY IF EXISTS "Product customer group prices are viewable by authenticated users" ON public.product_customer_group_prices;
CREATE POLICY "Product customer group prices are viewable by authenticated users" 
ON public.product_customer_group_prices
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Product customer group prices are manageable by authenticated users" ON public.product_customer_group_prices;
CREATE POLICY "Product customer group prices are manageable by authenticated users" 
ON public.product_customer_group_prices
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_customer_group_prices TO authenticated;

-- Add comments
COMMENT ON TABLE public.product_customer_group_prices IS 'Product prices per customer group. Maps to ShopRenter customerGroupProductPrice resource.';
COMMENT ON COLUMN public.product_customer_group_prices.price IS 'Price for this product for this specific customer group';
COMMENT ON COLUMN public.product_customer_group_prices.shoprenter_customer_group_price_id IS 'ShopRenter customerGroupProductPrice ID after sync';
COMMENT ON COLUMN public.product_customer_group_prices.last_synced_at IS 'Timestamp when this price was last synced to ShopRenter';

-- =============================================================================
-- Migration: 20250321_create_product_specials_table.sql
-- =============================================================================

-- Create product_specials table for promotions and volume pricing
-- This table stores promotions, volume pricing, and "Product of the Day" features
-- Maps to ShopRenter productSpecial resource

CREATE TABLE IF NOT EXISTS public.product_specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Product reference
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  
  -- ShopRenter sync
  shoprenter_special_id TEXT, -- ShopRenter resource ID (nullable until synced)
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- Customer group (nullable = "Everyone")
  customer_group_id UUID REFERENCES public.customer_groups(id) ON DELETE SET NULL,
  
  -- Promotion details
  priority INTEGER NOT NULL DEFAULT 1, -- Higher priority wins conflicts
  price DECIMAL(15,4) NOT NULL, -- Special price (net)
  
  -- Date range
  date_from DATE, -- NULL = no start date
  date_to DATE, -- NULL = no end date
  
  -- Volume pricing
  min_quantity INTEGER DEFAULT 0, -- 0 = no minimum
  max_quantity INTEGER DEFAULT 0, -- 0 = unlimited
  
  -- Product of the day
  type TEXT DEFAULT 'interval', -- 'interval' or 'day_spec'
  day_of_week INTEGER, -- 1-7 (Monday-Sunday), only for type='day_spec'
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_expired BOOLEAN DEFAULT false, -- Auto-set when date_to < today
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 1 AND day_of_week <= 7)),
  CONSTRAINT valid_priority CHECK (priority >= -1),
  CONSTRAINT valid_quantity_range CHECK (max_quantity = 0 OR max_quantity >= min_quantity),
  CONSTRAINT valid_date_range CHECK (date_to IS NULL OR date_from IS NULL OR date_to >= date_from)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_specials_product_id ON public.product_specials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_specials_connection_id ON public.product_specials(connection_id);
CREATE INDEX IF NOT EXISTS idx_product_specials_customer_group_id ON public.product_specials(customer_group_id);
CREATE INDEX IF NOT EXISTS idx_product_specials_active ON public.product_specials(is_active, is_expired) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_specials_dates ON public.product_specials(date_from, date_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_specials_shoprenter_id ON public.product_specials(shoprenter_special_id) WHERE shoprenter_special_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.product_specials IS 'Product promotions, volume pricing, and special offers';
COMMENT ON COLUMN public.product_specials.priority IS 'Higher priority wins conflicts. Product of day uses -1.';
COMMENT ON COLUMN public.product_specials.price IS 'Special price (net). ShopRenter calculates gross.';
COMMENT ON COLUMN public.product_specials.customer_group_id IS 'NULL = "Everyone" (all customer groups)';
COMMENT ON COLUMN public.product_specials.type IS 'interval = regular promotion, day_spec = product of the day';
COMMENT ON COLUMN public.product_specials.day_of_week IS '1=Monday, 2=Tuesday, ..., 7=Sunday. Only for type=day_spec';

-- RLS Policies
ALTER TABLE public.product_specials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_specials table
DROP POLICY IF EXISTS "Product specials are viewable by authenticated users" ON public.product_specials;
CREATE POLICY "Product specials are viewable by authenticated users" 
ON public.product_specials
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Product specials are manageable by authenticated users" ON public.product_specials;
CREATE POLICY "Product specials are manageable by authenticated users" 
ON public.product_specials
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_specials TO authenticated;

-- Create trigger for product_specials table to automatically update updated_at
DROP TRIGGER IF EXISTS update_product_specials_updated_at ON public.product_specials;
CREATE TRIGGER update_product_specials_updated_at
    BEFORE UPDATE ON public.product_specials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-set is_expired
CREATE OR REPLACE FUNCTION check_product_special_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_to IS NOT NULL AND NEW.date_to < CURRENT_DATE THEN
    NEW.is_expired = true;
  ELSE
    NEW.is_expired = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_specials_check_expiration
  BEFORE INSERT OR UPDATE ON public.product_specials
  FOR EACH ROW
  EXECUTE FUNCTION check_product_special_expiration();

-- Function to get next priority for a product
CREATE OR REPLACE FUNCTION get_next_priority_for_product(p_product_id UUID)
RETURNS INTEGER AS $$
DECLARE
  max_priority INTEGER;
BEGIN
  SELECT COALESCE(MAX(priority), 0) INTO max_priority
  FROM public.product_specials
  WHERE product_id = p_product_id
    AND deleted_at IS NULL
    AND priority > 0; -- Don't count -1 (product of day)
  
  RETURN max_priority + 1;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- Migration: 20250323_create_warehouses_table.sql
-- =============================================================================

-- Create warehouses table
-- This table stores warehouse/raktár information

CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Unique constraint on code
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_code_unique 
ON public.warehouses(code) 
WHERE is_active = true;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_warehouses_is_active 
ON public.warehouses(is_active) 
WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Warehouses are viewable by authenticated users" ON public.warehouses;
CREATE POLICY "Warehouses are viewable by authenticated users" 
ON public.warehouses
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Warehouses are manageable by authenticated users" ON public.warehouses;
CREATE POLICY "Warehouses are manageable by authenticated users" 
ON public.warehouses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;

-- Comments
COMMENT ON TABLE public.warehouses IS 'Warehouses/raktárak for inventory management';
COMMENT ON COLUMN public.warehouses.code IS 'Short code/identifier for the warehouse';


-- =============================================================================
-- Migration: 20250323_create_product_suppliers_table.sql
-- =============================================================================

-- Create product_suppliers table
-- This table stores the relationship between products and suppliers
-- A product can have multiple suppliers, with one preferred supplier

CREATE TABLE IF NOT EXISTS public.product_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    
    -- Supplier-specific product info
    supplier_sku VARCHAR(255), -- Supplier's product code
    supplier_barcode VARCHAR(255), -- Supplier's barcode (different from internal)
    
    -- Pricing & ordering
    default_cost DECIMAL(10,2), -- Last purchase price from this supplier
    last_purchased_at TIMESTAMPTZ,
    min_order_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER, -- Average delivery time
    
    -- Preferences
    is_preferred BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Partial unique index (only for non-deleted records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_suppliers_unique_active 
ON public.product_suppliers(product_id, supplier_id) 
WHERE deleted_at IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id 
ON public.product_suppliers(product_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_id 
ON public.product_suppliers(supplier_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_barcode 
ON public.product_suppliers(supplier_barcode) 
WHERE deleted_at IS NULL AND supplier_barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_suppliers_preferred 
ON public.product_suppliers(supplier_id, is_preferred) 
WHERE deleted_at IS NULL AND is_preferred = true;

-- Trigger for updated_at
CREATE TRIGGER update_product_suppliers_updated_at
BEFORE UPDATE ON public.product_suppliers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Product suppliers are viewable by authenticated users" ON public.product_suppliers;
CREATE POLICY "Product suppliers are viewable by authenticated users" 
ON public.product_suppliers
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Product suppliers are manageable by authenticated users" ON public.product_suppliers;
CREATE POLICY "Product suppliers are manageable by authenticated users" 
ON public.product_suppliers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_suppliers TO authenticated;

-- Comments
COMMENT ON TABLE public.product_suppliers IS 'Relationship between products and suppliers. A product can have multiple suppliers.';
COMMENT ON COLUMN public.product_suppliers.supplier_barcode IS 'Supplier-specific barcode (different from product internal_barcode or gtin)';
COMMENT ON COLUMN public.product_suppliers.is_preferred IS 'Only one supplier should be preferred per product (enforced in application logic)';


-- =============================================================================
-- Migration: 20250323_add_internal_barcode_to_products.sql
-- =============================================================================

-- Add internal_barcode column to shoprenter_products table
-- This is the ERP-generated barcode, separate from supplier/manufacturer barcode (gtin)

ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS internal_barcode VARCHAR(255);

-- Index for barcode scanning (internal barcode)
CREATE INDEX IF NOT EXISTS idx_products_internal_barcode 
ON public.shoprenter_products(internal_barcode) 
WHERE deleted_at IS NULL AND internal_barcode IS NOT NULL;

-- Index for supplier barcode scanning (gtin)
CREATE INDEX IF NOT EXISTS idx_products_gtin_scan 
ON public.shoprenter_products(gtin) 
WHERE deleted_at IS NULL AND gtin IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.shoprenter_products.internal_barcode IS 'Internal ERP-generated barcode (separate from supplier/manufacturer barcode)';
COMMENT ON COLUMN public.shoprenter_products.gtin IS 'Supplier/Manufacturer barcode (from ShopRenter or supplier)';


-- =============================================================================
-- Migration: 20250323_create_purchase_orders_table.sql
-- =============================================================================

-- Create purchase_orders table
-- This table stores purchase orders (beszerzési rendelések)

-- PO Number Sequence
CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

-- PO Number Generator Function
CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT nextval('purchase_order_number_seq') INTO next_val;
  RETURN 'POR-' || 
         TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
         LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_purchase_order_number(),
  
  -- Relationships
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  
  -- Status workflow
  status VARCHAR(20) DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_approval', 'approved', 'partially_received', 'received', 'cancelled')
  ),
  
  -- Email tracking (only relevant when status != 'approved')
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  
  -- Dates
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  
  -- Financial summary (calculated, stored for performance)
  currency_id UUID REFERENCES public.currencies(id),
  total_net DECIMAL(12,2) DEFAULT 0,
  total_vat DECIMAL(12,2) DEFAULT 0,
  total_gross DECIMAL(12,2) DEFAULT 0,
  
  -- Physical summary
  total_weight DECIMAL(10,2) DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  total_quantity DECIMAL(10,2) DEFAULT 0,
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id 
ON public.purchase_orders(supplier_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_warehouse_id 
ON public.purchase_orders(warehouse_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status 
ON public.purchase_orders(status) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_email_sent 
ON public.purchase_orders(email_sent) 
WHERE deleted_at IS NULL AND status != 'approved';

CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date 
ON public.purchase_orders(order_date DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number 
ON public.purchase_orders(po_number);

-- Trigger
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Purchase orders are viewable by authenticated users" ON public.purchase_orders;
CREATE POLICY "Purchase orders are viewable by authenticated users" 
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Purchase orders are manageable by authenticated users" ON public.purchase_orders;
CREATE POLICY "Purchase orders are manageable by authenticated users" 
ON public.purchase_orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;

-- Comments
COMMENT ON TABLE public.purchase_orders IS 'Purchase orders (beszerzési rendelések)';
COMMENT ON COLUMN public.purchase_orders.email_sent IS 'Email tracking only relevant when status != approved';
COMMENT ON COLUMN public.purchase_orders.po_number IS 'Auto-generated format: POR-YYYY-000001';


-- =============================================================================
-- Migration: 20250323_create_purchase_order_items_table.sql
-- =============================================================================

-- Create purchase_order_items table
-- This table stores items (products) in purchase orders

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  
  -- Product reference
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE RESTRICT,
  product_supplier_id UUID REFERENCES public.product_suppliers(id) ON DELETE SET NULL,
  
  -- Quantities
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  received_quantity DECIMAL(10,2) DEFAULT 0,
  
  -- Pricing
  unit_cost DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
  vat_id UUID REFERENCES public.vat(id) ON DELETE RESTRICT,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE RESTRICT,
  
  -- Units & description
  unit_id UUID REFERENCES public.units(id) ON DELETE RESTRICT,
  description TEXT, -- Product name snapshot (for historical accuracy)
  
  -- Warehouse location (assigned during receiving)
  shelf_location VARCHAR(100),
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_items_po_id 
ON public.purchase_order_items(purchase_order_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_product_id 
ON public.purchase_order_items(product_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_product_supplier_id 
ON public.purchase_order_items(product_supplier_id) 
WHERE deleted_at IS NULL AND product_supplier_id IS NOT NULL;

-- Trigger
CREATE TRIGGER update_po_items_updated_at
BEFORE UPDATE ON public.purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "PO items are viewable by authenticated users" ON public.purchase_order_items;
CREATE POLICY "PO items are viewable by authenticated users" 
ON public.purchase_order_items
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "PO items are manageable by authenticated users" ON public.purchase_order_items;
CREATE POLICY "PO items are manageable by authenticated users" 
ON public.purchase_order_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;

-- Comments
COMMENT ON TABLE public.purchase_order_items IS 'Items (products) in purchase orders';
COMMENT ON COLUMN public.purchase_order_items.received_quantity IS 'Updated during shipment receiving';
COMMENT ON COLUMN public.purchase_order_items.description IS 'Product name snapshot for historical accuracy';


-- =============================================================================
-- Migration: 20250323_create_shipments_table.sql
-- =============================================================================

-- Create shipments table
-- This table stores shipments (szállítmányok) - can link to multiple purchase orders

-- Shipment Number Sequence
CREATE SEQUENCE IF NOT EXISTS shipment_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

-- Shipment Number Generator
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT nextval('shipment_number_seq') INTO next_val;
  RETURN 'SHP-' || 
         TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
         LPAD(next_val::TEXT, 7, '0');
END;
$$;

-- Shipments Table
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_shipment_number(),
  
  -- Relationships
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  
  -- Status workflow
  status VARCHAR(20) DEFAULT 'waiting' CHECK (
    status IN ('waiting', 'in_transit', 'arrived', 'inspecting', 'completed', 'cancelled')
  ),
  
  -- Dates
  expected_arrival_date DATE,
  actual_arrival_date DATE,
  purchased_date DATE,
  delivered_date DATE,
  
  -- Financial
  currency_id UUID REFERENCES public.currencies(id),
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_supplier_id 
ON public.shipments(supplier_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_warehouse_id 
ON public.shipments(warehouse_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_status 
ON public.shipments(status) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_shipment_number 
ON public.shipments(shipment_number);

-- Trigger
CREATE TRIGGER update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Shipments are viewable by authenticated users" ON public.shipments;
CREATE POLICY "Shipments are viewable by authenticated users" 
ON public.shipments
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Shipments are manageable by authenticated users" ON public.shipments;
CREATE POLICY "Shipments are manageable by authenticated users" 
ON public.shipments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;

-- Comments
COMMENT ON TABLE public.shipments IS 'Shipments (szállítmányok) - can link to multiple purchase orders from same supplier';
COMMENT ON COLUMN public.shipments.shipment_number IS 'Auto-generated format: SHP-YYYY-0000001';


-- =============================================================================
-- Migration: 20250323_create_shipment_purchase_orders_table.sql
-- =============================================================================

-- Create shipment_purchase_orders table
-- Many-to-many relationship between shipments and purchase orders

CREATE TABLE IF NOT EXISTS public.shipment_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shipment_id, purchase_order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_pos_shipment_id 
ON public.shipment_purchase_orders(shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_pos_po_id 
ON public.shipment_purchase_orders(purchase_order_id);

-- Enable RLS
ALTER TABLE public.shipment_purchase_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Shipment POs are viewable by authenticated users" ON public.shipment_purchase_orders;
CREATE POLICY "Shipment POs are viewable by authenticated users" 
ON public.shipment_purchase_orders
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Shipment POs are manageable by authenticated users" ON public.shipment_purchase_orders;
CREATE POLICY "Shipment POs are manageable by authenticated users" 
ON public.shipment_purchase_orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_purchase_orders TO authenticated;

-- Comments
COMMENT ON TABLE public.shipment_purchase_orders IS 'Many-to-many relationship: one shipment can contain items from multiple purchase orders';


-- =============================================================================
-- Migration: 20250323_create_shipment_items_table.sql
-- =============================================================================

-- Create shipment_items table
-- This table stores items in shipments (supports unexpected products not in PO)

CREATE TABLE IF NOT EXISTS public.shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  
  -- Link to PO item (NULL if unexpected product)
  purchase_order_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  
  -- Product reference (required for all items)
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE RESTRICT,
  
  -- Quantities
  expected_quantity DECIMAL(10,2) DEFAULT 0,
  received_quantity DECIMAL(10,2) DEFAULT 0,
  inspected_quantity DECIMAL(10,2) DEFAULT 0,
  accepted_quantity DECIMAL(10,2) DEFAULT 0,
  rejected_quantity DECIMAL(10,2) DEFAULT 0,
  
  -- Pricing (for unexpected items)
  unit_cost DECIMAL(10,2),
  vat_id UUID REFERENCES public.vat(id),
  currency_id UUID REFERENCES public.currencies(id),
  
  -- Warehouse location
  shelf_location VARCHAR(100),
  
  -- Quality control
  inspection_notes TEXT,
  is_unexpected BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints
-- Drop constraint if exists, then add it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_quantities_sum' 
    AND conrelid = 'public.shipment_items'::regclass
  ) THEN
    ALTER TABLE public.shipment_items DROP CONSTRAINT check_quantities_sum;
  END IF;
END $$;

ALTER TABLE public.shipment_items 
ADD CONSTRAINT check_quantities_sum 
  CHECK (inspected_quantity = accepted_quantity + rejected_quantity);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id 
ON public.shipment_items(shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_items_po_item_id 
ON public.shipment_items(purchase_order_item_id) 
WHERE purchase_order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_items_product_id 
ON public.shipment_items(product_id);

CREATE INDEX IF NOT EXISTS idx_shipment_items_unexpected 
ON public.shipment_items(is_unexpected) 
WHERE is_unexpected = true;

-- Trigger
CREATE TRIGGER update_shipment_items_updated_at
BEFORE UPDATE ON public.shipment_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Shipment items are viewable by authenticated users" ON public.shipment_items;
CREATE POLICY "Shipment items are viewable by authenticated users" 
ON public.shipment_items
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Shipment items are manageable by authenticated users" ON public.shipment_items;
CREATE POLICY "Shipment items are manageable by authenticated users" 
ON public.shipment_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_items TO authenticated;

-- Comments
COMMENT ON TABLE public.shipment_items IS 'Items in shipments. Supports unexpected products not in purchase order.';
COMMENT ON COLUMN public.shipment_items.is_unexpected IS 'TRUE if product was not in the purchase order';
COMMENT ON COLUMN public.shipment_items.unit_cost IS 'Required for unexpected items';


-- =============================================================================
-- Migration: 20250323_create_warehouse_operations_table.sql
-- =============================================================================

-- Create warehouse_operations table
-- This table tracks warehouse operations (bevételezés, transfers, etc.)

-- Warehouse Operation Number Sequence
CREATE SEQUENCE IF NOT EXISTS warehouse_operation_number_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  OWNED BY NONE;

-- Warehouse Operation Number Generator
CREATE OR REPLACE FUNCTION generate_warehouse_operation_number()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT nextval('warehouse_operation_number_seq') INTO next_val;
  RETURN 'WOP-' || 
         TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
         LPAD(next_val::TEXT, 7, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS public.warehouse_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_number VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_warehouse_operation_number(),
  
  -- Relationships
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  
  -- Operation details
  operation_type VARCHAR(20) NOT NULL CHECK (
    operation_type IN ('receiving', 'transfer', 'adjustment', 'picking', 'return')
  ),
  
  status VARCHAR(20) DEFAULT 'waiting' CHECK (
    status IN ('waiting', 'in_progress', 'completed', 'cancelled')
  ),
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- User tracking
  created_by UUID REFERENCES public.users(id),
  completed_by UUID REFERENCES public.users(id),
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_ops_shipment_id 
ON public.warehouse_operations(shipment_id) 
WHERE shipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_ops_warehouse_id 
ON public.warehouse_operations(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_ops_status 
ON public.warehouse_operations(status);

CREATE INDEX IF NOT EXISTS idx_warehouse_ops_type 
ON public.warehouse_operations(operation_type);

CREATE INDEX IF NOT EXISTS idx_warehouse_ops_operation_number 
ON public.warehouse_operations(operation_number);

-- Trigger
CREATE TRIGGER update_warehouse_ops_updated_at
BEFORE UPDATE ON public.warehouse_operations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.warehouse_operations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Warehouse ops are viewable by authenticated users" ON public.warehouse_operations;
CREATE POLICY "Warehouse ops are viewable by authenticated users" 
ON public.warehouse_operations
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Warehouse ops are manageable by authenticated users" ON public.warehouse_operations;
CREATE POLICY "Warehouse ops are manageable by authenticated users" 
ON public.warehouse_operations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_operations TO authenticated;

-- Comments
COMMENT ON TABLE public.warehouse_operations IS 'Warehouse operations (raktári műveletek) - receiving, transfers, adjustments, etc.';
COMMENT ON COLUMN public.warehouse_operations.operation_number IS 'Auto-generated format: WOP-YYYY-0000002';


-- =============================================================================
-- Migration: 20250323_create_stock_movements_table.sql
-- =============================================================================

-- Create stock_movements table
-- This table is an immutable audit trail of all stock movements

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Warehouse & Product
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE RESTRICT,
  
  -- Movement details
  movement_type VARCHAR(20) NOT NULL CHECK (
    movement_type IN ('in', 'out', 'adjustment', 'transfer_in', 'transfer_out', 'reserved', 'released')
  ),
  
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity != 0),
  unit_cost DECIMAL(10,2),
  
  -- Location
  shelf_location VARCHAR(100),
  
  -- Source tracking
  source_type VARCHAR(30) NOT NULL,
  source_id UUID,
  warehouse_operation_id UUID REFERENCES public.warehouse_operations(id) ON DELETE SET NULL,
  
  -- Metadata
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_product 
ON public.stock_movements(warehouse_id, product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id 
ON public.stock_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_source 
ON public.stock_movements(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_op 
ON public.stock_movements(warehouse_operation_id) 
WHERE warehouse_operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at 
ON public.stock_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_type 
ON public.stock_movements(movement_type);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Stock movements are viewable by authenticated users" ON public.stock_movements;
CREATE POLICY "Stock movements are viewable by authenticated users" 
ON public.stock_movements
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Stock movements are insertable by authenticated users" ON public.stock_movements;
CREATE POLICY "Stock movements are insertable by authenticated users" 
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Note: Updates and deletes should be restricted (immutable audit trail)
-- No UPDATE or DELETE policies

-- Grant permissions (only SELECT and INSERT)
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;

-- Comments
COMMENT ON TABLE public.stock_movements IS 'Immutable audit trail of all stock movements. No updates or deletes allowed.';
COMMENT ON COLUMN public.stock_movements.movement_type IS 'in/out: physical movements, reserved/released: allocation, adjustment: corrections';
COMMENT ON COLUMN public.stock_movements.quantity IS 'Positive for in, negative for out';


-- =============================================================================
-- Migration: 20250323_create_stock_summary_view.sql
-- =============================================================================

-- Create stock_summary materialized view
-- Real-time aggregated stock levels per product per warehouse

CREATE MATERIALIZED VIEW IF NOT EXISTS public.stock_summary AS
SELECT 
  sm.warehouse_id,
  w.name AS warehouse_name,
  sm.product_id,
  p.name AS product_name,
  p.sku,
  p.gtin AS supplier_barcode,
  p.internal_barcode,
  
  -- Current stock levels
  COALESCE(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') THEN sm.quantity ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN sm.movement_type IN ('out', 'transfer_out') THEN sm.quantity ELSE 0 END), 0) AS quantity_on_hand,
  
  -- Reserved stock
  COALESCE(SUM(CASE WHEN sm.movement_type = 'reserved' THEN sm.quantity ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN sm.movement_type = 'released' THEN sm.quantity ELSE 0 END), 0) AS quantity_reserved,
  
  -- Available stock
  (COALESCE(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type IN ('out', 'transfer_out') THEN sm.quantity ELSE 0 END), 0)) -
  (COALESCE(SUM(CASE WHEN sm.movement_type = 'reserved' THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type = 'released' THEN sm.quantity ELSE 0 END), 0)) AS quantity_available,
  
  -- Average cost (weighted average of IN movements)
  COALESCE(
    SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') AND sm.unit_cost IS NOT NULL 
        THEN sm.quantity * sm.unit_cost ELSE 0 END)::NUMERIC /
    NULLIF(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') AND sm.unit_cost IS NOT NULL 
        THEN sm.quantity ELSE 0 END), 0),
    0
  ) AS average_cost,
  
  -- Total value
  (COALESCE(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type IN ('out', 'transfer_out') THEN sm.quantity ELSE 0 END), 0)) *
  COALESCE(
    SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') AND sm.unit_cost IS NOT NULL 
        THEN sm.quantity * sm.unit_cost ELSE 0 END)::NUMERIC /
    NULLIF(SUM(CASE WHEN sm.movement_type IN ('in', 'transfer_in') AND sm.unit_cost IS NOT NULL 
        THEN sm.quantity ELSE 0 END), 0),
    0
  ) AS total_value,
  
  -- Last movement
  MAX(sm.created_at) AS last_movement_at
  
FROM public.stock_movements sm
INNER JOIN public.warehouses w ON w.id = sm.warehouse_id
INNER JOIN public.shoprenter_products p ON p.id = sm.product_id
WHERE p.deleted_at IS NULL
GROUP BY sm.warehouse_id, w.name, sm.product_id, p.name, p.sku, p.gtin, p.internal_barcode;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_summary_unique 
ON public.stock_summary(warehouse_id, product_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_stock_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.stock_summary;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON MATERIALIZED VIEW public.stock_summary IS 'Real-time aggregated stock levels per product per warehouse. Refresh manually after stock movements.';
COMMENT ON FUNCTION refresh_stock_summary() IS 'Refresh the stock_summary materialized view. Call after bulk stock movements.';


-- =============================================================================
-- Migration: 20250323_add_purchasing_pages_to_permissions.sql
-- =============================================================================

-- Add purchasing pages to permissions system
-- These pages will be under the "Beszerzés" navigation section

INSERT INTO public.pages (path, name, description, category, is_active) VALUES
('/purchase-orders', 'Beszerzési rendelések', 'Beszerzési rendelések kezelése', 'Beszerzés', true),
('/purchase-orders/new', 'Új beszerzési rendelés', 'Új beszerzési rendelés létrehozása', 'Beszerzés', true),
('/purchase-orders/[id]', 'Beszerzési rendelés szerkesztése', 'Beszerzési rendelés szerkesztése', 'Beszerzés', true),
('/shipments', 'Szállítmányok', 'Szállítmányok kezelése', 'Beszerzés', true),
('/shipments/[id]/receiving', 'Szállítmány bevételezés', 'Szállítmány bevételezése', 'Beszerzés', true)
ON CONFLICT (path) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Grant default access to all existing users for purchasing pages
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path IN ('/purchase-orders', '/purchase-orders/new', '/purchase-orders/[id]', '/shipments', '/shipments/[id]/receiving')
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;


-- =============================================================================
-- Migration: 20250324_add_warehouse_operations_page_to_permissions.sql
-- =============================================================================

-- Add warehouse operations pages to permissions system
-- These pages will be under the "Raktár" navigation section

INSERT INTO public.pages (path, name, description, category, is_active) VALUES
('/warehouse-operations', 'Raktári műveletek', 'Raktári műveletek listázása és kezelése', 'Raktár', true),
('/warehouse-operations/[id]', 'Raktári művelet részletei', 'Raktári művelet részleteinek megtekintése', 'Raktár', true)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Grant default access to all existing users for warehouse operations pages
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path IN ('/warehouse-operations', '/warehouse-operations/[id]')
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_permissions up 
    WHERE up.user_id = u.id AND up.page_id = p.id
  )
ON CONFLICT (user_id, page_id) DO NOTHING;


-- =============================================================================
-- Migration: 20250326_create_customer_persons_table.sql
-- =============================================================================

-- Create customer_persons table
-- Separate table for person customers (individuals)

CREATE TABLE IF NOT EXISTS public.customer_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal info
  firstname VARCHAR(255) NOT NULL,
  lastname VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telephone VARCHAR(50),
  website VARCHAR(255),
  
  -- Identifier (belső ERP azonosító)
  identifier VARCHAR(100),
  
  -- Source tracking (webshop sync vs local creation)
  source VARCHAR(20) DEFAULT 'local', -- 'local' or 'webshop_sync'
  
  -- Relationships
  customer_group_id UUID REFERENCES customer_groups(id),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Default addresses (foreign keys added after customer_addresses table is updated)
  default_billing_address_id UUID,
  default_shipping_address_id UUID,
  
  -- Personal tax number (can be used for individuals)
  tax_number VARCHAR(50),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT customer_persons_source_check CHECK (source IN ('local', 'webshop_sync'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_persons_source ON public.customer_persons(source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_email ON public.customer_persons(email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_name ON public.customer_persons(firstname, lastname) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_customer_group ON public.customer_persons(customer_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_active ON public.customer_persons(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_deleted_at ON public.customer_persons(deleted_at) WHERE deleted_at IS NULL;

-- Unique constraints (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS customer_persons_email_unique_active 
ON public.customer_persons(email) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_persons_updated_at
BEFORE UPDATE ON public.customer_persons
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_persons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer persons are viewable by authenticated users" ON public.customer_persons;
CREATE POLICY "Customer persons are viewable by authenticated users" 
ON public.customer_persons
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer persons are manageable by authenticated users" ON public.customer_persons;
CREATE POLICY "Customer persons are manageable by authenticated users" 
ON public.customer_persons
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_persons TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_persons IS 'Separate table for person customers (individuals). Can be linked to companies via customer_person_company_relationships.';
COMMENT ON COLUMN public.customer_persons.source IS 'Source: local (created in ERP) or webshop_sync (synced from webshop)';
COMMENT ON COLUMN public.customer_persons.tax_number IS 'Personal tax number (can be used for individuals)';


-- =============================================================================
-- Migration: 20250326_create_customer_companies_table.sql
-- =============================================================================

-- Create customer_companies table
-- Separate table for company customers

CREATE TABLE IF NOT EXISTS public.customer_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company info
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telephone VARCHAR(50),
  website VARCHAR(255),
  
  -- Identifier (belső ERP azonosító)
  identifier VARCHAR(100),
  
  -- Source tracking (webshop sync vs local creation)
  source VARCHAR(20) DEFAULT 'local', -- 'local' or 'webshop_sync'
  
  -- Relationships
  customer_group_id UUID REFERENCES customer_groups(id),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Default addresses (foreign keys added after customer_addresses table is updated)
  default_billing_address_id UUID,
  default_shipping_address_id UUID,
  registered_address_id UUID, -- Székhely
  mailing_address_id UUID,    -- Levelezési cím
  
  -- Tax numbers
  tax_number VARCHAR(50),              -- Adószám
  eu_tax_number VARCHAR(50),           -- Közösségi adószám
  group_tax_number VARCHAR(50),        -- Csoportos adószám
  company_registration_number VARCHAR(50), -- Cégjegyzékszám
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT customer_companies_source_check CHECK (source IN ('local', 'webshop_sync'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_companies_source ON public.customer_companies(source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_email ON public.customer_companies(email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_name ON public.customer_companies(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_customer_group ON public.customer_companies(customer_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_active ON public.customer_companies(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_deleted_at ON public.customer_companies(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_tax_number ON public.customer_companies(tax_number) WHERE deleted_at IS NULL AND tax_number IS NOT NULL;

-- Unique constraints (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS customer_companies_email_unique_active 
ON public.customer_companies(email) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_companies_name_unique_active 
ON public.customer_companies(name) 
WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_companies_updated_at
BEFORE UPDATE ON public.customer_companies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer companies are viewable by authenticated users" ON public.customer_companies;
CREATE POLICY "Customer companies are viewable by authenticated users" 
ON public.customer_companies
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer companies are manageable by authenticated users" ON public.customer_companies;
CREATE POLICY "Customer companies are manageable by authenticated users" 
ON public.customer_companies
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_companies TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_companies IS 'Separate table for company customers. Can be linked to persons via customer_person_company_relationships.';
COMMENT ON COLUMN public.customer_companies.source IS 'Source: local (created in ERP) or webshop_sync (synced from webshop)';


-- =============================================================================
-- Migration: 20250326_create_customer_person_company_relationships_table.sql
-- =============================================================================

-- Create customer_person_company_relationships table
-- Many-to-many relationship between persons and companies
-- Allows linking persons to companies (e.g., contact person, owner, manager)

CREATE TABLE IF NOT EXISTS public.customer_person_company_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  person_id UUID NOT NULL REFERENCES customer_persons(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES customer_companies(id) ON DELETE CASCADE,
  
  -- Relationship role
  role VARCHAR(50) NOT NULL DEFAULT 'contact_person',
  -- 'owner', 'contact_person', 'manager', 'accountant', 'other'
  
  -- Flags
  is_primary BOOLEAN DEFAULT false, -- Primary contact person for the company
  is_billing_contact BOOLEAN DEFAULT false, -- Contact for billing matters
  is_shipping_contact BOOLEAN DEFAULT false, -- Contact for shipping matters
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT customer_person_company_relationships_role_check 
    CHECK (role IN ('owner', 'contact_person', 'manager', 'accountant', 'other')),
  UNIQUE(person_id, company_id, deleted_at) -- One relationship per person-company pair (when not deleted)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_person_id 
  ON public.customer_person_company_relationships(person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_company_id 
  ON public.customer_person_company_relationships(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_role 
  ON public.customer_person_company_relationships(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_primary 
  ON public.customer_person_company_relationships(is_primary) WHERE deleted_at IS NULL AND is_primary = true;

-- Trigger for updated_at
CREATE TRIGGER update_customer_person_company_relationships_updated_at
BEFORE UPDATE ON public.customer_person_company_relationships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_person_company_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer person company relationships are viewable by authenticated users" ON public.customer_person_company_relationships;
CREATE POLICY "Customer person company relationships are viewable by authenticated users" 
ON public.customer_person_company_relationships
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer person company relationships are manageable by authenticated users" ON public.customer_person_company_relationships;
CREATE POLICY "Customer person company relationships are manageable by authenticated users" 
ON public.customer_person_company_relationships
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_person_company_relationships TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_person_company_relationships IS 'Many-to-many relationships between persons and companies. Allows linking persons to companies with roles (owner, contact_person, etc.).';
COMMENT ON COLUMN public.customer_person_company_relationships.role IS 'Role: owner, contact_person, manager, accountant, other';
COMMENT ON COLUMN public.customer_person_company_relationships.is_primary IS 'Primary contact person for the company';


-- =============================================================================
-- Migration: 20250325_create_customer_addresses_table.sql
-- =============================================================================

-- Create customer_addresses table
-- This table stores multiple addresses for customer entities (both persons and companies)

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Support both old (customer_entity_id) and new (person_id/company_id) structure for migration
  customer_entity_id UUID, -- DEPRECATED: Will be removed after migration
  person_id UUID REFERENCES customer_persons(id) ON DELETE CASCADE,
  company_id UUID REFERENCES customer_companies(id) ON DELETE CASCADE,
  
  -- Address type
  address_type VARCHAR(20) NOT NULL DEFAULT 'billing', 
  -- 'billing' (számlázási), 'shipping' (szállítási), 
  -- 'registered' (székhely - csak cégeknél), 'mailing' (levelezési - csak cégeknél)
  
  -- Personal/Company info
  firstname VARCHAR(255), -- For persons
  lastname VARCHAR(255),   -- For persons
  company VARCHAR(255),   -- For companies or if person wants company name on address
  
  -- Address details
  address1 VARCHAR(255) NOT NULL,
  address2 VARCHAR(255),
  postcode VARCHAR(20) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country_code VARCHAR(3) DEFAULT 'HU', -- ISO country code
  zone_name VARCHAR(100),  -- State/province name
  
  -- Contact
  telephone VARCHAR(50),
  
  -- Flags
  is_default_billing BOOLEAN DEFAULT false,
  is_default_shipping BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT customer_addresses_type_check 
    CHECK (address_type IN ('billing', 'shipping', 'registered', 'mailing')),
  CONSTRAINT customer_addresses_entity_check 
    CHECK (
      (person_id IS NOT NULL AND company_id IS NULL) OR 
      (person_id IS NULL AND company_id IS NOT NULL) OR
      (customer_entity_id IS NOT NULL AND person_id IS NULL AND company_id IS NULL) -- Support old structure during migration
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_addresses_entity_id ON public.customer_addresses(customer_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_person_id ON public.customer_addresses(person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_company_id ON public.customer_addresses(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_type ON public.customer_addresses(address_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_default_billing ON public.customer_addresses(is_default_billing) WHERE deleted_at IS NULL AND is_default_billing = true;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_default_shipping ON public.customer_addresses(is_default_shipping) WHERE deleted_at IS NULL AND is_default_shipping = true;

-- Trigger for updated_at
CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer addresses are viewable by authenticated users" ON public.customer_addresses;
CREATE POLICY "Customer addresses are viewable by authenticated users" 
ON public.customer_addresses
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer addresses are manageable by authenticated users" ON public.customer_addresses;
CREATE POLICY "Customer addresses are manageable by authenticated users" 
ON public.customer_addresses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_addresses IS 'Multiple addresses for customer entities (persons and companies)';
COMMENT ON COLUMN public.customer_addresses.address_type IS 'Type: billing, shipping, registered (székhely), mailing (levelezési)';
COMMENT ON COLUMN public.customer_addresses.country_code IS 'ISO country code (e.g., HU, DE, AT)';


-- =============================================================================
-- Migration: 20250325_create_customer_bank_accounts_table.sql
-- =============================================================================

-- Create customer_bank_accounts table
-- This table stores multiple bank accounts for customer entities (mainly for companies)

CREATE TABLE IF NOT EXISTS public.customer_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Support both old (customer_entity_id) and new (person_id/company_id) structure for migration
  customer_entity_id UUID, -- DEPRECATED: Will be removed after migration
  person_id UUID REFERENCES customer_persons(id) ON DELETE CASCADE,
  company_id UUID REFERENCES customer_companies(id) ON DELETE CASCADE,
  
  -- Bank info
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100) NOT NULL, -- IBAN or account number
  swift_bic VARCHAR(20), -- SWIFT/BIC code
  currency_id UUID REFERENCES currencies(id),
  
  -- Flags
  is_default BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT customer_bank_accounts_entity_check 
    CHECK (
      (person_id IS NOT NULL AND company_id IS NULL) OR 
      (person_id IS NULL AND company_id IS NOT NULL) OR
      (customer_entity_id IS NOT NULL AND person_id IS NULL AND company_id IS NULL) -- Support old structure during migration
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_entity_id ON public.customer_bank_accounts(customer_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_person_id ON public.customer_bank_accounts(person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_company_id ON public.customer_bank_accounts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_default ON public.customer_bank_accounts(is_default) WHERE deleted_at IS NULL AND is_default = true;
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_currency ON public.customer_bank_accounts(currency_id) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_bank_accounts_updated_at
BEFORE UPDATE ON public.customer_bank_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer bank accounts are viewable by authenticated users" ON public.customer_bank_accounts;
CREATE POLICY "Customer bank accounts are viewable by authenticated users" 
ON public.customer_bank_accounts
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer bank accounts are manageable by authenticated users" ON public.customer_bank_accounts;
CREATE POLICY "Customer bank accounts are manageable by authenticated users" 
ON public.customer_bank_accounts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_bank_accounts TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_bank_accounts IS 'Multiple bank accounts for customer entities (mainly for companies)';
COMMENT ON COLUMN public.customer_bank_accounts.account_number IS 'IBAN or account number';
COMMENT ON COLUMN public.customer_bank_accounts.swift_bic IS 'SWIFT/BIC code for international transfers';


-- =============================================================================
-- Migration: 20250326_update_customer_platform_mappings_for_persons_companies.sql
-- =============================================================================

-- Create customer_platform_mappings table
-- This table stores platform-specific IDs for customers (persons and companies)
-- Used for syncing customers between ERP and webshops

CREATE TABLE IF NOT EXISTS public.customer_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to person OR company (not both)
  person_id UUID REFERENCES customer_persons(id) ON DELETE CASCADE,
  company_id UUID REFERENCES customer_companies(id) ON DELETE CASCADE,
  
  connection_id UUID NOT NULL REFERENCES webshop_connections(id) ON DELETE CASCADE,
  
  -- Platform-specific IDs
  platform_customer_id TEXT NOT NULL,
  platform_inner_id TEXT,
  platform_username TEXT,
  
  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  last_synced_from_platform_at TIMESTAMPTZ,
  last_synced_to_platform_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT customer_platform_mappings_entity_check 
    CHECK (
      (person_id IS NOT NULL AND company_id IS NULL) OR 
      (person_id IS NULL AND company_id IS NOT NULL)
    ),
  UNIQUE(person_id, connection_id) WHERE person_id IS NOT NULL,
  UNIQUE(company_id, connection_id) WHERE company_id IS NOT NULL,
  UNIQUE(connection_id, platform_customer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_person_id 
  ON public.customer_platform_mappings(person_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_company_id 
  ON public.customer_platform_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_connection_id 
  ON public.customer_platform_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_platform_id 
  ON public.customer_platform_mappings(platform_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_synced_from 
  ON public.customer_platform_mappings(last_synced_from_platform_at) 
  WHERE last_synced_from_platform_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_synced_to 
  ON public.customer_platform_mappings(last_synced_to_platform_at) 
  WHERE last_synced_to_platform_at IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_platform_mappings_updated_at
BEFORE UPDATE ON public.customer_platform_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_platform_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer platform mappings are viewable by authenticated users" ON public.customer_platform_mappings;
CREATE POLICY "Customer platform mappings are viewable by authenticated users" 
ON public.customer_platform_mappings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Customer platform mappings are manageable by authenticated users" ON public.customer_platform_mappings;
CREATE POLICY "Customer platform mappings are manageable by authenticated users" 
ON public.customer_platform_mappings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_platform_mappings TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_platform_mappings IS 'Platform-specific customer IDs for syncing between ERP and webshops. References either person or company.';
COMMENT ON COLUMN public.customer_platform_mappings.person_id IS 'References customer_persons(id) - for person platform mappings';
COMMENT ON COLUMN public.customer_platform_mappings.company_id IS 'References customer_companies(id) - for company platform mappings';

-- Create customer_address_platform_mappings table
CREATE TABLE IF NOT EXISTS public.customer_address_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id UUID NOT NULL REFERENCES customer_addresses(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES webshop_connections(id) ON DELETE CASCADE,
  
  platform_address_id TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(address_id, connection_id),
  UNIQUE(connection_id, platform_address_id)
);

-- Indexes for address mappings
CREATE INDEX IF NOT EXISTS idx_customer_address_platform_mappings_address_id ON public.customer_address_platform_mappings(address_id);
CREATE INDEX IF NOT EXISTS idx_customer_address_platform_mappings_connection_id ON public.customer_address_platform_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_customer_address_platform_mappings_platform_id ON public.customer_address_platform_mappings(platform_address_id);

-- Trigger for updated_at
CREATE TRIGGER update_customer_address_platform_mappings_updated_at
BEFORE UPDATE ON public.customer_address_platform_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_address_platform_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer address platform mappings are viewable by authenticated users" ON public.customer_address_platform_mappings;
CREATE POLICY "Customer address platform mappings are viewable by authenticated users" 
ON public.customer_address_platform_mappings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Customer address platform mappings are manageable by authenticated users" ON public.customer_address_platform_mappings;
CREATE POLICY "Customer address platform mappings are manageable by authenticated users" 
ON public.customer_address_platform_mappings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_address_platform_mappings TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_address_platform_mappings IS 'Platform-specific address IDs for syncing customer addresses between ERP and webshops';


-- =============================================================================
-- Migration: 20250326_add_foreign_keys_for_persons_companies.sql
-- =============================================================================

-- Add foreign key constraints for default addresses in customer_persons and customer_companies

-- Customer persons default addresses
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_persons
    ADD CONSTRAINT IF NOT EXISTS fk_customer_persons_default_billing_address 
    FOREIGN KEY (default_billing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_persons
    ADD CONSTRAINT IF NOT EXISTS fk_customer_persons_default_shipping_address 
    FOREIGN KEY (default_shipping_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Customer companies default addresses
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT IF NOT EXISTS fk_customer_companies_default_billing_address 
    FOREIGN KEY (default_billing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT IF NOT EXISTS fk_customer_companies_default_shipping_address 
    FOREIGN KEY (default_shipping_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT IF NOT EXISTS fk_customer_companies_registered_address 
    FOREIGN KEY (registered_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT IF NOT EXISTS fk_customer_companies_mailing_address 
    FOREIGN KEY (mailing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
  END IF;
END $$;


-- =============================================================================
-- Migration: 20250326_add_customer_persons_companies_pages_to_permissions.sql
-- =============================================================================

-- Add pages for customer persons and companies to permissions system

-- Add pages
INSERT INTO public.pages (path, name, description, icon, category, is_active)
VALUES 
  ('/customers/persons', 'Személyek', 'Vevő személyek kezelése', 'ri-user-line', 'Vevők', true),
  ('/customers/persons/new', 'Új személy', 'Új vevő személy létrehozása', 'ri-user-add-line', 'Vevők', true),
  ('/customers/persons/[id]', 'Személy szerkesztése', 'Vevő személy szerkesztése', 'ri-user-settings-line', 'Vevők', true),
  ('/customers/companies', 'Cégek', 'Vevő cégek kezelése', 'ri-building-line', 'Vevők', true),
  ('/customers/companies/new', 'Új cég', 'Új vevő cég létrehozása', 'ri-building-add-line', 'Vevők', true),
  ('/customers/companies/[id]', 'Cég szerkesztése', 'Vevő cég szerkesztése', 'ri-building-settings-line', 'Vevők', true)
ON CONFLICT (path) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Grant default access to all authenticated users
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path IN (
  '/customers/persons',
  '/customers/persons/new',
  '/customers/persons/[id]',
  '/customers/companies',
  '/customers/companies/new',
  '/customers/companies/[id]'
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.user_permissions up 
  WHERE up.user_id = u.id AND up.page_id = p.id
)
ON CONFLICT (user_id, page_id) DO NOTHING;


-- =============================================================================
-- Migration: 20250130_create_order_management_system.sql
-- =============================================================================

-- =============================================================================
-- Order Management System - Complete Database Schema
-- =============================================================================
-- This migration creates the complete order management system including:
-- - Order buffer (for web order review)
-- - Orders and order items
-- - Shipping and payment methods (enhanced)
-- - All supporting tables, indexes, triggers, and RLS policies
-- =============================================================================

-- =============================================================================
-- 1. ENHANCE PAYMENT_METHODS TABLE (Add missing columns for order management)
-- =============================================================================

-- Add tenant_id if not exists (for multi-tenant support)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN tenant_id UUID;
  END IF;
END $$;

-- Add code column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'code'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN code TEXT;
  END IF;
END $$;

-- Add icon_url column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'icon_url'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN icon_url TEXT;
  END IF;
END $$;

-- Add requires_prepayment column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'requires_prepayment'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN requires_prepayment BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add payment_after_delivery column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods' 
    AND column_name = 'payment_after_delivery'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN payment_after_delivery BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create unique index for tenant_id + code if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_tenant_code 
ON public.payment_methods(tenant_id, code) 
WHERE deleted_at IS NULL AND code IS NOT NULL;

-- Create index for tenant_id if not exists
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id 
ON public.payment_methods(tenant_id) 
WHERE tenant_id IS NOT NULL;

-- =============================================================================
-- 2. CREATE SHIPPING_METHODS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, -- For multi-tenant support (nullable for now)
  name TEXT NOT NULL, -- Display name (e.g., "GLS csomagpont")
  code TEXT, -- Internal code (WSESHIP, GLS, etc.)
  extension TEXT, -- Extension type (GLSPARCELPOINT, etc.)
  icon_url TEXT, -- Icon/image URL for visual display
  requires_pickup_point BOOLEAN DEFAULT false, -- Whether pickup point ID is required
  supports_tracking BOOLEAN DEFAULT true, -- Whether tracking number can be added
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for shipping_methods
CREATE INDEX IF NOT EXISTS idx_shipping_methods_tenant_id 
ON public.shipping_methods(tenant_id) 
WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipping_methods_tenant_code 
ON public.shipping_methods(tenant_id, code) 
WHERE deleted_at IS NULL AND code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_methods_code 
ON public.shipping_methods(tenant_id, code) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_methods_is_active 
ON public.shipping_methods(is_active) 
WHERE deleted_at IS NULL;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_shipping_methods_updated_at ON public.shipping_methods;
CREATE TRIGGER update_shipping_methods_updated_at
  BEFORE UPDATE ON public.shipping_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipping_methods
DROP POLICY IF EXISTS "Shipping methods are viewable by authenticated users" ON public.shipping_methods;
CREATE POLICY "Shipping methods are viewable by authenticated users" 
ON public.shipping_methods
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Shipping methods are manageable by authenticated users" ON public.shipping_methods;
CREATE POLICY "Shipping methods are manageable by authenticated users" 
ON public.shipping_methods
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_methods TO authenticated;

-- =============================================================================
-- Migration: 20250327_create_connection_payment_method_mappings.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.connection_payment_method_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  platform_payment_code TEXT NOT NULL,
  platform_payment_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, platform_payment_code),
  UNIQUE(connection_id, payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_connection_payment_mappings_connection
  ON public.connection_payment_method_mappings(connection_id);

CREATE INDEX IF NOT EXISTS idx_connection_payment_mappings_payment_method
  ON public.connection_payment_method_mappings(payment_method_id);

DROP TRIGGER IF EXISTS update_connection_payment_method_mappings_updated_at ON public.connection_payment_method_mappings;
CREATE TRIGGER update_connection_payment_method_mappings_updated_at
  BEFORE UPDATE ON public.connection_payment_method_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.connection_payment_method_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Connection payment mappings are viewable by authenticated users" ON public.connection_payment_method_mappings;
CREATE POLICY "Connection payment mappings are viewable by authenticated users"
  ON public.connection_payment_method_mappings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Connection payment mappings are manageable by authenticated users" ON public.connection_payment_method_mappings;
CREATE POLICY "Connection payment mappings are manageable by authenticated users"
  ON public.connection_payment_method_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_payment_method_mappings TO authenticated;

-- =============================================================================
-- Migration: 20250327_create_connection_shipping_method_mappings.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.connection_shipping_method_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  shipping_method_id UUID NOT NULL REFERENCES public.shipping_methods(id) ON DELETE CASCADE,
  platform_shipping_code TEXT NOT NULL,
  platform_shipping_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, platform_shipping_code),
  UNIQUE(connection_id, shipping_method_id)
);

CREATE INDEX IF NOT EXISTS idx_connection_shipping_mappings_connection
  ON public.connection_shipping_method_mappings(connection_id);

CREATE INDEX IF NOT EXISTS idx_connection_shipping_mappings_shipping_method
  ON public.connection_shipping_method_mappings(shipping_method_id);

DROP TRIGGER IF EXISTS update_connection_shipping_method_mappings_updated_at ON public.connection_shipping_method_mappings;
CREATE TRIGGER update_connection_shipping_method_mappings_updated_at
  BEFORE UPDATE ON public.connection_shipping_method_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.connection_shipping_method_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Connection shipping mappings are viewable by authenticated users" ON public.connection_shipping_method_mappings;
CREATE POLICY "Connection shipping mappings are viewable by authenticated users"
  ON public.connection_shipping_method_mappings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Connection shipping mappings are manageable by authenticated users" ON public.connection_shipping_method_mappings;
CREATE POLICY "Connection shipping mappings are manageable by authenticated users"
  ON public.connection_shipping_method_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_shipping_method_mappings TO authenticated;

-- =============================================================================
-- 3. CREATE ORDER_BUFFER TABLE (Web Order Buffer - Like Thanaris)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, -- For multi-tenant support (nullable for now)
  connection_id UUID REFERENCES public.webshop_connections(id) ON DELETE SET NULL, -- Foreign key to webshop_connections
  
  -- Platform Info
  platform_order_id TEXT NOT NULL, -- ShopRenter innerId
  platform_order_resource_id TEXT,
  
  -- Raw Webhook Data (JSONB for flexibility)
  webhook_data JSONB NOT NULL,
  
  -- Processing Status
  status TEXT DEFAULT 'pending', -- pending, processing, processed, failed, blacklisted
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES public.users(id),
  error_message TEXT,
  
  -- Blacklist (if customer is blacklisted)
  is_blacklisted BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  
  -- Timestamps
  received_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT order_buffer_status_check CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'blacklisted'))
);

-- Create indexes for order_buffer
CREATE INDEX IF NOT EXISTS idx_order_buffer_tenant_id ON public.order_buffer(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_buffer_connection_id ON public.order_buffer(connection_id) WHERE connection_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_buffer_connection_platform_order 
ON public.order_buffer(connection_id, platform_order_id) 
WHERE connection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_buffer_status ON public.order_buffer(status);
CREATE INDEX IF NOT EXISTS idx_order_buffer_received_at ON public.order_buffer(received_at);
CREATE INDEX IF NOT EXISTS idx_order_buffer_is_blacklisted ON public.order_buffer(is_blacklisted) WHERE is_blacklisted = true;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_order_buffer_updated_at ON public.order_buffer;
CREATE TRIGGER update_order_buffer_updated_at
  BEFORE UPDATE ON public.order_buffer
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.order_buffer ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_buffer
DROP POLICY IF EXISTS "Order buffer is viewable by authenticated users" ON public.order_buffer;
CREATE POLICY "Order buffer is viewable by authenticated users" 
ON public.order_buffer
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Order buffer is manageable by authenticated users" ON public.order_buffer;
CREATE POLICY "Order buffer is manageable by authenticated users" 
ON public.order_buffer
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_buffer TO authenticated;

-- =============================================================================
-- 4. CREATE ORDERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, -- For multi-tenant support (nullable for now)
  connection_id UUID, -- References webshop_connections(id) - will add FK later if table exists
  
  -- Order Identification
  order_number TEXT UNIQUE NOT NULL, -- ORD-YYYY-MM-DD-NNN
  platform_order_id TEXT, -- ShopRenter innerId
  platform_order_resource_id TEXT, -- ShopRenter resource ID
  invoice_number TEXT, -- From ShopRenter
  invoice_prefix TEXT,
  
  -- Customer Link
  customer_person_id UUID, -- References customer_persons(id) - will add FK later if table exists
  
  -- Customer Info (Snapshot at order time)
  customer_firstname TEXT NOT NULL,
  customer_lastname TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_group_id UUID, -- References customer_groups(id) - will add FK later if table exists
  
  -- Shipping Address
  shipping_firstname TEXT NOT NULL,
  shipping_lastname TEXT NOT NULL,
  shipping_company TEXT,
  shipping_address1 TEXT NOT NULL,
  shipping_address2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_postcode TEXT NOT NULL,
  shipping_country_code TEXT, -- ISO 2
  shipping_zone_name TEXT,
  shipping_method_id UUID REFERENCES public.shipping_methods(id),
  shipping_method_name TEXT, -- Snapshot from ShopRenter
  shipping_method_code TEXT, -- WSESHIP, GLS, etc.
  shipping_method_extension TEXT, -- Extension type
  shipping_receiving_point_id TEXT, -- Pickup point ID
  shipping_net_price NUMERIC(10,2),
  shipping_gross_price NUMERIC(10,2),
  shipping_additional_cost_net NUMERIC(10,2) DEFAULT 0,
  shipping_additional_cost_gross NUMERIC(10,2) DEFAULT 0,
  expected_delivery_date DATE,
  tracking_number TEXT,
  
  -- Billing Address
  billing_firstname TEXT NOT NULL,
  billing_lastname TEXT NOT NULL,
  billing_company TEXT,
  billing_address1 TEXT NOT NULL,
  billing_address2 TEXT,
  billing_city TEXT NOT NULL,
  billing_postcode TEXT NOT NULL,
  billing_country_code TEXT, -- ISO 2
  billing_zone_name TEXT,
  billing_tax_number TEXT,
  
  -- Payment Info
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_method_name TEXT, -- Snapshot from ShopRenter
  payment_method_code TEXT, -- COD, BANK_TRANSFER, etc.
  payment_method_after BOOLEAN DEFAULT true, -- true = pay later
  payment_net_price NUMERIC(10,2) DEFAULT 0,
  payment_gross_price NUMERIC(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending', -- pending, partial, paid, refunded
  payment_date TIMESTAMP,
  
  -- Order Totals
  subtotal_net NUMERIC(10,2) NOT NULL,
  subtotal_gross NUMERIC(10,2) NOT NULL,
  tax_amount NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) DEFAULT 0, -- Coupon + quantity discounts
  shipping_total_net NUMERIC(10,2) DEFAULT 0,
  shipping_total_gross NUMERIC(10,2) DEFAULT 0,
  payment_total_net NUMERIC(10,2) DEFAULT 0,
  payment_total_gross NUMERIC(10,2) DEFAULT 0,
  total_net NUMERIC(10,2) NOT NULL,
  total_gross NUMERIC(10,2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'HUF',
  
  -- Status & Workflow
  status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review, new, packing, shipped, delivered, cancelled, refunded
  platform_status_id TEXT, -- ShopRenter status ID
  platform_status_text TEXT, -- ShopRenter status text
  
  -- Stock & Fulfillment
  fulfillability_status TEXT DEFAULT 'unknown', -- unknown, checking, fully_fulfillable, partially_fulfillable, not_fulfillable, po_created
  stock_reserved BOOLEAN DEFAULT false, -- Whether stock is reserved for this order
  warehouse_id UUID, -- References warehouses(id) - will add FK later if table exists
  fulfillment_date DATE, -- When order was fulfilled
  
  -- Additional Info
  customer_comment TEXT,
  internal_notes TEXT, -- ERP-only notes
  language_code TEXT DEFAULT 'hu',
  ip_address TEXT,
  cart_token TEXT,
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_used INTEGER DEFAULT 0,
  
  -- Timestamps
  order_date TIMESTAMP NOT NULL, -- From ShopRenter dateCreated
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  CONSTRAINT orders_status_check CHECK (status IN ('pending_review', 'new', 'packing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  CONSTRAINT orders_fulfillability_status_check CHECK (fulfillability_status IN ('unknown', 'checking', 'fully_fulfillable', 'partially_fulfillable', 'not_fulfillable', 'po_created'))
);

-- Create indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_connection_id ON public.orders(connection_id) WHERE connection_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_platform_order_id ON public.orders(connection_id, platform_order_id) WHERE connection_id IS NOT NULL AND platform_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_person_id ON public.orders(customer_person_id) WHERE customer_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillability_status ON public.orders(fulfillability_status);
CREATE INDEX IF NOT EXISTS idx_orders_stock_reserved ON public.orders(stock_reserved) WHERE stock_reserved = true;
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
DROP POLICY IF EXISTS "Orders are viewable by authenticated users" ON public.orders;
CREATE POLICY "Orders are viewable by authenticated users" 
ON public.orders
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Orders are manageable by authenticated users" ON public.orders;
CREATE POLICY "Orders are manageable by authenticated users" 
ON public.orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;

-- =============================================================================
-- 5. CREATE ORDER_ITEMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- Product Link
  product_id UUID, -- References shoprenter_products(id) - nullable if product doesn't exist
  
  -- Product Info (Snapshot at order time)
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_model_number TEXT, -- Manufacturer part number
  product_gtin TEXT, -- Barcode
  product_image_url TEXT,
  product_category TEXT, -- Comma-separated
  
  -- Pricing (Snapshot)
  unit_price_net NUMERIC(10,2) NOT NULL,
  unit_price_gross NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL, -- e.g., 27.00
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_net NUMERIC(10,2) NOT NULL,
  line_total_gross NUMERIC(10,2) NOT NULL,
  
  -- Physical Properties
  weight NUMERIC(10,3),
  weight_unit_id UUID, -- References weight_units(id) - will add FK later if table exists
  length NUMERIC(10,2),
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  dimension_unit_id UUID, -- References units(id) - usually 'cm'
  
  -- Platform Info
  platform_order_item_id TEXT, -- ShopRenter orderProduct innerId
  platform_order_item_resource_id TEXT,
  
  -- Stock & Fulfillment
  fulfillability_status TEXT DEFAULT 'unknown', -- unknown, checking, fully_fulfillable, partially_fulfillable, not_fulfillable, po_created
  reserved_quantity INTEGER DEFAULT 0, -- How much is reserved from stock
  purchase_order_id UUID, -- References purchase_orders(id) - will add FK later if table exists
  purchase_order_item_id UUID, -- References purchase_order_items(id) - will add FK later if table exists
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, reserved, picked, packed, shipped, delivered, cancelled
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  CONSTRAINT order_items_status_check CHECK (status IN ('pending', 'reserved', 'picked', 'packed', 'shipped', 'delivered', 'cancelled')),
  CONSTRAINT order_items_fulfillability_status_check CHECK (fulfillability_status IN ('unknown', 'checking', 'fully_fulfillable', 'partially_fulfillable', 'not_fulfillable', 'po_created'))
);

-- Create indexes for order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_fulfillability_status ON public.order_items(fulfillability_status);
CREATE INDEX IF NOT EXISTS idx_order_items_purchase_order_id ON public.order_items(purchase_order_id) WHERE purchase_order_id IS NOT NULL;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_order_items_updated_at ON public.order_items;
CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_items
DROP POLICY IF EXISTS "Order items are viewable by authenticated users" ON public.order_items;
CREATE POLICY "Order items are viewable by authenticated users" 
ON public.order_items
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Order items are manageable by authenticated users" ON public.order_items;
CREATE POLICY "Order items are manageable by authenticated users" 
ON public.order_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;

-- =============================================================================
-- 6. CREATE ORDER_ITEM_OPTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  option_name TEXT NOT NULL,
  option_value TEXT NOT NULL,
  price_adjustment_net NUMERIC(10,2) DEFAULT 0,
  price_adjustment_gross NUMERIC(10,2) DEFAULT 0,
  price_prefix TEXT CHECK (price_prefix IN ('+', '-')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_options_order_item_id ON public.order_item_options(order_item_id);
ALTER TABLE public.order_item_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order item options are viewable by authenticated users" ON public.order_item_options;
CREATE POLICY "Order item options are viewable by authenticated users" ON public.order_item_options FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Order item options are manageable by authenticated users" ON public.order_item_options;
CREATE POLICY "Order item options are manageable by authenticated users" ON public.order_item_options FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_options TO authenticated;

-- =============================================================================
-- 7. CREATE ORDER_ITEM_ADDONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  addon_name TEXT NOT NULL,
  addon_sku TEXT,
  addon_type TEXT,
  unit_price_net NUMERIC(10,2) NOT NULL,
  unit_price_gross NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total_net NUMERIC(10,2) NOT NULL,
  line_total_gross NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_addons_order_item_id ON public.order_item_addons(order_item_id);
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order item addons are viewable by authenticated users" ON public.order_item_addons;
CREATE POLICY "Order item addons are viewable by authenticated users" ON public.order_item_addons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Order item addons are manageable by authenticated users" ON public.order_item_addons;
CREATE POLICY "Order item addons are manageable by authenticated users" ON public.order_item_addons FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_addons TO authenticated;

-- =============================================================================
-- 8. CREATE ORDER_TOTALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value_net NUMERIC(10,2) NOT NULL,
  value_gross NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT order_totals_type_check CHECK (type IN ('SUB_TOTAL', 'TAX', 'SUB_TOTAL_WITH_TAX', 'SHIPPING', 'PAYMENT', 'COUPON', 'DISCOUNT', 'TOTAL'))
);

CREATE INDEX IF NOT EXISTS idx_order_totals_order_id ON public.order_totals(order_id);
CREATE INDEX IF NOT EXISTS idx_order_totals_type ON public.order_totals(type);
ALTER TABLE public.order_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order totals are viewable by authenticated users" ON public.order_totals;
CREATE POLICY "Order totals are viewable by authenticated users" ON public.order_totals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Order totals are manageable by authenticated users" ON public.order_totals;
CREATE POLICY "Order totals are manageable by authenticated users" ON public.order_totals FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_totals TO authenticated;

-- =============================================================================
-- 9. CREATE ORDER_STATUS_HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  platform_status_id TEXT,
  platform_status_text TEXT,
  comment TEXT,
  changed_by UUID REFERENCES public.users(id),
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'webhook',
  CONSTRAINT order_status_history_source_check CHECK (source IN ('webhook', 'manual', 'api'))
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON public.order_status_history(changed_at);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order status history is viewable by authenticated users" ON public.order_status_history;
CREATE POLICY "Order status history is viewable by authenticated users" ON public.order_status_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Order status history is manageable by authenticated users" ON public.order_status_history;
CREATE POLICY "Order status history is manageable by authenticated users" ON public.order_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_status_history TO authenticated;

-- =============================================================================
-- 10. CREATE ORDER_PAYMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_method_name TEXT,
  payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
  transaction_id TEXT,
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP,
  CONSTRAINT order_payments_amount_check CHECK (amount != 0)
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_payment_date ON public.order_payments(payment_date);
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order payments are viewable by authenticated users" ON public.order_payments;
CREATE POLICY "Order payments are viewable by authenticated users" ON public.order_payments FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "Order payments are manageable by authenticated users" ON public.order_payments;
CREATE POLICY "Order payments are manageable by authenticated users" ON public.order_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments TO authenticated;

-- =============================================================================
-- 11. CREATE ORDER_PLATFORM_MAPPINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL,
  platform_order_id TEXT NOT NULL,
  platform_order_resource_id TEXT,
  last_synced_from_platform_at TIMESTAMP,
  last_synced_to_platform_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT order_platform_mappings_unique UNIQUE(connection_id, platform_order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_platform_mappings_order_id ON public.order_platform_mappings(order_id);
CREATE INDEX IF NOT EXISTS idx_order_platform_mappings_connection_id ON public.order_platform_mappings(connection_id);
ALTER TABLE public.order_platform_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order platform mappings are viewable by authenticated users" ON public.order_platform_mappings;
CREATE POLICY "Order platform mappings are viewable by authenticated users" ON public.order_platform_mappings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Order platform mappings are manageable by authenticated users" ON public.order_platform_mappings;
CREATE POLICY "Order platform mappings are manageable by authenticated users" ON public.order_platform_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_platform_mappings TO authenticated;

-- =============================================================================
-- 12. CREATE FUNCTIONS
-- =============================================================================

-- Generate order number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today_date TEXT;
  sequence_num INTEGER;
  order_num TEXT;
BEGIN
  today_date := TO_CHAR(NOW(), 'YYYY-MM-DD');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM LENGTH('ORD-' || today_date || '-') + 1) AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM public.orders
  WHERE order_number LIKE 'ORD-' || today_date || '-%'
    AND deleted_at IS NULL;
  order_num := 'ORD-' || today_date || '-' || LPAD(sequence_num::TEXT, 3, '0');
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Update order payment status function
CREATE OR REPLACE FUNCTION public.update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  order_total NUMERIC(10,2);
  total_paid NUMERIC(10,2);
  new_payment_status TEXT;
BEGIN
  SELECT total_gross INTO order_total
  FROM public.orders
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    AND deleted_at IS NULL;
  IF total_paid = 0 THEN
    new_payment_status := 'pending';
  ELSIF total_paid < order_total THEN
    new_payment_status := 'partial';
  ELSIF total_paid >= order_total THEN
    new_payment_status := 'paid';
  ELSE
    new_payment_status := 'pending';
  END IF;
  UPDATE public.orders
  SET payment_status = new_payment_status
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating payment status
DROP TRIGGER IF EXISTS trigger_update_order_payment_status ON public.order_payments;
CREATE TRIGGER trigger_update_order_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.order_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_payment_status();

-- Record order status change function
CREATE OR REPLACE FUNCTION public.record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (
      order_id, status, platform_status_id, platform_status_text,
      changed_by, changed_at, source
    )
    VALUES (
      NEW.id, NEW.status, NEW.platform_status_id, NEW.platform_status_text,
      auth.uid(), NOW(), 'manual'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-recording status changes
DROP TRIGGER IF EXISTS trigger_record_order_status_change ON public.orders;
CREATE TRIGGER trigger_record_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.record_order_status_change();

-- =============================================================================
-- Migration: 20250130_add_order_management_pages_to_permissions.sql
-- =============================================================================

-- Add pages for order management to permissions system
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES 
  ('/orders/buffer', 'Rendelés puffer', 'Webes rendelések áttekintése és feldolgozása', 'Rendelések', true),
  ('/orders', 'Rendelések', 'Rendelések listázása', 'Rendelések', true),
  ('/orders/new', 'Új rendelés', 'Kézi rendelés létrehozása', 'Rendelések', true),
  ('/orders/[id]', 'Rendelés részletei', 'Rendelés megtekintése és szerkesztése', 'Rendelések', true),
  ('/shipping-methods', 'Szállítási módok', 'Szállítási módok kezelése', 'Törzsadatok', true),
  ('/shipping-methods/new', 'Új szállítási mód', 'Új szállítási mód létrehozása', 'Törzsadatok', true),
  ('/shipping-methods/[id]', 'Szállítási mód szerkesztése', 'Szállítási mód szerkesztése', 'Törzsadatok', true)
ON CONFLICT (path) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Grant default access to all authenticated users
INSERT INTO public.user_permissions (user_id, page_id, can_access)
SELECT 
  u.id,
  p.id,
  true
FROM auth.users u
CROSS JOIN public.pages p
WHERE p.path IN (
  '/orders/buffer',
  '/orders',
  '/orders/new',
  '/orders/[id]',
  '/shipping-methods',
  '/shipping-methods/new',
  '/shipping-methods/[id]'
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.user_permissions up 
  WHERE up.user_id = u.id AND up.page_id = p.id
)
ON CONFLICT (user_id, page_id) DO NOTHING;
