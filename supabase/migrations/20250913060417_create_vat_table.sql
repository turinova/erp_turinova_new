-- Create VAT (Adónem) table
CREATE TABLE IF NOT EXISTS vat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    kulcs DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name
ALTER TABLE vat ADD CONSTRAINT vat_name_unique UNIQUE (name);

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_vat_deleted_at ON vat(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for vat table to automatically update updated_at
CREATE TRIGGER update_vat_updated_at
    BEFORE UPDATE ON vat
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO vat (name, kulcs) VALUES 
    ('ÁFA mentes', 0.00),
    ('ÁFA 5%', 5.00),
    ('ÁFA 18%', 18.00),
    ('ÁFA 27%', 27.00)
ON CONFLICT (name) DO NOTHING;
