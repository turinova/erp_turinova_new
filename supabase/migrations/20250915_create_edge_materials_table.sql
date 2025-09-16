-- Create edge_materials table
CREATE TABLE IF NOT EXISTS edge_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
    type VARCHAR NOT NULL,
    thickness DECIMAL(5,2) NOT NULL,
    width DECIMAL(5,2) NOT NULL,
    decor VARCHAR NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    vat_id UUID NOT NULL REFERENCES vat(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on combination of fields to prevent duplicates
ALTER TABLE edge_materials ADD CONSTRAINT edge_materials_unique_active 
UNIQUE (brand_id, type, thickness, width, decor) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_edge_materials_deleted_at ON edge_materials(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for edge_materials table to automatically update updated_at
CREATE TRIGGER update_edge_materials_updated_at
    BEFORE UPDATE ON edge_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_edge_materials_brand_id ON edge_materials(brand_id);
CREATE INDEX IF NOT EXISTS idx_edge_materials_vat_id ON edge_materials(vat_id);

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_edge_materials_type_active ON edge_materials(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_edge_materials_decor_active ON edge_materials(decor) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_edge_materials_active_ordered ON edge_materials(deleted_at, type, decor) WHERE deleted_at IS NULL;
