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
