-- Create suppliers table
-- This table stores supplier/beslállító master data

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL, -- Cég neve
    short_name VARCHAR, -- Rövid név / alias (optional)
    email VARCHAR, -- E-mail cím
    phone VARCHAR, -- Telefonszám
    website VARCHAR, -- Weboldal
    tax_number VARCHAR, -- Adószám
    eu_tax_number VARCHAR, -- Közösségi adószám
    note TEXT, -- Megjegyzés
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'inactive')), -- Státusz: Aktív / Inaktív
    default_payment_method_id UUID, -- Will reference payment_methods table (to be created later)
    default_payment_terms_days INTEGER, -- Fizetési határidő (napokban, pl. 8, 14, 30, 60)
    default_vat_id UUID REFERENCES public.vat(id) ON DELETE SET NULL, -- Alapértelmezett ÁFA
    default_currency_id UUID, -- Will reference currencies table (to be created later)
    default_order_channel VARCHAR CHECK (default_order_channel IN ('email', 'phone', 'in_person', 'internet')), -- Alapértelmezett rendelési csatorna
    default_order_email VARCHAR, -- Alapértelmezett rendelési e-mail cím
    email_template_subject TEXT, -- E-mail sablon tárgya
    email_template_body TEXT, -- E-mail sablon törzse
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_unique_active 
ON public.suppliers (name) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_suppliers_deleted_at ON public.suppliers(deleted_at) WHERE deleted_at IS NULL;

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS ix_suppliers_status ON public.suppliers(status) WHERE deleted_at IS NULL;

-- Add index for tax_number searches
CREATE INDEX IF NOT EXISTS ix_suppliers_tax_number ON public.suppliers(tax_number) WHERE deleted_at IS NULL AND tax_number IS NOT NULL;

-- Create trigger for suppliers table to automatically update updated_at
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for suppliers table
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers table
DROP POLICY IF EXISTS "Suppliers are viewable by authenticated users" ON public.suppliers;
CREATE POLICY "Suppliers are viewable by authenticated users" 
ON public.suppliers
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Suppliers are manageable by authenticated users" ON public.suppliers;
CREATE POLICY "Suppliers are manageable by authenticated users" 
ON public.suppliers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
