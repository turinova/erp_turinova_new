-- Create units table for measurement units management
-- This table stores measurement units (mértékegységek) used in products
-- Similar structure to the ERP units table

CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    shortform VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS units_name_unique_active 
ON public.units (name) 
WHERE deleted_at IS NULL;

-- Add unique constraint on shortform (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS units_shortform_unique_active 
ON public.units (shortform) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_units_deleted_at ON public.units(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for units table to automatically update updated_at
DROP TRIGGER IF EXISTS update_units_updated_at ON public.units;
CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON public.units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (only if they don't exist)
INSERT INTO public.units (name, shortform) 
SELECT * FROM (VALUES 
    ('Darab', 'db'),
    ('Kilogramm', 'kg'),
    ('Gramm', 'g'),
    ('Méter', 'm'),
    ('Centiméter', 'cm'),
    ('Milliméter', 'mm'),
    ('Liter', 'l'),
    ('Milliliter', 'ml'),
    ('Piece', 'pc'),
    ('Doboz', 'box'),
    ('Csomag', 'pack')
) AS v(name, shortform)
WHERE NOT EXISTS (
    SELECT 1 FROM public.units 
    WHERE units.name = v.name AND units.deleted_at IS NULL
);

-- Enable RLS for units table
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- RLS Policies for units table
DROP POLICY IF EXISTS "Units are viewable by authenticated users" ON public.units;
CREATE POLICY "Units are viewable by authenticated users" 
ON public.units
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Units are manageable by authenticated users" ON public.units;
CREATE POLICY "Units are manageable by authenticated users" 
ON public.units
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
