-- Update customer_entity_platform_mappings to reference persons and companies separately
-- Rename to customer_platform_mappings and add person_id/company_id

-- Create new table with updated structure
CREATE TABLE IF NOT EXISTS public.customer_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to person OR company (not both)
  person_id UUID REFERENCES customer_persons(id) ON DELETE CASCADE,
  company_id UUID REFERENCES customer_companies(id) ON DELETE CASCADE,
  
  connection_id UUID NOT NULL REFERENCES webshop_connections(id) ON DELETE CASCADE,
  
  -- Platform-specific IDs
  platform_customer_id TEXT NOT NULL,
  platform_inner_id TEXT,
  platform_username TEXT,
  
  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  last_synced_from_platform_at TIMESTAMPTZ,
  last_synced_to_platform_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT customer_platform_mappings_entity_check 
    CHECK (
      (person_id IS NOT NULL AND company_id IS NULL) OR 
      (person_id IS NULL AND company_id IS NOT NULL)
    ),
  UNIQUE(person_id, connection_id) WHERE person_id IS NOT NULL,
  UNIQUE(company_id, connection_id) WHERE company_id IS NOT NULL,
  UNIQUE(connection_id, platform_customer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_person_id 
  ON public.customer_platform_mappings(person_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_company_id 
  ON public.customer_platform_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_connection_id 
  ON public.customer_platform_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_platform_id 
  ON public.customer_platform_mappings(platform_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_synced_from 
  ON public.customer_platform_mappings(last_synced_from_platform_at) 
  WHERE last_synced_from_platform_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_synced_to 
  ON public.customer_platform_mappings(last_synced_to_platform_at) 
  WHERE last_synced_to_platform_at IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_platform_mappings_updated_at
BEFORE UPDATE ON public.customer_platform_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_platform_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer platform mappings are viewable by authenticated users" ON public.customer_platform_mappings;
CREATE POLICY "Customer platform mappings are viewable by authenticated users" 
ON public.customer_platform_mappings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Customer platform mappings are manageable by authenticated users" ON public.customer_platform_mappings;
CREATE POLICY "Customer platform mappings are manageable by authenticated users" 
ON public.customer_platform_mappings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_platform_mappings TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_platform_mappings IS 'Platform-specific customer IDs for syncing between ERP and webshops. References either person or company.';
COMMENT ON COLUMN public.customer_platform_mappings.person_id IS 'References customer_persons(id) - for person platform mappings';
COMMENT ON COLUMN public.customer_platform_mappings.company_id IS 'References customer_companies(id) - for company platform mappings';

-- Note: customer_entity_platform_mappings table will be migrated and then dropped in cleanup script
