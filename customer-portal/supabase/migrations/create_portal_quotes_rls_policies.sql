-- =====================================================
-- PORTAL QUOTES RLS POLICIES
-- =====================================================
-- This script creates Row Level Security policies for
-- portal_quotes and related tables.
-- 
-- Portal customers can:
-- - Create their own quotes
-- - Read their own quotes
-- - Update their own quotes (for future editing)
-- =====================================================

-- Enable RLS on all portal quote tables (if not already enabled)
ALTER TABLE portal_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_quote_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_quote_materials_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_quote_edge_materials_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_quote_services_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_quote_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_quote_accessories ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PORTAL QUOTES POLICIES
-- =====================================================

-- Allow portal customers to insert their own quotes
CREATE POLICY "Portal customers can insert their own quotes"
  ON portal_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (portal_customer_id = auth.uid());

-- Allow portal customers to read their own quotes
CREATE POLICY "Portal customers can read their own quotes"
  ON portal_quotes
  FOR SELECT
  TO authenticated
  USING (portal_customer_id = auth.uid());

-- Allow portal customers to update their own quotes
CREATE POLICY "Portal customers can update their own quotes"
  ON portal_quotes
  FOR UPDATE
  TO authenticated
  USING (portal_customer_id = auth.uid())
  WITH CHECK (portal_customer_id = auth.uid());

-- Allow portal customers to delete their own quotes
CREATE POLICY "Portal customers can delete their own quotes"
  ON portal_quotes
  FOR DELETE
  TO authenticated
  USING (portal_customer_id = auth.uid());

-- =====================================================
-- PORTAL QUOTE PANELS POLICIES
-- =====================================================

-- Allow portal customers to insert panels for their quotes
CREATE POLICY "Portal customers can insert panels for their quotes"
  ON portal_quote_panels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- Allow portal customers to read panels for their quotes
CREATE POLICY "Portal customers can read panels for their quotes"
  ON portal_quote_panels
  FOR SELECT
  TO authenticated
  USING (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- Allow portal customers to update panels for their quotes
CREATE POLICY "Portal customers can update panels for their quotes"
  ON portal_quote_panels
  FOR UPDATE
  TO authenticated
  USING (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- Allow portal customers to delete panels for their quotes
CREATE POLICY "Portal customers can delete panels for their quotes"
  ON portal_quote_panels
  FOR DELETE
  TO authenticated
  USING (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- =====================================================
-- PORTAL QUOTE MATERIALS PRICING POLICIES
-- =====================================================

-- Allow portal customers to insert materials pricing for their quotes
CREATE POLICY "Portal customers can insert materials pricing for their quotes"
  ON portal_quote_materials_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- Allow portal customers to read materials pricing for their quotes
CREATE POLICY "Portal customers can read materials pricing for their quotes"
  ON portal_quote_materials_pricing
  FOR SELECT
  TO authenticated
  USING (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- Allow portal customers to delete materials pricing for their quotes
CREATE POLICY "Portal customers can delete materials pricing for their quotes"
  ON portal_quote_materials_pricing
  FOR DELETE
  TO authenticated
  USING (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- =====================================================
-- PORTAL QUOTE EDGE MATERIALS BREAKDOWN POLICIES
-- =====================================================

-- Allow portal customers to insert edge materials breakdown for their quotes
CREATE POLICY "Portal customers can insert edge materials for their quotes"
  ON portal_quote_edge_materials_breakdown
  FOR INSERT
  TO authenticated
  WITH CHECK (
    portal_quote_materials_pricing_id IN (
      SELECT pqmp.id FROM portal_quote_materials_pricing pqmp
      JOIN portal_quotes pq ON pqmp.portal_quote_id = pq.id
      WHERE pq.portal_customer_id = auth.uid()
    )
  );

-- Allow portal customers to read edge materials breakdown for their quotes
CREATE POLICY "Portal customers can read edge materials for their quotes"
  ON portal_quote_edge_materials_breakdown
  FOR SELECT
  TO authenticated
  USING (
    portal_quote_materials_pricing_id IN (
      SELECT pqmp.id FROM portal_quote_materials_pricing pqmp
      JOIN portal_quotes pq ON pqmp.portal_quote_id = pq.id
      WHERE pq.portal_customer_id = auth.uid()
    )
  );

-- =====================================================
-- PORTAL QUOTE SERVICES BREAKDOWN POLICIES
-- =====================================================

-- Allow portal customers to insert services breakdown for their quotes
CREATE POLICY "Portal customers can insert services for their quotes"
  ON portal_quote_services_breakdown
  FOR INSERT
  TO authenticated
  WITH CHECK (
    portal_quote_materials_pricing_id IN (
      SELECT pqmp.id FROM portal_quote_materials_pricing pqmp
      JOIN portal_quotes pq ON pqmp.portal_quote_id = pq.id
      WHERE pq.portal_customer_id = auth.uid()
    )
  );

-- Allow portal customers to read services breakdown for their quotes
CREATE POLICY "Portal customers can read services for their quotes"
  ON portal_quote_services_breakdown
  FOR SELECT
  TO authenticated
  USING (
    portal_quote_materials_pricing_id IN (
      SELECT pqmp.id FROM portal_quote_materials_pricing pqmp
      JOIN portal_quotes pq ON pqmp.portal_quote_id = pq.id
      WHERE pq.portal_customer_id = auth.uid()
    )
  );

-- =====================================================
-- PORTAL QUOTE FEES POLICIES (for future use)
-- =====================================================

-- Allow portal customers to insert fees for their quotes
CREATE POLICY "Portal customers can insert fees for their quotes"
  ON portal_quote_fees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- Allow portal customers to read fees for their quotes
CREATE POLICY "Portal customers can read fees for their quotes"
  ON portal_quote_fees
  FOR SELECT
  TO authenticated
  USING (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- =====================================================
-- PORTAL QUOTE ACCESSORIES POLICIES (for future use)
-- =====================================================

-- Allow portal customers to insert accessories for their quotes
CREATE POLICY "Portal customers can insert accessories for their quotes"
  ON portal_quote_accessories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- Allow portal customers to read accessories for their quotes
CREATE POLICY "Portal customers can read accessories for their quotes"
  ON portal_quote_accessories
  FOR SELECT
  TO authenticated
  USING (
    portal_quote_id IN (
      SELECT id FROM portal_quotes WHERE portal_customer_id = auth.uid()
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

-- List all policies on portal_quotes tables
-- Uncomment to verify after running migration:

-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename LIKE 'portal_quote%'
-- ORDER BY tablename, policyname;

