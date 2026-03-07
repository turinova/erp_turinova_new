-- Create product_specials table for promotions and volume pricing
-- Run this SQL manually in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.product_specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Product reference
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  
  -- ShopRenter sync
  shoprenter_special_id TEXT, -- ShopRenter resource ID (nullable until synced)
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- Customer group (nullable = "Everyone")
  customer_group_id UUID REFERENCES public.customer_groups(id) ON DELETE SET NULL,
  
  -- Promotion details
  priority INTEGER NOT NULL DEFAULT 1, -- Higher priority wins conflicts
  price DECIMAL(15,4) NOT NULL, -- Special price (net)
  
  -- Date range
  date_from DATE, -- NULL = no start date
  date_to DATE, -- NULL = no end date
  
  -- Volume pricing
  min_quantity INTEGER DEFAULT 0, -- 0 = no minimum
  max_quantity INTEGER DEFAULT 0, -- 0 = unlimited
  
  -- Product of the day
  type TEXT DEFAULT 'interval', -- 'interval' or 'day_spec'
  day_of_week INTEGER, -- 1-7 (Monday-Sunday), only for type='day_spec'
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_expired BOOLEAN DEFAULT false, -- Auto-set when date_to < today
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 1 AND day_of_week <= 7)),
  CONSTRAINT valid_priority CHECK (priority >= -1),
  CONSTRAINT valid_quantity_range CHECK (max_quantity = 0 OR max_quantity >= min_quantity),
  CONSTRAINT valid_date_range CHECK (date_to IS NULL OR date_from IS NULL OR date_to >= date_from)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_specials_product_id ON public.product_specials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_specials_connection_id ON public.product_specials(connection_id);
CREATE INDEX IF NOT EXISTS idx_product_specials_customer_group_id ON public.product_specials(customer_group_id);
CREATE INDEX IF NOT EXISTS idx_product_specials_active ON public.product_specials(is_active, is_expired) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_specials_dates ON public.product_specials(date_from, date_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_specials_shoprenter_id ON public.product_specials(shoprenter_special_id) WHERE shoprenter_special_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.product_specials IS 'Product promotions, volume pricing, and special offers';
COMMENT ON COLUMN public.product_specials.priority IS 'Higher priority wins conflicts. Product of day uses -1.';
COMMENT ON COLUMN public.product_specials.price IS 'Special price (net). ShopRenter calculates gross.';
COMMENT ON COLUMN public.product_specials.customer_group_id IS 'NULL = "Everyone" (all customer groups)';
COMMENT ON COLUMN public.product_specials.type IS 'interval = regular promotion, day_spec = product of the day';
COMMENT ON COLUMN public.product_specials.day_of_week IS '1=Monday, 2=Tuesday, ..., 7=Sunday. Only for type=day_spec';

-- RLS Policies
ALTER TABLE public.product_specials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_specials table
DROP POLICY IF EXISTS "Product specials are viewable by authenticated users" ON public.product_specials;
CREATE POLICY "Product specials are viewable by authenticated users" 
ON public.product_specials
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Product specials are manageable by authenticated users" ON public.product_specials;
CREATE POLICY "Product specials are manageable by authenticated users" 
ON public.product_specials
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_specials TO authenticated;

-- Create trigger for product_specials table to automatically update updated_at
DROP TRIGGER IF EXISTS update_product_specials_updated_at ON public.product_specials;
CREATE TRIGGER update_product_specials_updated_at
    BEFORE UPDATE ON public.product_specials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-set is_expired
CREATE OR REPLACE FUNCTION check_product_special_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_to IS NOT NULL AND NEW.date_to < CURRENT_DATE THEN
    NEW.is_expired = true;
  ELSE
    NEW.is_expired = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_specials_check_expiration
  BEFORE INSERT OR UPDATE ON public.product_specials
  FOR EACH ROW
  EXECUTE FUNCTION check_product_special_expiration();

-- Function to get next priority for a product
CREATE OR REPLACE FUNCTION get_next_priority_for_product(p_product_id UUID)
RETURNS INTEGER AS $$
DECLARE
  max_priority INTEGER;
BEGIN
  SELECT COALESCE(MAX(priority), 0) INTO max_priority
  FROM public.product_specials
  WHERE product_id = p_product_id
    AND deleted_at IS NULL
    AND priority > 0; -- Don't count -1 (product of day)
  
  RETURN max_priority + 1;
END;
$$ LANGUAGE plpgsql;
