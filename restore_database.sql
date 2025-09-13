-- Complete Database Restoration Script
-- This script recreates all the necessary tables for the ERP Turinova system

-- 1. Create brands table
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint for active brands only
CREATE UNIQUE INDEX brands_name_unique_active 
ON brands (name) WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_brands_deleted_at ON brands(deleted_at) WHERE deleted_at IS NULL;

-- 2. Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    mobile VARCHAR,
    discount_percent NUMERIC(5,2) DEFAULT 0,
    billing_name VARCHAR,
    billing_country VARCHAR DEFAULT 'Magyarország',
    billing_city VARCHAR,
    billing_postal_code VARCHAR,
    billing_street VARCHAR,
    billing_house_number VARCHAR,
    billing_tax_number VARCHAR,
    billing_company_reg_number VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint for active customers only
CREATE UNIQUE INDEX customers_name_unique_active 
ON customers (name) WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_customers_deleted_at ON customers(deleted_at) WHERE deleted_at IS NULL;

-- 3. Create tenant_company table
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
CREATE UNIQUE INDEX tenant_company_name_unique_active 
ON tenant_company (name) WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_tenant_company_deleted_at ON tenant_company(deleted_at) WHERE deleted_at IS NULL;

-- 4. Create VAT table
CREATE TABLE IF NOT EXISTS vat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    kulcs NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint for active VAT rates only
CREATE UNIQUE INDEX vat_name_unique_active 
ON vat (name) WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_vat_deleted_at ON vat(deleted_at) WHERE deleted_at IS NULL;

-- 5. Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    rate NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint for active currencies only
CREATE UNIQUE INDEX currencies_name_unique_active 
ON currencies (name) WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_currencies_deleted_at ON currencies(deleted_at) WHERE deleted_at IS NULL;

-- 6. Create units table
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    shortform VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint for active units only
CREATE UNIQUE INDEX units_name_unique_active 
ON units (name) WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_units_deleted_at ON units(deleted_at) WHERE deleted_at IS NULL;

-- 7. Create material_groups table
CREATE TABLE IF NOT EXISTS material_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Create materials table
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id),
    group_id UUID REFERENCES material_groups(id),
    name VARCHAR NOT NULL,
    length_mm INTEGER NOT NULL,
    width_mm INTEGER NOT NULL,
    thickness_mm INTEGER NOT NULL,
    grain_direction BOOLEAN DEFAULT false,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint for active materials only
CREATE UNIQUE INDEX materials_name_unique_active 
ON materials (name) WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_materials_deleted_at ON materials(deleted_at) WHERE deleted_at IS NULL;

-- 9. Create material_settings table
CREATE TABLE IF NOT EXISTS material_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id) UNIQUE,
    kerf_mm INTEGER NOT NULL,
    trim_top_mm INTEGER NOT NULL,
    trim_right_mm INTEGER NOT NULL,
    trim_bottom_mm INTEGER NOT NULL,
    trim_left_mm INTEGER NOT NULL,
    rotatable BOOLEAN NOT NULL,
    waste_multi DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Create material_group_settings table
CREATE TABLE IF NOT EXISTS material_group_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES material_groups(id) UNIQUE,
    kerf_mm INTEGER DEFAULT 3,
    trim_top_mm INTEGER DEFAULT 0,
    trim_right_mm INTEGER DEFAULT 0,
    trim_bottom_mm INTEGER DEFAULT 0,
    trim_left_mm INTEGER DEFAULT 0,
    rotatable BOOLEAN DEFAULT true,
    waste_multi DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Create machine_material_map table
CREATE TABLE IF NOT EXISTS machine_material_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id),
    machine_type VARCHAR NOT NULL,
    machine_code VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(material_id, machine_type)
);

-- 12. Create material_audit table
CREATE TABLE IF NOT EXISTS material_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR NOT NULL,
    row_id UUID NOT NULL,
    action VARCHAR NOT NULL,
    actor VARCHAR,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at column
CREATE TRIGGER update_brands_updated_at 
    BEFORE UPDATE ON brands 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_company_updated_at
    BEFORE UPDATE ON tenant_company
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vat_updated_at
    BEFORE UPDATE ON vat
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_currencies_updated_at
    BEFORE UPDATE ON currencies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_materials_updated_at
    BEFORE UPDATE ON materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_material_settings_updated_at
    BEFORE UPDATE ON material_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_material_group_settings_updated_at
    BEFORE UPDATE ON material_group_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data

-- Insert sample brands
INSERT INTO brands (name, comment) VALUES 
    ('Egger', 'High quality Austrian brand'),
    ('Fundermax', 'Premium Austrian manufacturer'),
    ('Kronospan', 'Leading European manufacturer'),
    ('Kaindl', 'Austrian wood-based materials')
ON CONFLICT DO NOTHING;

