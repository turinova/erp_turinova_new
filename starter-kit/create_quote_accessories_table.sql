-- Create quote_accessories table for linking quotes to accessories
CREATE TABLE IF NOT EXISTS public.quote_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES public.accessories(id) ON DELETE RESTRICT,
  
  -- Quantity can be greater than 1
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  
  -- Snapshot of accessory details at time of adding (for historical accuracy)
  accessory_name VARCHAR(255) NOT NULL,
  sku VARCHAR(255) NOT NULL,
  unit_price_net DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,4) NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id),
  unit_name VARCHAR(100) NOT NULL,
  currency_id UUID NOT NULL REFERENCES public.currencies(id),
  
  -- Calculated totals (unit_price × quantity)
  total_net DECIMAL(12,2) NOT NULL,
  total_vat DECIMAL(12,2) NOT NULL,
  total_gross DECIMAL(12,2) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Create indexes
CREATE INDEX idx_quote_accessories_quote_id ON public.quote_accessories(quote_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quote_accessories_deleted_at ON public.quote_accessories(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_quote_accessories_accessory_id ON public.quote_accessories(accessory_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_quote_accessories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quote_accessories_updated_at
  BEFORE UPDATE ON public.quote_accessories
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_accessories_updated_at();

-- Add RLS policies (assuming similar structure to other tables)
ALTER TABLE public.quote_accessories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.quote_accessories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.quote_accessories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.quote_accessories
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.quote_accessories
  FOR DELETE USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.quote_accessories IS 'Junction table linking quotes to accessories with quantity and snapshot pricing';
COMMENT ON COLUMN public.quote_accessories.quantity IS 'Number of units of this accessory';
COMMENT ON COLUMN public.quote_accessories.unit_price_net IS 'Snapshot of net price per unit at time of adding';
COMMENT ON COLUMN public.quote_accessories.total_net IS 'Calculated: unit_price_net × quantity';

