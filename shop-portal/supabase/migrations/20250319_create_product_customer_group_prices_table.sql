-- Create product_customer_group_prices table for pricing system
-- This table stores different prices for products based on customer groups
-- Maps to ShopRenter customerGroupProductPrice resource

CREATE TABLE IF NOT EXISTS public.product_customer_group_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES shoprenter_products(id) ON DELETE CASCADE,
    customer_group_id UUID NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
    
    price DECIMAL(15,4) NOT NULL, -- Price for this customer group
    
    -- ShopRenter sync
    shoprenter_customer_group_price_id TEXT,
    last_synced_at TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(product_id, customer_group_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_group_prices_product ON public.product_customer_group_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_group_prices_group ON public.product_customer_group_prices(customer_group_id);
CREATE INDEX IF NOT EXISTS idx_product_group_prices_active ON public.product_customer_group_prices(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_group_prices_synced ON public.product_customer_group_prices(last_synced_at) WHERE last_synced_at IS NOT NULL;

-- Create trigger for product_customer_group_prices table to automatically update updated_at
DROP TRIGGER IF EXISTS update_product_customer_group_prices_updated_at ON public.product_customer_group_prices;
CREATE TRIGGER update_product_customer_group_prices_updated_at
    BEFORE UPDATE ON public.product_customer_group_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for product_customer_group_prices table
ALTER TABLE public.product_customer_group_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_customer_group_prices table
DROP POLICY IF EXISTS "Product customer group prices are viewable by authenticated users" ON public.product_customer_group_prices;
CREATE POLICY "Product customer group prices are viewable by authenticated users" 
ON public.product_customer_group_prices
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Product customer group prices are manageable by authenticated users" ON public.product_customer_group_prices;
CREATE POLICY "Product customer group prices are manageable by authenticated users" 
ON public.product_customer_group_prices
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_customer_group_prices TO authenticated;

-- Add comments
COMMENT ON TABLE public.product_customer_group_prices IS 'Product prices per customer group. Maps to ShopRenter customerGroupProductPrice resource.';
COMMENT ON COLUMN public.product_customer_group_prices.price IS 'Price for this product for this specific customer group';
COMMENT ON COLUMN public.product_customer_group_prices.shoprenter_customer_group_price_id IS 'ShopRenter customerGroupProductPrice ID after sync';
COMMENT ON COLUMN public.product_customer_group_prices.last_synced_at IS 'Timestamp when this price was last synced to ShopRenter';
