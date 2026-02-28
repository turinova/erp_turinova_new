-- Add UPDATE policy for subscription_plans (development/testing only)
-- This allows test-override to work in development mode

-- Drop policy if it exists (to allow re-running this migration)
DROP POLICY IF EXISTS "Allow update for testing (development)" ON subscription_plans;

-- Allow authenticated users to update subscription_plans in development
-- In production, this should be restricted to admin users only
CREATE POLICY "Allow update for testing (development)"
  ON subscription_plans FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Note: In production, you should restrict this to admin users only:
-- USING (auth.jwt() ->> 'role' = 'admin')
-- WITH CHECK (auth.jwt() ->> 'role' = 'admin')
