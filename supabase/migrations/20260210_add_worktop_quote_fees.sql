-- Add fees support to worktop quotes
-- Create worktop_quote_fees table (similar to quote_fees)
CREATE TABLE IF NOT EXISTS public.worktop_quote_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worktop_quote_id uuid NOT NULL,
  feetype_id uuid NOT NULL,
  fee_name character varying(255) NOT NULL,
  unit_price_net numeric(12, 2) NOT NULL,
  vat_rate numeric(5, 4) NOT NULL,
  vat_amount numeric(12, 2) NOT NULL,
  gross_price numeric(12, 2) NOT NULL,
  currency_id uuid NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  quantity integer NOT NULL DEFAULT 1,
  comment text NULL,
  CONSTRAINT worktop_quote_fees_pkey PRIMARY KEY (id),
  CONSTRAINT worktop_quote_fees_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES currencies (id),
  CONSTRAINT worktop_quote_fees_feetype_id_fkey FOREIGN KEY (feetype_id) REFERENCES feetypes (id) ON DELETE RESTRICT,
  CONSTRAINT worktop_quote_fees_worktop_quote_id_fkey FOREIGN KEY (worktop_quote_id) REFERENCES worktop_quotes (id) ON DELETE CASCADE,
  CONSTRAINT worktop_quote_fees_quantity_check CHECK ((quantity > 0))
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_worktop_quote_fees_worktop_quote_id ON public.worktop_quote_fees USING btree (worktop_quote_id) TABLESPACE pg_default
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_worktop_quote_fees_deleted_at ON public.worktop_quote_fees USING btree (deleted_at) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_worktop_quote_fees_feetype_id ON public.worktop_quote_fees USING btree (feetype_id) TABLESPACE pg_default;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_worktop_quote_fees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_worktop_quote_fees_updated_at
  BEFORE UPDATE ON public.worktop_quote_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_worktop_quote_fees_updated_at();

-- Add fee columns to worktop_quotes table
ALTER TABLE public.worktop_quotes
  ADD COLUMN IF NOT EXISTS fees_total_net numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fees_total_vat numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fees_total_gross numeric(12, 2) NOT NULL DEFAULT 0;

-- Update existing worktop_quotes to have 0 fees (if any exist)
UPDATE public.worktop_quotes
SET 
  fees_total_net = 0,
  fees_total_vat = 0,
  fees_total_gross = 0
WHERE fees_total_net IS NULL OR fees_total_vat IS NULL OR fees_total_gross IS NULL;
