-- Add parameters and productTags support for Content & SEO tab
-- Parameters: stored in shoprenter_product_descriptions (language-specific)
-- ProductTags: stored in new product_tags table (language-specific, multiple tags per product)

-- Add parameters column to shoprenter_product_descriptions
ALTER TABLE public.shoprenter_product_descriptions 
ADD COLUMN IF NOT EXISTS parameters TEXT;

-- Add comment
COMMENT ON COLUMN public.shoprenter_product_descriptions.parameters IS 'Product parameters (language-specific). Pulled from ShopRenter productDescriptions.parameters field.';

-- Create product_tags table for storing product tags (language-specific)
CREATE TABLE IF NOT EXISTS public.product_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL, -- e.g., 'hu', 'en'
    tags TEXT NOT NULL, -- Comma-separated tags: "tag1,tag2,tag3"
    shoprenter_id TEXT, -- ShopRenter productTag ID (base64 encoded)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(product_id, language_code, deleted_at) -- One tag entry per product per language (when not deleted)
);

-- Create indexes for product_tags
CREATE INDEX IF NOT EXISTS idx_product_tags_product_id 
ON public.product_tags(product_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_tags_connection_id 
ON public.product_tags(connection_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_tags_language_code 
ON public.product_tags(language_code) 
WHERE deleted_at IS NULL;

-- Create trigger for product_tags table to automatically update updated_at
DROP TRIGGER IF EXISTS update_product_tags_updated_at ON public.product_tags;
CREATE TRIGGER update_product_tags_updated_at
    BEFORE UPDATE ON public.product_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for product_tags table
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_tags table
DROP POLICY IF EXISTS "Product tags are viewable by authenticated users" ON public.product_tags;
CREATE POLICY "Product tags are viewable by authenticated users" 
ON public.product_tags
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Product tags are manageable by authenticated users" ON public.product_tags;
CREATE POLICY "Product tags are manageable by authenticated users" 
ON public.product_tags
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
