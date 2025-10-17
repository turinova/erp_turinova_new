-- Create units table
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    shortform VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name
ALTER TABLE units ADD CONSTRAINT units_name_unique UNIQUE (name);

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_units_deleted_at ON units(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for units table to automatically update updated_at
CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO units (name, shortform) VALUES 
    ('Darab', 'db'),
    ('Kilogramm', 'kg'),
    ('Méter', 'm'),
    ('Liter', 'l'),
    ('Óra', 'h'),
    ('Nap', 'nap')
ON CONFLICT (name) DO NOTHING;
