-- Create supplier_addresses table
-- This table stores multiple addresses for each supplier

CREATE TABLE IF NOT EXISTS public.supplier_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    address_type VARCHAR NOT NULL CHECK (address_type IN ('headquarters', 'billing', 'shipping', 'other')), -- Típus: Székhely / Számlázási cím / Szállítási cím / Egyéb
    country VARCHAR NOT NULL, -- Ország
    postal_code VARCHAR, -- Irányítószám
    city VARCHAR NOT NULL, -- Város
    street VARCHAR, -- Utca, házszám
    address_line_2 VARCHAR, -- További címadatok
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add index for supplier_id lookups
CREATE INDEX IF NOT EXISTS ix_supplier_addresses_supplier_id ON public.supplier_addresses(supplier_id) WHERE deleted_at IS NULL;

-- Add index for address_type filtering
CREATE INDEX IF NOT EXISTS ix_supplier_addresses_type ON public.supplier_addresses(address_type) WHERE deleted_at IS NULL;

-- Create trigger for supplier_addresses table to automatically update updated_at
DROP TRIGGER IF EXISTS update_supplier_addresses_updated_at ON public.supplier_addresses;
CREATE TRIGGER update_supplier_addresses_updated_at
    BEFORE UPDATE ON public.supplier_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for supplier_addresses table
ALTER TABLE public.supplier_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_addresses table
DROP POLICY IF EXISTS "Supplier addresses are viewable by authenticated users" ON public.supplier_addresses;
CREATE POLICY "Supplier addresses are viewable by authenticated users" 
ON public.supplier_addresses
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Supplier addresses are manageable by authenticated users" ON public.supplier_addresses;
CREATE POLICY "Supplier addresses are manageable by authenticated users" 
ON public.supplier_addresses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_addresses TO authenticated;
