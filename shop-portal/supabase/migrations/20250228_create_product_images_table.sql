-- Product Images Table Migration
-- Stores product image metadata and alt text for SEO optimization

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- ShopRenter Image Data
  shoprenter_image_id TEXT, -- ShopRenter productImage ID (for syncing alt text)
  image_path TEXT NOT NULL, -- e.g., "product/image.jpg"
  image_url TEXT, -- Full URL from allImages (for display)
  sort_order INTEGER DEFAULT 0,
  is_main_image BOOLEAN DEFAULT false,
  
  -- Alt Text
  alt_text TEXT, -- Generated/manual alt text
  alt_text_status TEXT DEFAULT 'pending' CHECK (alt_text_status IN ('pending', 'generated', 'manual', 'synced', 'error')),
  alt_text_generated_at TIMESTAMP WITH TIME ZONE,
  alt_text_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(product_id, image_path)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_images_product_id 
ON public.product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_connection_id 
ON public.product_images(connection_id);

CREATE INDEX IF NOT EXISTS idx_product_images_alt_text_status 
ON public.product_images(alt_text_status) 
WHERE alt_text_status IN ('pending', 'generated');

CREATE INDEX IF NOT EXISTS idx_product_images_shoprenter_id 
ON public.product_images(shoprenter_image_id) 
WHERE shoprenter_image_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view images for products they have access to
DROP POLICY IF EXISTS "Users can view images for their products" ON public.product_images;
CREATE POLICY "Users can view images for their products" ON public.product_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can insert images for products they have access to
DROP POLICY IF EXISTS "Users can insert images for their products" ON public.product_images;
CREATE POLICY "Users can insert images for their products" ON public.product_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can update images for products they have access to
DROP POLICY IF EXISTS "Users can update images for their products" ON public.product_images;
CREATE POLICY "Users can update images for their products" ON public.product_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Policy: Users can delete images for products they have access to
DROP POLICY IF EXISTS "Users can delete images for their products" ON public.product_images;
CREATE POLICY "Users can delete images for their products" ON public.product_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shoprenter_products sp
      JOIN public.webshop_connections c ON c.id = sp.connection_id
      WHERE sp.id = product_images.product_id
      AND EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.pages p ON up.page_id = p.id
        WHERE up.user_id = auth.uid()
        AND p.path = '/products'
        AND up.can_access = true
      )
    )
  );

-- Comments
COMMENT ON TABLE public.product_images IS 'Stores product image metadata and alt text for SEO optimization';
COMMENT ON COLUMN public.product_images.alt_text IS 'SEO-friendly alt text for the image (generated by AI or manually entered)';
COMMENT ON COLUMN public.product_images.alt_text_status IS 'Status: pending (needs generation), generated (AI-generated), manual (user-entered), synced (synced to ShopRenter), error (sync failed)';
COMMENT ON COLUMN public.product_images.shoprenter_image_id IS 'ShopRenter productImage resource ID for syncing alt text back to ShopRenter';
