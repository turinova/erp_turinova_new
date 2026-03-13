-- ============================================================================
-- CLEANUP SCRIPT: Remove old customer_entities table and deprecated columns
-- ============================================================================
-- WARNING: Only run this AFTER verifying that:
-- 1. All data has been successfully migrated to customer_persons and customer_companies
-- 2. All APIs and UI have been updated to use the new structure
-- 3. You have a database backup
-- ============================================================================

-- Step 1: Verify migration (run these queries first to check)
-- SELECT COUNT(*) FROM customer_entities WHERE entity_type = 'person';
-- SELECT COUNT(*) FROM customer_persons;
-- SELECT COUNT(*) FROM customer_entities WHERE entity_type = 'company';
-- SELECT COUNT(*) FROM customer_companies;

-- Step 2: Drop foreign key constraints
DO $$ 
BEGIN
  -- Drop FK from customer_addresses
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_addresses_customer_entity_id_fkey'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.customer_addresses 
    DROP CONSTRAINT customer_addresses_customer_entity_id_fkey;
    RAISE NOTICE 'Dropped FK: customer_addresses_customer_entity_id_fkey';
  END IF;
  
  -- Drop FK from customer_bank_accounts
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_bank_accounts_customer_entity_id_fkey'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.customer_bank_accounts 
    DROP CONSTRAINT customer_bank_accounts_customer_entity_id_fkey;
    RAISE NOTICE 'Dropped FK: customer_bank_accounts_customer_entity_id_fkey';
  END IF;
  
  -- Drop FK from customer_entity_platform_mappings
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_entity_platform_mappings_customer_entity_id_fkey'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.customer_entity_platform_mappings 
    DROP CONSTRAINT customer_entity_platform_mappings_customer_entity_id_fkey;
    RAISE NOTICE 'Dropped FK: customer_entity_platform_mappings_customer_entity_id_fkey';
  END IF;
  
  -- Drop FK from customer_entity_platform_mappings for connection_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_entity_platform_mappings_connection_id_fkey'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.customer_entity_platform_mappings 
    DROP CONSTRAINT customer_entity_platform_mappings_connection_id_fkey;
    RAISE NOTICE 'Dropped FK: customer_entity_platform_mappings_connection_id_fkey';
  END IF;
  
  -- Drop FKs from customer_entities
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_customer_entities_default_billing_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.customer_entities 
    DROP CONSTRAINT fk_customer_entities_default_billing_address;
    RAISE NOTICE 'Dropped FK: fk_customer_entities_default_billing_address';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_customer_entities_default_shipping_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.customer_entities 
    DROP CONSTRAINT fk_customer_entities_default_shipping_address;
    RAISE NOTICE 'Dropped FK: fk_customer_entities_default_shipping_address';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_customer_entities_registered_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.customer_entities 
    DROP CONSTRAINT fk_customer_entities_registered_address;
    RAISE NOTICE 'Dropped FK: fk_customer_entities_registered_address';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_customer_entities_mailing_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.customer_entities 
    DROP CONSTRAINT fk_customer_entities_mailing_address;
    RAISE NOTICE 'Dropped FK: fk_customer_entities_mailing_address';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_entities_customer_group_id_fkey'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.customer_entities 
    DROP CONSTRAINT customer_entities_customer_group_id_fkey;
    RAISE NOTICE 'Dropped FK: customer_entities_customer_group_id_fkey';
  END IF;
END $$;

-- Step 3: Drop indexes on old tables
DROP INDEX IF EXISTS public.idx_customer_entities_type;
DROP INDEX IF EXISTS public.idx_customer_entities_source;
DROP INDEX IF EXISTS public.idx_customer_entities_email;
DROP INDEX IF EXISTS public.idx_customer_entities_name;
DROP INDEX IF EXISTS public.idx_customer_entities_customer_group;
DROP INDEX IF EXISTS public.idx_customer_entities_active;
DROP INDEX IF EXISTS public.idx_customer_entities_deleted_at;
DROP INDEX IF EXISTS public.customer_entities_email_unique_active;
DROP INDEX IF EXISTS public.customer_entities_name_unique_active;

DROP INDEX IF EXISTS public.idx_customer_entity_platform_mappings_entity_id;
DROP INDEX IF EXISTS public.idx_customer_entity_platform_mappings_connection_id;
DROP INDEX IF EXISTS public.idx_customer_entity_platform_mappings_platform_id;
DROP INDEX IF EXISTS public.idx_customer_entity_platform_mappings_synced_from;
DROP INDEX IF EXISTS public.idx_customer_entity_platform_mappings_synced_to;

-- Step 4: Drop triggers
DROP TRIGGER IF EXISTS update_customer_entities_updated_at ON public.customer_entities;
DROP TRIGGER IF EXISTS update_customer_entity_platform_mappings_updated_at ON public.customer_entity_platform_mappings;

-- Step 5: Drop RLS policies
DROP POLICY IF EXISTS "Customer entities are viewable by authenticated users" ON public.customer_entities;
DROP POLICY IF EXISTS "Customer entities are manageable by authenticated users" ON public.customer_entities;
DROP POLICY IF EXISTS "Customer entity platform mappings are viewable by authenticated users" ON public.customer_entity_platform_mappings;
DROP POLICY IF EXISTS "Customer entity platform mappings are manageable by authenticated users" ON public.customer_entity_platform_mappings;

-- Step 6: Drop deprecated columns
ALTER TABLE public.customer_addresses DROP COLUMN IF EXISTS customer_entity_id;
ALTER TABLE public.customer_bank_accounts DROP COLUMN IF EXISTS customer_entity_id;

-- Step 7: Drop old tables
DROP TABLE IF EXISTS public.customer_entity_platform_mappings CASCADE;
DROP TABLE IF EXISTS public.customer_entities CASCADE;

-- Step 8: Remove old pages from permissions (optional - keep if you want backward compatibility)
-- DELETE FROM public.user_permissions WHERE page_id IN (
--   SELECT id FROM public.pages WHERE path IN ('/customers', '/customers/new', '/customers/[id]')
-- );
-- DELETE FROM public.pages WHERE path IN ('/customers', '/customers/new', '/customers/[id]');

RAISE NOTICE 'Cleanup completed successfully!';
