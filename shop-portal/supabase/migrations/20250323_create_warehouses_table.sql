-- Create warehouses table
-- This table stores warehouse/raktár information

CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Unique constraint on code
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_code_unique 
ON public.warehouses(code) 
WHERE is_active = true;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_warehouses_is_active 
ON public.warehouses(is_active) 
WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Warehouses are viewable by authenticated users" ON public.warehouses;
CREATE POLICY "Warehouses are viewable by authenticated users" 
ON public.warehouses
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Warehouses are manageable by authenticated users" ON public.warehouses;
CREATE POLICY "Warehouses are manageable by authenticated users" 
ON public.warehouses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;

-- Comments
COMMENT ON TABLE public.warehouses IS 'Warehouses/raktárak for inventory management';
COMMENT ON COLUMN public.warehouses.code IS 'Short code/identifier for the warehouse';
