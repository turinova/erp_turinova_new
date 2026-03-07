-- Create manufacturers table for brand/manufacturer management
-- This table stores manufacturers/brands used in products
-- Global table (like units, vat) - shared across all platforms

CREATE TABLE IF NOT EXISTS public.manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    website TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS manufacturers_name_unique_active 
ON public.manufacturers (name) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_manufacturers_deleted_at ON public.manufacturers(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for manufacturers table to automatically update updated_at
DROP TRIGGER IF EXISTS update_manufacturers_updated_at ON public.manufacturers;
CREATE TRIGGER update_manufacturers_updated_at
    BEFORE UPDATE ON public.manufacturers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for manufacturers table
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manufacturers table
DROP POLICY IF EXISTS "Manufacturers are viewable by authenticated users" ON public.manufacturers;
CREATE POLICY "Manufacturers are viewable by authenticated users" 
ON public.manufacturers
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Manufacturers are manageable by authenticated users" ON public.manufacturers;
CREATE POLICY "Manufacturers are manageable by authenticated users" 
ON public.manufacturers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturers TO authenticated;