-- Insert sample customers
INSERT INTO customers (name, email, mobile, discount_percent, billing_name, billing_country, billing_city, billing_postal_code, billing_street, billing_house_number, billing_tax_number, billing_company_reg_number) VALUES 
    ('Kovács Péter', 'peter.kovacs@example.com', '+36 30 999 2800', 10, 'Kovács Kft.', 'Hungary', 'Kecskemét', '6000', 'Mindszenti krt.', '10', '12345678-1-02', '01-09-999999'),
    ('Mező DáviD', 'zsofia.nagy@example.com', '+36 20 765 1202', 10, 'Nagy Zsófia', 'Magyarország', 'Budapest', '1051', 'Bajcsy-Zsilinszky út', '5', '23123123-1-23', '32-13-213123'),
    ('Mező Zsanet', 'mizor@gmail.com', '+36 30 992 8000', 10, '', 'Magyarország', '', '', '', '', '', '')
ON CONFLICT (email) DO NOTHING;

-- Insert sample tenant company
INSERT INTO tenant_company (name, country, postal_code, city, address, phone_number, email, website, tax_number, company_registration_number, vat_id) VALUES 
    ('Turinova Kft.', 'Magyarország', '6000', 'Kecskemét', 'Mindszenti krt. 10.', '+36 30 999 2800', 'info@turinova.hu', 'https://turinova.hu', '12345678-1-02', '01-09-999999', 'HU12345678')
ON CONFLICT DO NOTHING;

-- Insert sample VAT rates
INSERT INTO vat (name, kulcs) VALUES 
    ('27% ÁFA', 27.0),
    ('18% ÁFA', 18.0),
    ('5% ÁFA', 5.0),
    ('0% ÁFA', 0.0)
ON CONFLICT DO NOTHING;

-- Insert sample currencies
INSERT INTO currencies (name, rate) VALUES 
    ('HUF', 1.0),
    ('EUR', 400.0),
    ('USD', 350.0)
ON CONFLICT DO NOTHING;

-- Insert sample units
INSERT INTO units (name, shortform) VALUES 
    ('darab', 'db'),
    ('méter', 'm'),
    ('négyzetméter', 'm²'),
    ('köbméter', 'm³'),
    ('kilogramm', 'kg')
ON CONFLICT DO NOTHING;

-- Insert sample material groups
INSERT INTO material_groups (name, description) VALUES 
    ('MDF', 'Medium Density Fiberboard'),
    ('Plywood', 'Plywood materials'),
    ('Chipboard', 'Particle board materials'),
    ('OSB', 'Oriented Strand Board'),
    ('Hardboard', 'High density fiberboard')
ON CONFLICT (name) DO NOTHING;

-- Create view for materials with settings
CREATE OR REPLACE VIEW materials_with_settings AS
SELECT 
    m.id,
    b.name as brand_name,
    m.name as material_name,
    m.length_mm,
    m.width_mm,
    m.thickness_mm,
    m.grain_direction,
    m.image_url,
    COALESCE(ms.kerf_mm, mgs.kerf_mm, 3) as kerf_mm,
    COALESCE(ms.trim_top_mm, mgs.trim_top_mm, 0) as trim_top_mm,
    COALESCE(ms.trim_right_mm, mgs.trim_right_mm, 0) as trim_right_mm,
    COALESCE(ms.trim_bottom_mm, mgs.trim_bottom_mm, 0) as trim_bottom_mm,
    COALESCE(ms.trim_left_mm, mgs.trim_left_mm, 0) as trim_left_mm,
    COALESCE(ms.rotatable, mgs.rotatable, true) as rotatable,
    COALESCE(ms.waste_multi, mgs.waste_multi, 1.0) as waste_multi,
    m.created_at,
    m.updated_at
FROM materials m
LEFT JOIN brands b ON m.brand_id = b.id
LEFT JOIN material_settings ms ON m.id = ms.material_id
LEFT JOIN material_groups mg ON m.group_id = mg.id
LEFT JOIN material_group_settings mgs ON mg.id = mgs.group_id
WHERE m.deleted_at IS NULL;

-- Create view for material effective settings
CREATE OR REPLACE VIEW material_effective_settings AS
SELECT 
    m.id as material_id,
    COALESCE(ms.kerf_mm, mgs.kerf_mm, 3) as kerf_mm,
    COALESCE(ms.trim_top_mm, mgs.trim_top_mm, 0) as trim_top_mm,
    COALESCE(ms.trim_right_mm, mgs.trim_right_mm, 0) as trim_right_mm,
    COALESCE(ms.trim_bottom_mm, mgs.trim_bottom_mm, 0) as trim_bottom_mm,
    COALESCE(ms.trim_left_mm, mgs.trim_left_mm, 0) as trim_left_mm,
    COALESCE(ms.rotatable, mgs.rotatable, true) as rotatable,
    COALESCE(ms.waste_multi, mgs.waste_multi, 1.0) as waste_multi,
    m.grain_direction
FROM materials m
LEFT JOIN material_settings ms ON m.id = ms.material_id
LEFT JOIN material_groups mg ON m.group_id = mg.id
LEFT JOIN material_group_settings mgs ON mg.id = mgs.group_id
WHERE m.deleted_at IS NULL;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable Row Level Security (RLS) if needed
-- ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tenant_company ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE vat ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE units ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE material_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE material_group_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE machine_material_map ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE material_audit ENABLE ROW LEVEL SECURITY;

COMMIT;
