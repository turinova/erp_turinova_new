-- =============================================================================
-- COMPLETE CUSTOMER MIGRATION: customer_entities -> customer_persons + customer_companies
-- =============================================================================
-- Run this single script to migrate from unified customer_entities to separate
-- customer_persons and customer_companies tables with relationship linking
-- =============================================================================

BEGIN;

-- Step 0: Drop existing objects if they exist (for idempotency - allows re-running)
-- Drop triggers first (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_persons') THEN
    DROP TRIGGER IF EXISTS update_customer_persons_updated_at ON public.customer_persons;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_companies') THEN
    DROP TRIGGER IF EXISTS update_customer_companies_updated_at ON public.customer_companies;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_person_company_relationships') THEN
    DROP TRIGGER IF EXISTS update_customer_person_company_relationships_updated_at ON public.customer_person_company_relationships;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_platform_mappings') THEN
    DROP TRIGGER IF EXISTS update_customer_platform_mappings_updated_at ON public.customer_platform_mappings;
  END IF;
END $$;

-- Drop constraints (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_entity_check;
    ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS fk_customer_addresses_person_id;
    ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS fk_customer_addresses_company_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_bank_accounts') THEN
    ALTER TABLE public.customer_bank_accounts DROP CONSTRAINT IF EXISTS customer_bank_accounts_entity_check;
    ALTER TABLE public.customer_bank_accounts DROP CONSTRAINT IF EXISTS fk_customer_bank_accounts_person_id;
    ALTER TABLE public.customer_bank_accounts DROP CONSTRAINT IF EXISTS fk_customer_bank_accounts_company_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_persons') THEN
    ALTER TABLE public.customer_persons DROP CONSTRAINT IF EXISTS fk_customer_persons_default_billing_address;
    ALTER TABLE public.customer_persons DROP CONSTRAINT IF EXISTS fk_customer_persons_default_shipping_address;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_companies') THEN
    ALTER TABLE public.customer_companies DROP CONSTRAINT IF EXISTS fk_customer_companies_default_billing_address;
    ALTER TABLE public.customer_companies DROP CONSTRAINT IF EXISTS fk_customer_companies_default_shipping_address;
    ALTER TABLE public.customer_companies DROP CONSTRAINT IF EXISTS fk_customer_companies_registered_address;
    ALTER TABLE public.customer_companies DROP CONSTRAINT IF EXISTS fk_customer_companies_mailing_address;
  END IF;
END $$;

-- Drop indexes (unique indexes need to be dropped before tables)
DROP INDEX IF EXISTS public.customer_persons_email_unique_active;
DROP INDEX IF EXISTS public.customer_companies_email_unique_active;
DROP INDEX IF EXISTS public.customer_companies_name_unique_active;
DROP INDEX IF EXISTS public.customer_person_company_relationships_unique;
DROP INDEX IF EXISTS public.customer_platform_mappings_person_connection_unique;
DROP INDEX IF EXISTS public.customer_platform_mappings_company_connection_unique;

-- Drop tables (CASCADE will drop dependent objects)
-- Drop in reverse dependency order
DROP TABLE IF EXISTS public.customer_person_company_relationships CASCADE;
DROP TABLE IF EXISTS public.customer_platform_mappings CASCADE;
DROP TABLE IF EXISTS public.customer_persons CASCADE;
DROP TABLE IF EXISTS public.customer_companies CASCADE;

-- Step 1: Create customer_persons table
CREATE TABLE IF NOT EXISTS public.customer_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firstname VARCHAR(255) NOT NULL,
  lastname VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telephone VARCHAR(50),
  website VARCHAR(255),
  identifier VARCHAR(100),
  source VARCHAR(20) DEFAULT 'local',
  customer_group_id UUID REFERENCES customer_groups(id),
  is_active BOOLEAN DEFAULT true,
  default_billing_address_id UUID,
  default_shipping_address_id UUID,
  tax_number VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT customer_persons_source_check CHECK (source IN ('local', 'webshop_sync'))
);

-- Step 2: Create customer_companies table
CREATE TABLE IF NOT EXISTS public.customer_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telephone VARCHAR(50),
  website VARCHAR(255),
  identifier VARCHAR(100),
  source VARCHAR(20) DEFAULT 'local',
  customer_group_id UUID REFERENCES customer_groups(id),
  is_active BOOLEAN DEFAULT true,
  default_billing_address_id UUID,
  default_shipping_address_id UUID,
  registered_address_id UUID,
  mailing_address_id UUID,
  tax_number VARCHAR(50),
  eu_tax_number VARCHAR(50),
  group_tax_number VARCHAR(50),
  company_registration_number VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT customer_companies_source_check CHECK (source IN ('local', 'webshop_sync'))
);

