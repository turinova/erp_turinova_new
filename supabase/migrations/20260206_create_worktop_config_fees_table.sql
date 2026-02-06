-- Create worktop_config_fees table for storing worktop configuration pricing
CREATE TABLE IF NOT EXISTS public.worktop_config_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kereszt_vagas_fee numeric(10, 2) NOT NULL DEFAULT 2100,
  hosszanti_vagas_fee_per_meter numeric(10, 2) NOT NULL DEFAULT 1500,
  ives_vagas_fee numeric(10, 2) NOT NULL DEFAULT 13000,
  szogvagas_fee numeric(10, 2) NOT NULL DEFAULT 3000,
  kivagas_fee numeric(10, 2) NOT NULL DEFAULT 10000,
  elzaro_fee_per_meter numeric(10, 2) NOT NULL DEFAULT 1800,
  osszemaras_fee numeric(10, 2) NOT NULL DEFAULT 26000,
  currency_id uuid NOT NULL,
  vat_id uuid NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT worktop_config_fees_pkey PRIMARY KEY (id),
  CONSTRAINT worktop_config_fees_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES currencies (id),
  CONSTRAINT worktop_config_fees_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES vat (id)
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_worktop_config_fees_currency_id ON public.worktop_config_fees USING btree (currency_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_worktop_config_fees_vat_id ON public.worktop_config_fees USING btree (vat_id) TABLESPACE pg_default;

-- Create trigger for updated_at
CREATE TRIGGER update_worktop_config_fees_updated_at
  BEFORE UPDATE ON public.worktop_config_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
