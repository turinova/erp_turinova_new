-- Create customer_bank_accounts table
-- This table stores multiple bank accounts for customer entities (mainly for companies)

CREATE TABLE IF NOT EXISTS public.customer_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_entity_id UUID NOT NULL REFERENCES customer_entities(id) ON DELETE CASCADE,
  
  -- Bank info
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100) NOT NULL, -- IBAN or account number
  swift_bic VARCHAR(20), -- SWIFT/BIC code
  currency_id UUID REFERENCES currencies(id),
  
  -- Flags
  is_default BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_entity_id ON public.customer_bank_accounts(customer_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_default ON public.customer_bank_accounts(is_default) WHERE deleted_at IS NULL AND is_default = true;
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_currency ON public.customer_bank_accounts(currency_id) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_bank_accounts_updated_at
BEFORE UPDATE ON public.customer_bank_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer bank accounts are viewable by authenticated users" ON public.customer_bank_accounts;
CREATE POLICY "Customer bank accounts are viewable by authenticated users" 
ON public.customer_bank_accounts
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer bank accounts are manageable by authenticated users" ON public.customer_bank_accounts;
CREATE POLICY "Customer bank accounts are manageable by authenticated users" 
ON public.customer_bank_accounts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_bank_accounts TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_bank_accounts IS 'Multiple bank accounts for customer entities (mainly for companies)';
COMMENT ON COLUMN public.customer_bank_accounts.account_number IS 'IBAN or account number';
COMMENT ON COLUMN public.customer_bank_accounts.swift_bic IS 'SWIFT/BIC code for international transfers';
