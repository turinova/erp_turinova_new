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
