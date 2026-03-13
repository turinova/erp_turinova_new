-- Update customer_bank_accounts table to reference persons and companies separately

-- Add new columns
ALTER TABLE public.customer_bank_accounts
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES customer_persons(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES customer_companies(id) ON DELETE CASCADE;

-- Add constraint: must have either person_id or company_id, but not both
ALTER TABLE public.customer_bank_accounts
  ADD CONSTRAINT customer_bank_accounts_entity_check 
  CHECK (
    (person_id IS NOT NULL AND company_id IS NULL) OR 
    (person_id IS NULL AND company_id IS NOT NULL)
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_person_id 
  ON public.customer_bank_accounts(person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_company_id 
  ON public.customer_bank_accounts(company_id) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON COLUMN public.customer_bank_accounts.person_id IS 'References customer_persons(id) - for person bank accounts';
COMMENT ON COLUMN public.customer_bank_accounts.company_id IS 'References customer_companies(id) - for company bank accounts';
COMMENT ON COLUMN public.customer_bank_accounts.customer_entity_id IS 'DEPRECATED: Use person_id or company_id instead. Will be removed in future migration.';
