-- Create customer_companies table
-- Separate table for company customers

CREATE TABLE IF NOT EXISTS public.customer_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company info
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telephone VARCHAR(50),
  website VARCHAR(255),
  
  -- Identifier (belső ERP azonosító)
  identifier VARCHAR(100),
  
  -- Source tracking (webshop sync vs local creation)
  source VARCHAR(20) DEFAULT 'local', -- 'local' or 'webshop_sync'
  
  -- Relationships
  customer_group_id UUID REFERENCES customer_groups(id),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Default addresses (foreign keys added after customer_addresses table is updated)
  default_billing_address_id UUID,
  default_shipping_address_id UUID,
  registered_address_id UUID, -- Székhely
  mailing_address_id UUID,    -- Levelezési cím
  
  -- Tax numbers
  tax_number VARCHAR(50),              -- Adószám
  eu_tax_number VARCHAR(50),           -- Közösségi adószám
  group_tax_number VARCHAR(50),        -- Csoportos adószám
  company_registration_number VARCHAR(50), -- Cégjegyzékszám
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT customer_companies_source_check CHECK (source IN ('local', 'webshop_sync'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_companies_source ON public.customer_companies(source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_email ON public.customer_companies(email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_name ON public.customer_companies(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_customer_group ON public.customer_companies(customer_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_active ON public.customer_companies(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_deleted_at ON public.customer_companies(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_tax_number ON public.customer_companies(tax_number) WHERE deleted_at IS NULL AND tax_number IS NOT NULL;

-- Unique constraints (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS customer_companies_email_unique_active 
ON public.customer_companies(email) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_companies_name_unique_active 
ON public.customer_companies(name) 
WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_companies_updated_at
BEFORE UPDATE ON public.customer_companies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer companies are viewable by authenticated users" ON public.customer_companies;
CREATE POLICY "Customer companies are viewable by authenticated users" 
ON public.customer_companies
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer companies are manageable by authenticated users" ON public.customer_companies;
CREATE POLICY "Customer companies are manageable by authenticated users" 
ON public.customer_companies
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_companies TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_companies IS 'Separate table for company customers. Can be linked to persons via customer_person_company_relationships.';
COMMENT ON COLUMN public.customer_companies.source IS 'Source: local (created in ERP) or webshop_sync (synced from webshop)';
