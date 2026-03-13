-- Cleanup script: Drop old customer_entities table and related deprecated columns
-- WARNING: Only run this after verifying data migration was successful!

-- Drop foreign key constraints first
DO $$ 
BEGIN
  -- Drop FK from customer_addresses
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_addresses_customer_entity_id_fkey'
  ) THEN
    ALTER TABLE public.customer_addresses 
    DROP CONSTRAINT customer_addresses_customer_entity_id_fkey;
  END IF;
  
  -- Drop FK from customer_bank_accounts
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_bank_accounts_customer_entity_id_fkey'
  ) THEN
    ALTER TABLE public.customer_bank_accounts 
    DROP CONSTRAINT customer_bank_accounts_customer_entity_id_fkey;
  END IF;
  
  -- Drop FK from customer_entity_platform_mappings
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_entity_platform_mappings_customer_entity_id_fkey'
  ) THEN
    ALTER TABLE public.customer_entity_platform_mappings 
    DROP CONSTRAINT customer_entity_platform_mappings_customer_entity_id_fkey;
  END IF;
END $$;

-- Drop deprecated columns (after migration is verified)
-- Uncomment these after verifying the migration worked correctly:

-- ALTER TABLE public.customer_addresses DROP COLUMN IF EXISTS customer_entity_id;
-- ALTER TABLE public.customer_bank_accounts DROP COLUMN IF EXISTS customer_entity_id;

-- Drop old tables (after migration is verified)
-- Uncomment these after verifying the migration worked correctly:

-- DROP TABLE IF EXISTS public.customer_entity_platform_mappings CASCADE;
-- DROP TABLE IF EXISTS public.customer_entities CASCADE;

-- Note: Keep customer_address_platform_mappings as is (it references customer_addresses, not customer_entities)
