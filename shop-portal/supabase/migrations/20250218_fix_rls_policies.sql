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
