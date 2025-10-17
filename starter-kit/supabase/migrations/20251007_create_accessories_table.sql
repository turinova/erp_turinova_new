-- Create accessories table
CREATE TABLE IF NOT EXISTS public.accessories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(255) NOT NULL,
  sku character varying(100) NOT NULL,
  net_price integer NOT NULL,
  vat_id uuid NOT NULL,
  currency_id uuid NOT NULL,
  units_id uuid NOT NULL,
  partners_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT accessories_pkey PRIMARY KEY (id),
  CONSTRAINT accessories_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT,
  CONSTRAINT accessories_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT,
  CONSTRAINT accessories_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id) ON DELETE RESTRICT,
  CONSTRAINT accessories_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id) ON DELETE RESTRICT
) TABLESPACE pg_default;

-- Create unique index for active SKUs
CREATE UNIQUE INDEX IF NOT EXISTS accessories_sku_unique_active 
ON public.accessories USING btree (sku) 
WHERE (deleted_at IS NULL);

-- Create index for deleted_at for soft delete queries
CREATE INDEX IF NOT EXISTS idx_accessories_deleted_at 
ON public.accessories USING btree (deleted_at) 
WHERE (deleted_at IS NULL);

-- Create index for name for search queries
CREATE INDEX IF NOT EXISTS idx_accessories_name_active 
ON public.accessories USING btree (name) 
WHERE (deleted_at IS NULL);

-- Create index for sku for search queries
CREATE INDEX IF NOT EXISTS idx_accessories_sku_active 
ON public.accessories USING btree (sku) 
WHERE (deleted_at IS NULL);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_accessories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accessories_updated_at
  BEFORE UPDATE ON accessories
  FOR EACH ROW
  EXECUTE FUNCTION update_accessories_updated_at();

-- Insert sample data
INSERT INTO public.accessories (name, sku, net_price, vat_id, currency_id, units_id, partners_id) VALUES
('Csavarok M6x20', 'CSV-M6-20', 50, (SELECT id FROM vat LIMIT 1), (SELECT id FROM currencies LIMIT 1), (SELECT id FROM units LIMIT 1), (SELECT id FROM partners LIMIT 1)),
('Fa ragasztó 500ml', 'RAG-500', 1200, (SELECT id FROM vat LIMIT 1), (SELECT id FROM currencies LIMIT 1), (SELECT id FROM units LIMIT 1), (SELECT id FROM partners LIMIT 1)),
('Csiszolópapír 120-as', 'CSP-120', 300, (SELECT id FROM vat LIMIT 1), (SELECT id FROM currencies LIMIT 1), (SELECT id FROM units LIMIT 1), (SELECT id FROM partners LIMIT 1))
ON CONFLICT (sku) WHERE deleted_at IS NULL DO NOTHING;
