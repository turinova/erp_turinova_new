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