-- Step 3: Create customer_person_company_relationships table
CREATE TABLE IF NOT EXISTS public.customer_person_company_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES customer_persons(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES customer_companies(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'contact_person',
  is_primary BOOLEAN DEFAULT false,
  is_billing_contact BOOLEAN DEFAULT false,
  is_shipping_contact BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT customer_person_company_relationships_role_check 
    CHECK (role IN ('owner', 'contact_person', 'manager', 'accountant', 'other'))
);

-- Step 4: Drop existing constraints if they exist (to avoid conflicts during migration)
ALTER TABLE public.customer_addresses
  DROP CONSTRAINT IF EXISTS customer_addresses_entity_check;

ALTER TABLE public.customer_bank_accounts
  DROP CONSTRAINT IF EXISTS customer_bank_accounts_entity_check;

-- Step 5: Add person_id and company_id columns to customer_addresses (without constraint yet)
ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS person_id UUID,
  ADD COLUMN IF NOT EXISTS company_id UUID;

-- Step 6: Add person_id and company_id columns to customer_bank_accounts (without constraint yet)
ALTER TABLE public.customer_bank_accounts
  ADD COLUMN IF NOT EXISTS person_id UUID,
  ADD COLUMN IF NOT EXISTS company_id UUID;

-- Step 7: Migrate persons from customer_entities to customer_persons
INSERT INTO public.customer_persons (
  id, firstname, lastname, email, telephone, website, identifier, source,
  customer_group_id, is_active, tax_number, notes, created_at, updated_at, deleted_at
)
SELECT 
  id,
  COALESCE(firstname, ''),
  COALESCE(lastname, ''),
  email,
  telephone,
  website,
  identifier,
  source,
  customer_group_id,
  is_active,
  tax_number,
  notes,
  created_at,
  updated_at,
  deleted_at
FROM public.customer_entities
WHERE entity_type = 'person' AND deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 8: Migrate companies from customer_entities to customer_companies
INSERT INTO public.customer_companies (
  id, name, email, telephone, website, identifier, source,
  customer_group_id, is_active, default_billing_address_id, default_shipping_address_id,
  registered_address_id, mailing_address_id, tax_number, eu_tax_number,
  group_tax_number, company_registration_number, notes, created_at, updated_at, deleted_at
)
SELECT 
  id,
  name,
  email,
  telephone,
  website,
  identifier,
  source,
  customer_group_id,
  is_active,
  default_billing_address_id,
  default_shipping_address_id,
  registered_address_id,
  mailing_address_id,
  tax_number,
  eu_tax_number,
  group_tax_number,
  company_registration_number,
  notes,
  created_at,
  updated_at,
  deleted_at
FROM public.customer_entities
WHERE entity_type = 'company' AND deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 9: Update customer_addresses to set person_id or company_id
UPDATE public.customer_addresses ca
SET person_id = ce.id
FROM public.customer_entities ce
WHERE ca.customer_entity_id = ce.id 
  AND ce.entity_type = 'person'
  AND ca.person_id IS NULL;

UPDATE public.customer_addresses ca
SET company_id = ce.id
FROM public.customer_entities ce
WHERE ca.customer_entity_id = ce.id 
  AND ce.entity_type = 'company'
  AND ca.company_id IS NULL;

-- Step 10: Update customer_bank_accounts to set person_id or company_id
UPDATE public.customer_bank_accounts cba
SET person_id = ce.id
FROM public.customer_entities ce
WHERE cba.customer_entity_id = ce.id 
  AND ce.entity_type = 'person'
  AND cba.person_id IS NULL;

UPDATE public.customer_bank_accounts cba
SET company_id = ce.id
FROM public.customer_entities ce
WHERE cba.customer_entity_id = ce.id 
  AND ce.entity_type = 'company'
  AND cba.company_id IS NULL;

-- Step 11: Add foreign key constraints for person_id and company_id (drop first to avoid conflicts)
ALTER TABLE public.customer_addresses
  DROP CONSTRAINT IF EXISTS fk_customer_addresses_person_id;
ALTER TABLE public.customer_addresses
  ADD CONSTRAINT fk_customer_addresses_person_id 
  FOREIGN KEY (person_id) REFERENCES customer_persons(id) ON DELETE CASCADE;

ALTER TABLE public.customer_addresses
  DROP CONSTRAINT IF EXISTS fk_customer_addresses_company_id;
ALTER TABLE public.customer_addresses
  ADD CONSTRAINT fk_customer_addresses_company_id 
  FOREIGN KEY (company_id) REFERENCES customer_companies(id) ON DELETE CASCADE;

ALTER TABLE public.customer_bank_accounts
  DROP CONSTRAINT IF EXISTS fk_customer_bank_accounts_person_id;
ALTER TABLE public.customer_bank_accounts
  ADD CONSTRAINT fk_customer_bank_accounts_person_id 
  FOREIGN KEY (person_id) REFERENCES customer_persons(id) ON DELETE CASCADE;

ALTER TABLE public.customer_bank_accounts
  DROP CONSTRAINT IF EXISTS fk_customer_bank_accounts_company_id;
ALTER TABLE public.customer_bank_accounts
  ADD CONSTRAINT fk_customer_bank_accounts_company_id 
  FOREIGN KEY (company_id) REFERENCES customer_companies(id) ON DELETE CASCADE;

-- Step 12: Clean up any addresses/bank accounts that still reference customer_entity_id
-- (These should have been migrated, but if not, we'll handle them)
UPDATE public.customer_addresses
SET person_id = customer_entity_id
WHERE customer_entity_id IS NOT NULL 
  AND person_id IS NULL 
  AND company_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.customer_entities ce 
    WHERE ce.id = customer_addresses.customer_entity_id 
    AND ce.entity_type = 'person'
  );

UPDATE public.customer_addresses
SET company_id = customer_entity_id
WHERE customer_entity_id IS NOT NULL 
  AND person_id IS NULL 
  AND company_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.customer_entities ce 
    WHERE ce.id = customer_addresses.customer_entity_id 
    AND ce.entity_type = 'company'
  );

