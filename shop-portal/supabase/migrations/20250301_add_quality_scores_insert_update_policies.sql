-- Add INSERT and UPDATE policies for product_quality_scores
-- The original migration only had SELECT policy, which prevented inserts

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
