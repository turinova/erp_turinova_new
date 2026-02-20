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
