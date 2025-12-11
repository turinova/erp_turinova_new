-- Create junction tables for Materials ↔ Accessories and Linear Materials ↔ Accessories
-- These tables enable many-to-many relationships with soft delete support

-- Junction table for Materials ↔ Accessories
CREATE TABLE IF NOT EXISTS public.material_accessories (
  material_id uuid NOT NULL,
  accessory_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT material_accessories_pkey PRIMARY KEY (material_id, accessory_id),
  CONSTRAINT material_accessories_material_id_fkey FOREIGN KEY (material_id) 
    REFERENCES public.materials(id) ON DELETE CASCADE,
  CONSTRAINT material_accessories_accessory_id_fkey FOREIGN KEY (accessory_id) 
    REFERENCES public.accessories(id) ON DELETE RESTRICT
);

-- Junction table for Linear Materials ↔ Accessories
CREATE TABLE IF NOT EXISTS public.linear_material_accessories (
  linear_material_id uuid NOT NULL,
  accessory_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT linear_material_accessories_pkey PRIMARY KEY (linear_material_id, accessory_id),
  CONSTRAINT linear_material_accessories_linear_material_id_fkey FOREIGN KEY (linear_material_id) 
    REFERENCES public.linear_materials(id) ON DELETE CASCADE,
  CONSTRAINT linear_material_accessories_accessory_id_fkey FOREIGN KEY (accessory_id) 
    REFERENCES public.accessories(id) ON DELETE RESTRICT
);

-- Indexes for material_accessories
CREATE INDEX IF NOT EXISTS idx_material_accessories_material_id 
  ON public.material_accessories(material_id);

CREATE INDEX IF NOT EXISTS idx_material_accessories_accessory_id 
  ON public.material_accessories(accessory_id);

CREATE INDEX IF NOT EXISTS idx_material_accessories_deleted_at 
  ON public.material_accessories(deleted_at) 
  WHERE deleted_at IS NULL;

-- Indexes for linear_material_accessories
CREATE INDEX IF NOT EXISTS idx_linear_material_accessories_linear_material_id 
  ON public.linear_material_accessories(linear_material_id);

CREATE INDEX IF NOT EXISTS idx_linear_material_accessories_accessory_id 
  ON public.linear_material_accessories(accessory_id);

CREATE INDEX IF NOT EXISTS idx_linear_material_accessories_deleted_at 
  ON public.linear_material_accessories(deleted_at) 
  WHERE deleted_at IS NULL;

-- Create trigger function for updated_at on material_accessories
CREATE OR REPLACE FUNCTION update_material_accessories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at on material_accessories
CREATE TRIGGER update_material_accessories_updated_at
  BEFORE UPDATE ON public.material_accessories
  FOR EACH ROW
  EXECUTE FUNCTION update_material_accessories_updated_at();

-- Create trigger function for updated_at on linear_material_accessories
CREATE OR REPLACE FUNCTION update_linear_material_accessories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at on linear_material_accessories
CREATE TRIGGER update_linear_material_accessories_updated_at
  BEFORE UPDATE ON public.linear_material_accessories
  FOR EACH ROW
  EXECUTE FUNCTION update_linear_material_accessories_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.material_accessories IS 'Junction table linking materials to accessories with many-to-many relationship and soft delete support';
COMMENT ON TABLE public.linear_material_accessories IS 'Junction table linking linear materials to accessories with many-to-many relationship and soft delete support';

