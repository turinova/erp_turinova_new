-- Create weight_units table for weight unit management
-- This table stores weight units (súlymértékek) used in products
-- Global table (like units, vat, manufacturers) - shared across all platforms

CREATE TABLE IF NOT EXISTS public.weight_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    shortform VARCHAR NOT NULL,
    shoprenter_weight_class_id TEXT, -- ShopRenter weightClass ID (for mapping)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS weight_units_name_unique_active 
ON public.weight_units (name) 
WHERE deleted_at IS NULL;

-- Add unique constraint on shortform (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS weight_units_shortform_unique_active 
ON public.weight_units (shortform) 
WHERE deleted_at IS NULL;

-- Add index for shoprenter_weight_class_id
CREATE INDEX IF NOT EXISTS idx_weight_units_shoprenter_id 
ON public.weight_units(shoprenter_weight_class_id) 
WHERE shoprenter_weight_class_id IS NOT NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_weight_units_deleted_at ON public.weight_units(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for weight_units table to automatically update updated_at
DROP TRIGGER IF EXISTS update_weight_units_updated_at ON public.weight_units;
CREATE TRIGGER update_weight_units_updated_at
    BEFORE UPDATE ON public.weight_units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (only if they don't exist)
INSERT INTO public.weight_units (name, shortform) 
SELECT * FROM (VALUES 
    ('Kilogramm', 'kg'),
    ('Gramm', 'g'),
    ('Ton', 't'),
    ('Pound', 'lb'),
    ('Ounce', 'oz')
) AS v(name, shortform)
WHERE NOT EXISTS (
    SELECT 1 FROM public.weight_units 
    WHERE weight_units.name = v.name AND weight_units.deleted_at IS NULL
);

-- Enable RLS for weight_units table
ALTER TABLE public.weight_units ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weight_units table
DROP POLICY IF EXISTS "Weight units are viewable by authenticated users" ON public.weight_units;
CREATE POLICY "Weight units are viewable by authenticated users" 
ON public.weight_units
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Weight units are manageable by authenticated users" ON public.weight_units;
CREATE POLICY "Weight units are manageable by authenticated users" 
ON public.weight_units
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_units TO authenticated;
