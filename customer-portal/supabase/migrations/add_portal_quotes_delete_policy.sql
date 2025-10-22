-- =====================================================
-- ADD MISSING DELETE POLICY FOR PORTAL QUOTES
-- =====================================================
-- This adds the DELETE policy that was missing from the
-- original RLS policy migration.
-- 
-- Run this if you already ran create_portal_quotes_rls_policies.sql
-- and deletion is not working.
-- =====================================================

-- Allow portal customers to delete their own quotes
CREATE POLICY "Portal customers can delete their own quotes"
  ON portal_quotes
  FOR DELETE
  TO authenticated
  USING (portal_customer_id = auth.uid());

-- Verify the policy was created
-- SELECT schemaname, tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'portal_quotes' AND cmd = 'DELETE';

