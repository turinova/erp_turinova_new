-- Fix RLS Policy for admin_users table
-- Run this in your ADMIN DATABASE SQL Editor
-- 
-- Problem: The current RLS policy only allows service_role to access admin_users,
-- but the login page uses the browser client (anon key) which needs to check if a user is an admin.
--
-- Solution: Add a policy that allows authenticated users to read their own admin_users record.

-- Add policy for authenticated users to read their own admin_users record
DROP POLICY IF EXISTS "Authenticated users can read own admin record" ON public.admin_users;
CREATE POLICY "Authenticated users can read own admin record"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.email() = email);

-- Keep the service role policy for full access
DROP POLICY IF EXISTS "Service role can manage admin users" ON public.admin_users;
CREATE POLICY "Service role can manage admin users"
  ON public.admin_users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Verify the policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'admin_users'
ORDER BY policyname;
