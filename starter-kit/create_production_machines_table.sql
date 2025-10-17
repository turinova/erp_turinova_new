-- Create production_machines table
CREATE TABLE IF NOT EXISTS public.production_machines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  machine_name character varying(255) NOT NULL,
  comment text,
  usage_limit_per_day integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT production_machines_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Create unique index for active machine names
CREATE UNIQUE INDEX IF NOT EXISTS production_machines_name_unique_active 
ON public.production_machines USING btree (machine_name) 
WHERE (deleted_at IS NULL);

-- Create index for deleted_at for soft delete queries
CREATE INDEX IF NOT EXISTS idx_production_machines_deleted_at 
ON public.production_machines USING btree (deleted_at) 
WHERE (deleted_at IS NULL);

-- Create index for machine_name for search queries
CREATE INDEX IF NOT EXISTS idx_production_machines_name_active 
ON public.production_machines USING btree (machine_name) 
WHERE (deleted_at IS NULL);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_production_machines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_production_machines_updated_at
  BEFORE UPDATE ON production_machines
  FOR EACH ROW
  EXECUTE FUNCTION update_production_machines_updated_at();

-- Insert sample data
INSERT INTO public.production_machines (machine_name, comment, usage_limit_per_day) VALUES
('Gabbiani 700', 'Nagy teljesítményű vágógép', 8),
('Sigma 800', 'Közepes teljesítményű vágógép', 6),
('Gyuri 200', 'Kis teljesítményű vágógép', 4)
ON CONFLICT (machine_name) WHERE deleted_at IS NULL DO NOTHING;
