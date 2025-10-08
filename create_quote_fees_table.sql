-- Create quote_fees table for linking quotes to fees
CREATE TABLE IF NOT EXISTS public.quote_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  feetype_id UUID NOT NULL REFERENCES public.feetypes(id) ON DELETE RESTRICT,
  
  -- Snapshot of fee details at time of adding (for historical accuracy)
  fee_name VARCHAR(255) NOT NULL,
  unit_price_net DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,4) NOT NULL,
  vat_amount DECIMAL(12,2) NOT NULL,
  gross_price DECIMAL(12,2) NOT NULL,
  currency_id UUID NOT NULL REFERENCES public.currencies(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Create indexes
CREATE INDEX idx_quote_fees_quote_id ON public.quote_fees(quote_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quote_fees_deleted_at ON public.quote_fees(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_quote_fees_feetype_id ON public.quote_fees(feetype_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_quote_fees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quote_fees_updated_at
  BEFORE UPDATE ON public.quote_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_fees_updated_at();

-- Add RLS policies (assuming similar structure to other tables)
ALTER TABLE public.quote_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.quote_fees
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.quote_fees
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.quote_fees
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.quote_fees
  FOR DELETE USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.quote_fees IS 'Junction table linking quotes to fees with snapshot pricing';
COMMENT ON COLUMN public.quote_fees.unit_price_net IS 'Snapshot of net price at time of adding';
COMMENT ON COLUMN public.quote_fees.vat_rate IS 'Snapshot of VAT rate at time of adding';

