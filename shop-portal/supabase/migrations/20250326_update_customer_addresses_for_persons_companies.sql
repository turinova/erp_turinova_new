-- Update customer_addresses table to reference persons and companies separately
-- Instead of customer_entity_id, we'll use person_id and company_id

-- Add new columns
ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES customer_persons(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES customer_companies(id) ON DELETE CASCADE;

-- Add constraint: must have either person_id or company_id, but not both
ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_entity_check 
  CHECK (
    (person_id IS NOT NULL AND company_id IS NULL) OR 
    (person_id IS NULL AND company_id IS NOT NULL)
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_addresses_person_id 
  ON public.customer_addresses(person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_company_id 
  ON public.customer_addresses(company_id) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON COLUMN public.customer_addresses.person_id IS 'References customer_persons(id) - for person addresses';
COMMENT ON COLUMN public.customer_addresses.company_id IS 'References customer_companies(id) - for company addresses';
COMMENT ON COLUMN public.customer_addresses.customer_entity_id IS 'DEPRECATED: Use person_id or company_id instead. Will be removed in future migration.';
