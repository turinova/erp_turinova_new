-- Create customer_person_company_relationships table
-- Many-to-many relationship between persons and companies
-- Allows linking persons to companies (e.g., contact person, owner, manager)

CREATE TABLE IF NOT EXISTS public.customer_person_company_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  person_id UUID NOT NULL REFERENCES customer_persons(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES customer_companies(id) ON DELETE CASCADE,
  
  -- Relationship role
  role VARCHAR(50) NOT NULL DEFAULT 'contact_person',
  -- 'owner', 'contact_person', 'manager', 'accountant', 'other'
  
  -- Flags
  is_primary BOOLEAN DEFAULT false, -- Primary contact person for the company
  is_billing_contact BOOLEAN DEFAULT false, -- Contact for billing matters
  is_shipping_contact BOOLEAN DEFAULT false, -- Contact for shipping matters
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT customer_person_company_relationships_role_check 
    CHECK (role IN ('owner', 'contact_person', 'manager', 'accountant', 'other')),
  UNIQUE(person_id, company_id, deleted_at) -- One relationship per person-company pair (when not deleted)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_person_id 
  ON public.customer_person_company_relationships(person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_company_id 
  ON public.customer_person_company_relationships(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_role 
  ON public.customer_person_company_relationships(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_primary 
  ON public.customer_person_company_relationships(is_primary) WHERE deleted_at IS NULL AND is_primary = true;

-- Trigger for updated_at
CREATE TRIGGER update_customer_person_company_relationships_updated_at
BEFORE UPDATE ON public.customer_person_company_relationships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_person_company_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer person company relationships are viewable by authenticated users" ON public.customer_person_company_relationships;
CREATE POLICY "Customer person company relationships are viewable by authenticated users" 
ON public.customer_person_company_relationships
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer person company relationships are manageable by authenticated users" ON public.customer_person_company_relationships;
CREATE POLICY "Customer person company relationships are manageable by authenticated users" 
ON public.customer_person_company_relationships
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_person_company_relationships TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_person_company_relationships IS 'Many-to-many relationships between persons and companies. Allows linking persons to companies with roles (owner, contact_person, etc.).';
COMMENT ON COLUMN public.customer_person_company_relationships.role IS 'Role: owner, contact_person, manager, accountant, other';
COMMENT ON COLUMN public.customer_person_company_relationships.is_primary IS 'Primary contact person for the company';
