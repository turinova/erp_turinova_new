-- Create customer_entities table (Unified: Vevők ÉS Cégek egy táblában)
-- This table stores both persons and companies in a unified way
-- Inspired by Notion/Airtable approach: one table, type-based display

CREATE TABLE IF NOT EXISTS public.customer_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entity Type (Person or Company)
  entity_type VARCHAR(20) NOT NULL DEFAULT 'person', -- 'person' or 'company'
  
  -- ===== COMMON FIELDS (Both Person and Company) =====
  -- Basic contact info
  name VARCHAR(255) NOT NULL, -- For person: "Kovács János", For company: "ABC Kft."
  email VARCHAR(255),
  telephone VARCHAR(50),
  website VARCHAR(255), -- Mainly for companies, but can be used for persons too
  
  -- Identifier (belső ERP azonosító)
  identifier VARCHAR(100), -- Opcionális, egyedi azonosító
  
  -- Source tracking (webshop sync vs local creation)
  source VARCHAR(20) DEFAULT 'local', -- 'local' (created in ERP) or 'webshop_sync' (synced from webshop)
  
  -- Relationships
  customer_group_id UUID REFERENCES customer_groups(id),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Default addresses (foreign keys added after customer_addresses table is created)
  default_billing_address_id UUID, -- References customer_addresses(id) - FK added in separate migration
  default_shipping_address_id UUID, -- References customer_addresses(id) - FK added in separate migration
  
  -- ===== PERSON-SPECIFIC FIELDS (Only for entity_type='person') =====
  firstname VARCHAR(255), -- For person: "János"
  lastname VARCHAR(255),  -- For person: "Kovács"
  
  -- ===== COMPANY-SPECIFIC FIELDS (Only for entity_type='company') =====
  -- Tax numbers (több adószám típus)
  tax_number VARCHAR(50),              -- Adószám
  eu_tax_number VARCHAR(50),           -- Közösségi adószám
  group_tax_number VARCHAR(50),        -- Csoportos adószám
  company_registration_number VARCHAR(50), -- Cégjegyzékszám
  
  -- Company addresses
  registered_address_id UUID, -- Székhely (references customer_addresses)
  mailing_address_id UUID,    -- Levelezési cím (references customer_addresses)
  
  -- Metadata
  notes TEXT, -- Megjegyzések (mindkét típushoz)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT customer_entities_type_check CHECK (entity_type IN ('person', 'company')),
  CONSTRAINT customer_entities_source_check CHECK (source IN ('local', 'webshop_sync'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_entities_type ON public.customer_entities(entity_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_entities_source ON public.customer_entities(source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_entities_email ON public.customer_entities(email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_entities_name ON public.customer_entities(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_entities_customer_group ON public.customer_entities(customer_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_entities_active ON public.customer_entities(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_entities_deleted_at ON public.customer_entities(deleted_at) WHERE deleted_at IS NULL;

-- Unique constraints (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS customer_entities_email_unique_active 
ON public.customer_entities(email) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_entities_name_unique_active 
ON public.customer_entities(name) 
WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_customer_entities_updated_at
BEFORE UPDATE ON public.customer_entities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Customer entities are viewable by authenticated users" ON public.customer_entities;
CREATE POLICY "Customer entities are viewable by authenticated users" 
ON public.customer_entities
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer entities are manageable by authenticated users" ON public.customer_entities;
CREATE POLICY "Customer entities are manageable by authenticated users" 
ON public.customer_entities
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_entities TO authenticated;

-- Comments
COMMENT ON TABLE public.customer_entities IS 'Unified table for customers (persons) and companies. Type-based display similar to Notion/Airtable.';
COMMENT ON COLUMN public.customer_entities.entity_type IS 'Type: person or company';
COMMENT ON COLUMN public.customer_entities.source IS 'Source: local (created in ERP) or webshop_sync (synced from webshop)';
COMMENT ON COLUMN public.customer_entities.name IS 'Full name for person (firstname + lastname) or company name';
COMMENT ON COLUMN public.customer_entities.firstname IS 'First name (only for person type)';
COMMENT ON COLUMN public.customer_entities.lastname IS 'Last name (only for person type)';
COMMENT ON COLUMN public.customer_entities.tax_number IS 'Adószám (only for company type)';
COMMENT ON COLUMN public.customer_entities.eu_tax_number IS 'Közösségi adószám (only for company type)';
COMMENT ON COLUMN public.customer_entities.group_tax_number IS 'Csoportos adószám (only for company type)';
COMMENT ON COLUMN public.customer_entities.company_registration_number IS 'Cégjegyzékszám (only for company type)';
