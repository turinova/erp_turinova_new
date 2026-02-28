-- Add VAT support to shoprenter_products
-- This allows full control over VAT rates and syncing with ShopRenter taxClasses

-- Create VAT (Adónem) table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    kulcs DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS vat_name_unique_active 
ON public.vat (name) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_vat_deleted_at ON public.vat(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for vat table to automatically update updated_at
DROP TRIGGER IF EXISTS update_vat_updated_at ON public.vat;
CREATE TRIGGER update_vat_updated_at
    BEFORE UPDATE ON public.vat
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (only if they don't exist)
INSERT INTO public.vat (name, kulcs) 
SELECT * FROM (VALUES 
    ('ÁFA mentes', 0.00),
    ('ÁFA 5%', 5.00),
    ('ÁFA 18%', 18.00),
    ('ÁFA 27%', 27.00)
) AS v(name, kulcs)
WHERE NOT EXISTS (
    SELECT 1 FROM public.vat 
    WHERE vat.name = v.name AND vat.deleted_at IS NULL
);

-- Enable RLS for vat table
ALTER TABLE public.vat ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vat table
DROP POLICY IF EXISTS "VAT rates are viewable by authenticated users" ON public.vat;
CREATE POLICY "VAT rates are viewable by authenticated users" 
ON public.vat
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "VAT rates are manageable by authenticated users" ON public.vat;
CREATE POLICY "VAT rates are manageable by authenticated users" 
ON public.vat
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add vat_id to shoprenter_products (references vat table)
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS vat_id UUID;

-- Add gross_price for internal calculations and display
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS gross_price DECIMAL(15,4);

-- Add shoprenter_tax_class_id to store ShopRenter's taxClass ID
ALTER TABLE public.shoprenter_products 
ADD COLUMN IF NOT EXISTS shoprenter_tax_class_id TEXT;

-- Create index for VAT lookups
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_vat_id 
ON public.shoprenter_products(vat_id) 
WHERE vat_id IS NOT NULL;

-- Create index for taxClass lookups
CREATE INDEX IF NOT EXISTS idx_shoprenter_products_tax_class_id 
ON public.shoprenter_products(shoprenter_tax_class_id) 
WHERE shoprenter_tax_class_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.shoprenter_products.vat_id IS 'Reference to ERP VAT rate (from vat table). ERP is source of truth for VAT.';
COMMENT ON COLUMN public.shoprenter_products.gross_price IS 'Calculated gross price (net + VAT). Stored for display and calculations.';
COMMENT ON COLUMN public.shoprenter_products.shoprenter_tax_class_id IS 'ShopRenter taxClass ID (base64 encoded). Used for syncing taxClass to ShopRenter.';

-- Create mapping table: ERP VAT rates ↔ ShopRenter taxClasses (per connection)
CREATE TABLE IF NOT EXISTS public.shoprenter_tax_class_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  vat_id UUID NOT NULL, -- ERP VAT rate ID (references vat table)
  shoprenter_tax_class_id TEXT NOT NULL, -- ShopRenter taxClass ID (base64 encoded)
  shoprenter_tax_class_name TEXT, -- ShopRenter taxClass name (for display)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, vat_id),
  UNIQUE(connection_id, shoprenter_tax_class_id)
);

-- Indexes for tax mappings
CREATE INDEX IF NOT EXISTS idx_tax_mappings_connection 
ON public.shoprenter_tax_class_mappings(connection_id);

CREATE INDEX IF NOT EXISTS idx_tax_mappings_vat 
ON public.shoprenter_tax_class_mappings(vat_id);

-- RLS Policies for tax mappings
ALTER TABLE public.shoprenter_tax_class_mappings ENABLE ROW LEVEL SECURITY;

-- View mappings (authenticated users)
DROP POLICY IF EXISTS "Tax mappings are viewable by authenticated users" ON public.shoprenter_tax_class_mappings;
CREATE POLICY "Tax mappings are viewable by authenticated users" 
ON public.shoprenter_tax_class_mappings
FOR SELECT
TO authenticated
USING (true);

-- Manage mappings (authenticated users)
DROP POLICY IF EXISTS "Tax mappings are manageable by authenticated users" ON public.shoprenter_tax_class_mappings;
CREATE POLICY "Tax mappings are manageable by authenticated users" 
ON public.shoprenter_tax_class_mappings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
