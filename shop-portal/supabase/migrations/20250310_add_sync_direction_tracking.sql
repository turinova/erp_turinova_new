-- Add separate sync direction tracking fields
-- This allows us to track when we last synced FROM ShopRenter vs TO ShopRenter
-- This prevents overwriting ERP changes that were just synced to ShopRenter

-- Add new sync direction fields
ALTER TABLE public.shoprenter_products
ADD COLUMN IF NOT EXISTS last_synced_from_shoprenter_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_synced_to_shoprenter_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_last_synced_from 
  ON public.shoprenter_products(last_synced_from_shoprenter_at) 
  WHERE last_synced_from_shoprenter_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_last_synced_to 
  ON public.shoprenter_products(last_synced_to_shoprenter_at) 
  WHERE last_synced_to_shoprenter_at IS NOT NULL;

-- Migrate existing data (for backward compatibility)
-- Set last_synced_from_shoprenter_at = last_synced_at for existing records
-- This assumes existing last_synced_at values are from FROM syncs
UPDATE public.shoprenter_products
SET last_synced_from_shoprenter_at = last_synced_at
WHERE last_synced_at IS NOT NULL 
  AND last_synced_from_shoprenter_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.shoprenter_products.last_synced_from_shoprenter_at IS 
'Timestamp when product was last synced FROM ShopRenter (pulled into ERP). Used for incremental sync logic to determine if ShopRenter has new changes.';

COMMENT ON COLUMN public.shoprenter_products.last_synced_to_shoprenter_at IS 
'Timestamp when product was last synced TO ShopRenter (pushed from ERP). Used to prevent overwriting ERP changes that were just synced to ShopRenter.';