UPDATE public.customer_bank_accounts
SET person_id = customer_entity_id
WHERE customer_entity_id IS NOT NULL 
  AND person_id IS NULL 
  AND company_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.customer_entities ce 
    WHERE ce.id = customer_bank_accounts.customer_entity_id 
    AND ce.entity_type = 'person'
  );

UPDATE public.customer_bank_accounts
SET company_id = customer_entity_id
WHERE customer_entity_id IS NOT NULL 
  AND person_id IS NULL 
  AND company_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.customer_entities ce 
    WHERE ce.id = customer_bank_accounts.customer_entity_id 
    AND ce.entity_type = 'company'
  );

-- Step 13: Now add the check constraint (after data is migrated)
-- Drop first to avoid conflicts
ALTER TABLE public.customer_addresses
  DROP CONSTRAINT IF EXISTS customer_addresses_entity_check;
ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_entity_check 
  CHECK (
    (person_id IS NOT NULL AND company_id IS NULL) OR 
    (person_id IS NULL AND company_id IS NOT NULL) OR
    (customer_entity_id IS NOT NULL AND person_id IS NULL AND company_id IS NULL)
  );

ALTER TABLE public.customer_bank_accounts
  DROP CONSTRAINT IF EXISTS customer_bank_accounts_entity_check;
ALTER TABLE public.customer_bank_accounts
  ADD CONSTRAINT customer_bank_accounts_entity_check 
  CHECK (
    (person_id IS NOT NULL AND company_id IS NULL) OR 
    (person_id IS NULL AND company_id IS NOT NULL) OR
    (customer_entity_id IS NOT NULL AND person_id IS NULL AND company_id IS NULL)
  );

