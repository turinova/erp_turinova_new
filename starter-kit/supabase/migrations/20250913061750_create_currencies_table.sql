-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    rate DECIMAL(10,4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name
ALTER TABLE currencies ADD CONSTRAINT currencies_name_unique UNIQUE (name);

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_currencies_deleted_at ON currencies(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for currencies table to automatically update updated_at
CREATE TRIGGER update_currencies_updated_at
    BEFORE UPDATE ON currencies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data with HUF as base currency (rate = 1)
INSERT INTO currencies (name, rate) VALUES 
    ('HUF', 1.0000),
    ('EUR', 0.0025),
    ('USD', 0.0027),
    ('GBP', 0.0021)
ON CONFLICT (name) DO NOTHING;
