-- Add url_alias_id column to store ShopRenter's URL alias ID
-- This allows us to update the URL alias via API

ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS url_alias_id TEXT;

CREATE INDEX IF NOT EXISTS idx_products_url_alias_id ON public.shoprenter_products(url_alias_id) WHERE url_alias_id IS NOT NULL;

COMMENT ON COLUMN public.shoprenter_products.url_alias_id IS 
'ShopRenter URL alias resource ID (base64 encoded). Used to update the product URL slug via PUT /urlAliases/{id} API endpoint.';