-- Step 14: Create customer_platform_mappings table
CREATE TABLE IF NOT EXISTS public.customer_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES customer_persons(id) ON DELETE CASCADE,
  company_id UUID REFERENCES customer_companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES webshop_connections(id) ON DELETE CASCADE,
  platform_customer_id TEXT NOT NULL,
  platform_inner_id TEXT,
  platform_username TEXT,
  last_synced_at TIMESTAMPTZ,
  last_synced_from_platform_at TIMESTAMPTZ,
  last_synced_to_platform_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT customer_platform_mappings_entity_check 
    CHECK (
      (person_id IS NOT NULL AND company_id IS NULL) OR 
      (person_id IS NULL AND company_id IS NOT NULL)
    ),
  UNIQUE(connection_id, platform_customer_id)
);

-- Step 15: Migrate platform mappings
INSERT INTO public.customer_platform_mappings (
  person_id, company_id, connection_id, platform_customer_id, platform_inner_id,
  platform_username, last_synced_at, last_synced_from_platform_at,
  last_synced_to_platform_at, created_at, updated_at
)
SELECT 
  CASE WHEN ce.entity_type = 'person' THEN ce.id ELSE NULL END as person_id,
  CASE WHEN ce.entity_type = 'company' THEN ce.id ELSE NULL END as company_id,
  cepm.connection_id,
  cepm.platform_customer_id,
  cepm.platform_inner_id,
  cepm.platform_username,
  cepm.last_synced_at,
  cepm.last_synced_from_platform_at,
  cepm.last_synced_to_platform_at,
  cepm.created_at,
  cepm.updated_at
