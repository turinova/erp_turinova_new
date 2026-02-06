-- Create worktop quotes system tables
-- Similar to quotes system but for worktop configurations

-- Main worktop quotes table
CREATE TABLE IF NOT EXISTS public.worktop_quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  quote_number character varying(50) NOT NULL,
  status public.quote_status NOT NULL DEFAULT 'draft'::public.quote_status,
  total_net numeric(12, 2) NOT NULL,
  total_vat numeric(12, 2) NOT NULL,
  total_gross numeric(12, 2) NOT NULL,
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0,
  final_total_after_discount numeric(12, 2) NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  order_number text NULL,
  barcode text NULL,
  production_machine_id uuid NULL,
  production_date date NULL,
  payment_status text NULL DEFAULT 'not_paid'::text,
  currency_id uuid NULL,
  vat_id uuid NULL,
  comment text NULL,
  CONSTRAINT worktop_quotes_pkey PRIMARY KEY (id),
  CONSTRAINT worktop_quotes_quote_number_key UNIQUE (quote_number),
  CONSTRAINT worktop_quotes_order_number_key UNIQUE (order_number),
  CONSTRAINT worktop_quotes_barcode_key UNIQUE (barcode),
  CONSTRAINT worktop_quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT worktop_quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE RESTRICT,
  CONSTRAINT worktop_quotes_production_machine_id_fkey FOREIGN KEY (production_machine_id) REFERENCES production_machines (id) ON DELETE RESTRICT,
  CONSTRAINT worktop_quotes_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES currencies (id),
  CONSTRAINT worktop_quotes_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES vat (id)
) TABLESPACE pg_default;

-- Worktop quote configs table (stores all saved worktop configurations)
CREATE TABLE IF NOT EXISTS public.worktop_quote_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worktop_quote_id uuid NOT NULL,
  config_order integer NOT NULL, -- Order of configs in the quote
  assembly_type character varying(50) NOT NULL,
  linear_material_id uuid NOT NULL,
  linear_material_name text NOT NULL, -- Snapshot of material name at quote time
  edge_banding character varying(20) NOT NULL,
  edge_color_choice character varying(20) NOT NULL,
  edge_color_text text,
  no_postforming_edge boolean NOT NULL DEFAULT false,
  edge_position1 boolean NOT NULL DEFAULT false,
  edge_position2 boolean NOT NULL DEFAULT false,
  edge_position3 boolean NOT NULL DEFAULT false,
  edge_position4 boolean NOT NULL DEFAULT false,
  edge_position5 boolean,
  edge_position6 boolean,
  dimension_a numeric(10, 2) NOT NULL,
  dimension_b numeric(10, 2) NOT NULL,
  dimension_c numeric(10, 2),
  dimension_d numeric(10, 2),
  dimension_e numeric(10, 2),
  dimension_f numeric(10, 2),
  rounding_r1 numeric(10, 2),
  rounding_r2 numeric(10, 2),
  rounding_r3 numeric(10, 2),
  rounding_r4 numeric(10, 2),
  cut_l1 numeric(10, 2),
  cut_l2 numeric(10, 2),
  cut_l3 numeric(10, 2),
  cut_l4 numeric(10, 2),
  cut_l5 numeric(10, 2),
  cut_l6 numeric(10, 2),
  cut_l7 numeric(10, 2),
  cut_l8 numeric(10, 2),
  cutouts jsonb, -- Array of cutout objects: [{id, width, height, distanceFromLeft, distanceFromBottom, worktopType?}]
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT worktop_quote_configs_pkey PRIMARY KEY (id),
  CONSTRAINT worktop_quote_configs_worktop_quote_id_fkey FOREIGN KEY (worktop_quote_id) REFERENCES worktop_quotes (id) ON DELETE CASCADE,
  CONSTRAINT worktop_quote_configs_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES linear_materials (id) ON DELETE RESTRICT
) TABLESPACE pg_default;

