-- Create customer_persons table
-- Separate table for person customers (individuals)

CREATE TABLE IF NOT EXISTS public.customer_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal info
  firstname VARCHAR(255) NOT NULL,
  lastname VARCHAR(255) NOT NULL,
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
  
  -- Personal tax number (can be used for individuals)
  tax_number VARCHAR(50),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT customer_persons_source_check CHECK (source IN ('local', 'webshop_sync'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_persons_source ON public.customer_persons(source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_email ON public.customer_persons(email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_name ON public.customer_persons(firstname, lastname) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_customer_group ON public.customer_persons(customer_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_active ON public.customer_persons(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_deleted_at ON public.customer_persons(deleted_at) WHERE deleted_at IS NULL;

-- Unique constraints (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS customer_persons_email_unique_active 
ON public.customer_persons(email) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_persons_updated_at
BEFORE UPDATE ON public.customer_persons
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_persons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer persons are viewable by authenticated users" ON public.customer_persons;
CREATE POLICY "Customer persons are viewable by authenticated users" 
ON public.customer_persons
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer persons are manageable by authenticated users" ON public.customer_persons;
CREATE POLICY "Customer persons are manageable by authenticated users" 
ON public.customer_persons
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_persons TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_persons IS 'Separate table for person customers (individuals). Can be linked to companies via customer_person_company_relationships.';
COMMENT ON COLUMN public.customer_persons.source IS 'Source: local (created in ERP) or webshop_sync (synced from webshop)';
COMMENT ON COLUMN public.customer_persons.tax_number IS 'Personal tax number (can be used for individuals)';