FROM public.customer_entity_platform_mappings cepm
JOIN public.customer_entities ce ON cepm.customer_entity_id = ce.id
WHERE ce.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Step 16: Add indexes
CREATE INDEX IF NOT EXISTS idx_customer_persons_source ON public.customer_persons(source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_email ON public.customer_persons(email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_name ON public.customer_persons(firstname, lastname) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_customer_group ON public.customer_persons(customer_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_persons_active ON public.customer_persons(is_active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_companies_source ON public.customer_companies(source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_email ON public.customer_companies(email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_name ON public.customer_companies(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_customer_group ON public.customer_companies(customer_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_active ON public.customer_companies(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_companies_tax_number ON public.customer_companies(tax_number) WHERE deleted_at IS NULL AND tax_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_person_id 
  ON public.customer_person_company_relationships(person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_person_company_relationships_company_id 
  ON public.customer_person_company_relationships(company_id) WHERE deleted_at IS NULL;

-- Create unique index for person-company relationships (only for non-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS customer_person_company_relationships_unique
  ON public.customer_person_company_relationships(person_id, company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_addresses_person_id 
  ON public.customer_addresses(person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_company_id 
  ON public.customer_addresses(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_person_id 
  ON public.customer_bank_accounts(person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_company_id 
  ON public.customer_bank_accounts(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_person_id 
  ON public.customer_platform_mappings(person_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_company_id 
  ON public.customer_platform_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_connection_id 
  ON public.customer_platform_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_customer_platform_mappings_platform_id 
  ON public.customer_platform_mappings(platform_customer_id);

-- Create unique indexes with WHERE clauses (for partial uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS customer_platform_mappings_person_connection_unique
  ON public.customer_platform_mappings(person_id, connection_id)
  WHERE person_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_platform_mappings_company_connection_unique
  ON public.customer_platform_mappings(company_id, connection_id)
  WHERE company_id IS NOT NULL;

-- Step 17: Add unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS customer_persons_email_unique_active 
ON public.customer_persons(email) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_companies_email_unique_active 
ON public.customer_companies(email) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_companies_name_unique_active 
ON public.customer_companies(name) 
WHERE deleted_at IS NULL;

-- Step 18: Add triggers (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS update_customer_persons_updated_at ON public.customer_persons;
CREATE TRIGGER update_customer_persons_updated_at
BEFORE UPDATE ON public.customer_persons
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_companies_updated_at ON public.customer_companies;
CREATE TRIGGER update_customer_companies_updated_at
BEFORE UPDATE ON public.customer_companies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_person_company_relationships_updated_at ON public.customer_person_company_relationships;
CREATE TRIGGER update_customer_person_company_relationships_updated_at
BEFORE UPDATE ON public.customer_person_company_relationships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_platform_mappings_updated_at ON public.customer_platform_mappings;
CREATE TRIGGER update_customer_platform_mappings_updated_at
BEFORE UPDATE ON public.customer_platform_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Step 19: Add foreign keys for default addresses (drop first to avoid conflicts)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_persons
    DROP CONSTRAINT IF EXISTS fk_customer_persons_default_billing_address;
    ALTER TABLE public.customer_persons
    ADD CONSTRAINT fk_customer_persons_default_billing_address 
    FOREIGN KEY (default_billing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_persons
    DROP CONSTRAINT IF EXISTS fk_customer_persons_default_shipping_address;
    ALTER TABLE public.customer_persons
    ADD CONSTRAINT fk_customer_persons_default_shipping_address 
    FOREIGN KEY (default_shipping_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    DROP CONSTRAINT IF EXISTS fk_customer_companies_default_billing_address;
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT fk_customer_companies_default_billing_address 
    FOREIGN KEY (default_billing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    DROP CONSTRAINT IF EXISTS fk_customer_companies_default_shipping_address;
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT fk_customer_companies_default_shipping_address 
    FOREIGN KEY (default_shipping_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    DROP CONSTRAINT IF EXISTS fk_customer_companies_registered_address;
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT fk_customer_companies_registered_address 
    FOREIGN KEY (registered_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    DROP CONSTRAINT IF EXISTS fk_customer_companies_mailing_address;
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT fk_customer_companies_mailing_address 
    FOREIGN KEY (mailing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Step 20: Enable RLS and add policies
DO $$
BEGIN
  -- Enable RLS
  ALTER TABLE public.customer_persons ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.customer_companies ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.customer_person_company_relationships ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.customer_platform_mappings ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore if already enabled
END $$;

DROP POLICY IF EXISTS "Customer persons are viewable by authenticated users" ON public.customer_persons;
CREATE POLICY "Customer persons are viewable by authenticated users" 
ON public.customer_persons FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer persons are manageable by authenticated users" ON public.customer_persons;
CREATE POLICY "Customer persons are manageable by authenticated users" 
ON public.customer_persons FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Customer companies are viewable by authenticated users" ON public.customer_companies;
CREATE POLICY "Customer companies are viewable by authenticated users" 
ON public.customer_companies FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer companies are manageable by authenticated users" ON public.customer_companies;
CREATE POLICY "Customer companies are manageable by authenticated users" 
ON public.customer_companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Customer person company relationships are viewable by authenticated users" ON public.customer_person_company_relationships;
CREATE POLICY "Customer person company relationships are viewable by authenticated users" 
ON public.customer_person_company_relationships FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer person company relationships are manageable by authenticated users" ON public.customer_person_company_relationships;
CREATE POLICY "Customer person company relationships are manageable by authenticated users" 
ON public.customer_person_company_relationships FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Customer platform mappings are viewable by authenticated users" ON public.customer_platform_mappings;
CREATE POLICY "Customer platform mappings are viewable by authenticated users" 
ON public.customer_platform_mappings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Customer platform mappings are manageable by authenticated users" ON public.customer_platform_mappings;
CREATE POLICY "Customer platform mappings are manageable by authenticated users" 
ON public.customer_platform_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Step 21: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_persons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_person_company_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_platform_mappings TO authenticated;

-- Step 22: Add comments
COMMENT ON TABLE public.customer_persons IS 'Separate table for person customers (individuals). Can be linked to companies via customer_person_company_relationships.';
COMMENT ON TABLE public.customer_companies IS 'Separate table for company customers. Can be linked to persons via customer_person_company_relationships.';
COMMENT ON TABLE public.customer_person_company_relationships IS 'Many-to-many relationships between persons and companies. Allows linking persons to companies with roles (owner, contact_person, etc.).';
COMMENT ON TABLE public.customer_platform_mappings IS 'Platform-specific customer IDs for syncing between ERP and webshops. References either person or company.';

COMMIT;

-- Verification queries (run these after migration to verify):
-- SELECT COUNT(*) FROM customer_entities WHERE entity_type = 'person';
-- SELECT COUNT(*) FROM customer_persons;
-- SELECT COUNT(*) FROM customer_entities WHERE entity_type = 'company';
-- SELECT COUNT(*) FROM customer_companies;