-- Worktop quote materials pricing table (stores pricing breakdown per material/config)
CREATE TABLE IF NOT EXISTS public.worktop_quote_materials_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worktop_quote_id uuid NOT NULL,
  config_order integer NOT NULL, -- Links to worktop_quote_configs.config_order
  material_id uuid NOT NULL,
  material_name text NOT NULL,
  currency character varying(10) NOT NULL,
  on_stock boolean NOT NULL,
  anyag_koltseg_net numeric(12, 2) NOT NULL DEFAULT 0,
  anyag_koltseg_vat numeric(12, 2) NOT NULL DEFAULT 0,
  anyag_koltseg_gross numeric(12, 2) NOT NULL DEFAULT 0,
  anyag_koltseg_details text,
  kereszt_vagas_net numeric(12, 2) NOT NULL DEFAULT 0,
  kereszt_vagas_vat numeric(12, 2) NOT NULL DEFAULT 0,
  kereszt_vagas_gross numeric(12, 2) NOT NULL DEFAULT 0,
  kereszt_vagas_details text,
  hosszanti_vagas_net numeric(12, 2) NOT NULL DEFAULT 0,
  hosszanti_vagas_vat numeric(12, 2) NOT NULL DEFAULT 0,
  hosszanti_vagas_gross numeric(12, 2) NOT NULL DEFAULT 0,
  hosszanti_vagas_details text,
  ives_vagas_net numeric(12, 2) NOT NULL DEFAULT 0,
  ives_vagas_vat numeric(12, 2) NOT NULL DEFAULT 0,
  ives_vagas_gross numeric(12, 2) NOT NULL DEFAULT 0,
  ives_vagas_details text,
  szogvagas_net numeric(12, 2) NOT NULL DEFAULT 0,
  szogvagas_vat numeric(12, 2) NOT NULL DEFAULT 0,
  szogvagas_gross numeric(12, 2) NOT NULL DEFAULT 0,
  szogvagas_details text,
  kivagas_net numeric(12, 2) NOT NULL DEFAULT 0,
  kivagas_vat numeric(12, 2) NOT NULL DEFAULT 0,
  kivagas_gross numeric(12, 2) NOT NULL DEFAULT 0,
  kivagas_details text,
  elzaro_net numeric(12, 2) NOT NULL DEFAULT 0,
  elzaro_vat numeric(12, 2) NOT NULL DEFAULT 0,
  elzaro_gross numeric(12, 2) NOT NULL DEFAULT 0,
  elzaro_details text,
  osszemaras_net numeric(12, 2) NOT NULL DEFAULT 0,
  osszemaras_vat numeric(12, 2) NOT NULL DEFAULT 0,
  osszemaras_gross numeric(12, 2) NOT NULL DEFAULT 0,
  osszemaras_details text,
  total_net numeric(12, 2) NOT NULL DEFAULT 0,
  total_vat numeric(12, 2) NOT NULL DEFAULT 0,
  total_gross numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT worktop_quote_materials_pricing_pkey PRIMARY KEY (id),
  CONSTRAINT worktop_quote_materials_pricing_worktop_quote_id_fkey FOREIGN KEY (worktop_quote_id) REFERENCES worktop_quotes (id) ON DELETE CASCADE,
  CONSTRAINT worktop_quote_materials_pricing_material_id_fkey FOREIGN KEY (material_id) REFERENCES linear_materials (id) ON DELETE RESTRICT
) TABLESPACE pg_default;

-- Create indexes for worktop_quotes
CREATE INDEX IF NOT EXISTS idx_worktop_quotes_created_at ON public.worktop_quotes USING btree (created_at DESC) TABLESPACE pg_default
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_worktop_quotes_created_by ON public.worktop_quotes USING btree (created_by) TABLESPACE pg_default
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_worktop_quotes_customer_id ON public.worktop_quotes USING btree (customer_id) TABLESPACE pg_default
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_worktop_quotes_status ON public.worktop_quotes USING btree (status) TABLESPACE pg_default
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_worktop_quotes_quote_number ON public.worktop_quotes USING btree (quote_number) TABLESPACE pg_default
WHERE (deleted_at IS NULL);

-- Create indexes for worktop_quote_configs
CREATE INDEX IF NOT EXISTS idx_worktop_quote_configs_worktop_quote_id ON public.worktop_quote_configs USING btree (worktop_quote_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_worktop_quote_configs_linear_material_id ON public.worktop_quote_configs USING btree (linear_material_id) TABLESPACE pg_default;

-- Create indexes for worktop_quote_materials_pricing
CREATE INDEX IF NOT EXISTS idx_worktop_quote_materials_pricing_worktop_quote_id ON public.worktop_quote_materials_pricing USING btree (worktop_quote_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_worktop_quote_materials_pricing_material_id ON public.worktop_quote_materials_pricing USING btree (material_id) TABLESPACE pg_default;

-- Create trigger for updated_at on worktop_quotes
CREATE TRIGGER update_worktop_quotes_updated_at
  BEFORE UPDATE ON public.worktop_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for quote status timestamps (same as quotes table)
CREATE TRIGGER trigger_update_worktop_quote_status_timestamps
  BEFORE UPDATE ON public.worktop_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_status_timestamps();

-- Create function to generate worktop quote numbers (WK-YYYY-XXX format)
CREATE OR REPLACE FUNCTION generate_worktop_quote_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  current_year text;
  last_number integer;
  new_number text;
BEGIN
  -- Get current year
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Find the highest quote number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 8) AS INTEGER)), 0)
  INTO last_number
  FROM worktop_quotes
  WHERE quote_number LIKE 'WK-' || current_year || '-%'
    AND deleted_at IS NULL;
  
  -- Increment and format
  new_number := 'WK-' || current_year || '-' || LPAD((last_number + 1)::text, 3, '0');
  
  RETURN new_number;
END;
$$;
