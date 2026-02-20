-- Add pricing fields and GTIN for products
-- Run this SQL manually in your Supabase SQL Editor

-- Add price column (net price - Nettó ár)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS price DECIMAL(15,4);

-- Add cost column (purchase/cost price - Beszerzési ár)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS cost DECIMAL(15,4);

-- Add multiplier column (price multiplier - Árazási szorzó)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS multiplier DECIMAL(10,4) DEFAULT 1.0000;

-- Add multiplier_lock column (price multiplier lock - Szorzó zárolás)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS multiplier_lock BOOLEAN DEFAULT false;

-- Add gtin column (barcode - Vonalkód)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS gtin TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.shoprenter_products.price IS 'Net price (Nettó ár) from ShopRenter price field';
COMMENT ON COLUMN public.shoprenter_products.cost IS 'Purchase/cost price (Beszerzési ár) from ShopRenter cost field - admin only';
COMMENT ON COLUMN public.shoprenter_products.multiplier IS 'Price multiplier (Árazási szorzó) from ShopRenter multiplier field';
COMMENT ON COLUMN public.shoprenter_products.multiplier_lock IS 'Price multiplier lock (Szorzó zárolás) from ShopRenter multiplierLock field';
COMMENT ON COLUMN public.shoprenter_products.gtin IS 'GTIN/Barcode (Vonalkód) from ShopRenter gtin field';

-- Create indexes for potential queries
CREATE INDEX IF NOT EXISTS idx_products_price ON public.shoprenter_products(price);
CREATE INDEX IF NOT EXISTS idx_products_cost ON public.shoprenter_products(cost);
CREATE INDEX IF NOT EXISTS idx_products_gtin ON public.shoprenter_products(gtin);
