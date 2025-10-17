-- Create tenant_company table
CREATE TABLE IF NOT EXISTS tenant_company (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    country VARCHAR,
    postal_code VARCHAR,
    city VARCHAR,
    address VARCHAR,
    phone_number VARCHAR,
    email VARCHAR,
    website VARCHAR,
    tax_number VARCHAR,
    company_registration_number VARCHAR,
    vat_id VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name
ALTER TABLE tenant_company ADD CONSTRAINT tenant_company_name_unique_active 
UNIQUE (name);

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_tenant_company_deleted_at ON tenant_company(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for tenant_company table to automatically update updated_at
CREATE TRIGGER update_tenant_company_updated_at
    BEFORE UPDATE ON tenant_company
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO tenant_company (
    name, 
    country, 
    postal_code, 
    city, 
    address, 
    phone_number, 
    email, 
    website, 
    tax_number, 
    company_registration_number, 
    vat_id
) VALUES 
    (
        'Turinova Kft.',
        'Magyarország',
        '6000',
        'Kecskemét',
        'Mindszenti krt. 10.',
        '+36 30 999 2800',
        'info@turinova.hu',
        'https://turinova.hu',
        '12345678-1-02',
        '01-09-999999',
        'HU12345678'
    )
ON CONFLICT ON CONSTRAINT tenant_company_name_unique_active DO NOTHING;
