-- Create feetypes table
CREATE TABLE IF NOT EXISTS public.feetypes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(255) NOT NULL,
  net_price numeric(12, 2) NOT NULL,
  vat_id uuid NOT NULL,
  currency_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT feetypes_pkey PRIMARY KEY (id),
  CONSTRAINT feetypes_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES vat (id) ON DELETE RESTRICT,
  CONSTRAINT feetypes_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES currencies (id) ON DELETE RESTRICT
) TABLESPACE pg_default;

-- Create unique index for active fee type names
CREATE UNIQUE INDEX IF NOT EXISTS feetypes_name_unique_active 
ON public.feetypes USING btree (name) 
WHERE (deleted_at IS NULL);

-- Create index for deleted_at for soft delete queries
CREATE INDEX IF NOT EXISTS idx_feetypes_deleted_at 
ON public.feetypes USING btree (deleted_at) 
WHERE (deleted_at IS NULL);

-- Create index for name for search queries
CREATE INDEX IF NOT EXISTS idx_feetypes_name_active 
ON public.feetypes USING btree (name) 
WHERE (deleted_at IS NULL);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_feetypes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feetypes_updated_at
  BEFORE UPDATE ON feetypes
  FOR EACH ROW
  EXECUTE FUNCTION update_feetypes_updated_at();

-- Insert sample data (assuming we have vat and currency records)
-- First, let's get the default VAT and currency IDs
DO $$
DECLARE
    default_vat_id uuid;
    default_currency_id uuid;
BEGIN
    -- Get the first VAT record (assuming 27% VAT exists)
    SELECT id INTO default_vat_id FROM vat WHERE kulcs = 27 LIMIT 1;
    
    -- Get the first currency record (assuming HUF exists)
    SELECT id INTO default_currency_id FROM currencies WHERE name = 'HUF' LIMIT 1;
    
    -- Insert sample data if we found the required records
    IF default_vat_id IS NOT NULL AND default_currency_id IS NOT NULL THEN
        INSERT INTO public.feetypes (name, net_price, vat_id, currency_id) VALUES
        ('Szállítás', 1000.00, default_vat_id, default_currency_id),
        ('SOS', 2500.00, default_vat_id, default_currency_id)
        ON CONFLICT (name) WHERE deleted_at IS NULL DO NOTHING;
    END IF;
END $$;
