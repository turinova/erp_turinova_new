-- Add internal_barcode column to shoprenter_products table
-- This is the ERP-generated barcode, separate from supplier/manufacturer barcode (gtin)

ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS internal_barcode VARCHAR(255);

-- Index for barcode scanning (internal barcode)
CREATE INDEX IF NOT EXISTS idx_products_internal_barcode 
ON public.shoprenter_products(internal_barcode) 
WHERE deleted_at IS NULL AND internal_barcode IS NOT NULL;

-- Index for supplier barcode scanning (gtin)
CREATE INDEX IF NOT EXISTS idx_products_gtin_scan 
ON public.shoprenter_products(gtin) 
WHERE deleted_at IS NULL AND gtin IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.shoprenter_products.internal_barcode IS 'Internal ERP-generated barcode (separate from supplier/manufacturer barcode)';
COMMENT ON COLUMN public.shoprenter_products.gtin IS 'Supplier/Manufacturer barcode (from ShopRenter or supplier)';
