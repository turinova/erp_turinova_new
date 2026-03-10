-- Create supplier_bank_accounts table
-- This table stores multiple bank accounts for each supplier

CREATE TABLE IF NOT EXISTS public.supplier_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    bank_name VARCHAR NOT NULL, -- Bank neve
    account_number VARCHAR NOT NULL, -- Számlaszám / IBAN
    swift_bic VARCHAR, -- SWIFT/BIC (optional)
    currency_id UUID, -- Will reference currencies table (to be created later)
    is_default BOOLEAN DEFAULT false, -- Alapértelmezett bank
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add index for supplier_id lookups
CREATE INDEX IF NOT EXISTS ix_supplier_bank_accounts_supplier_id ON public.supplier_bank_accounts(supplier_id) WHERE deleted_at IS NULL;

-- Add index for is_default filtering
CREATE INDEX IF NOT EXISTS ix_supplier_bank_accounts_default ON public.supplier_bank_accounts(is_default) WHERE deleted_at IS NULL AND is_default = true;

-- Create trigger for supplier_bank_accounts table to automatically update updated_at
DROP TRIGGER IF EXISTS update_supplier_bank_accounts_updated_at ON public.supplier_bank_accounts;
CREATE TRIGGER update_supplier_bank_accounts_updated_at
    BEFORE UPDATE ON public.supplier_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for supplier_bank_accounts table
ALTER TABLE public.supplier_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_bank_accounts table
DROP POLICY IF EXISTS "Supplier bank accounts are viewable by authenticated users" ON public.supplier_bank_accounts;
CREATE POLICY "Supplier bank accounts are viewable by authenticated users" 
ON public.supplier_bank_accounts
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Supplier bank accounts are manageable by authenticated users" ON public.supplier_bank_accounts;
CREATE POLICY "Supplier bank accounts are manageable by authenticated users" 
ON public.supplier_bank_accounts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_bank_accounts TO authenticated;
