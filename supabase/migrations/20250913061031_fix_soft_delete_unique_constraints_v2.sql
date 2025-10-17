-- Fix unique constraints for soft delete tables - Version 2
-- This ensures that even soft-deleted records prevent duplicate names

-- 1. Fix brands table unique constraint
-- First, let's see what constraints exist and drop them properly
DO $$ 
BEGIN
    -- Drop any existing unique constraints on brands.name
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name LIKE '%brands%name%' 
               AND table_name = 'brands' 
               AND constraint_type = 'UNIQUE') THEN
        EXECUTE 'ALTER TABLE brands DROP CONSTRAINT ' || 
                (SELECT constraint_name FROM information_schema.table_constraints 
                 WHERE constraint_name LIKE '%brands%name%' 
                 AND table_name = 'brands' 
                 AND constraint_type = 'UNIQUE' LIMIT 1);
    END IF;
END $$;

-- Create a partial unique index that only applies to non-deleted records
CREATE UNIQUE INDEX IF NOT EXISTS brands_name_unique_active 
ON brands (name) 
WHERE deleted_at IS NULL;

-- 2. Fix customers table unique constraint
DO $$ 
BEGIN
    -- Drop any existing unique constraints on customers.name
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name LIKE '%customers%name%' 
               AND table_name = 'customers' 
               AND constraint_type = 'UNIQUE') THEN
        EXECUTE 'ALTER TABLE customers DROP CONSTRAINT ' || 
                (SELECT constraint_name FROM information_schema.table_constraints 
                 WHERE constraint_name LIKE '%customers%name%' 
                 AND table_name = 'customers' 
                 AND constraint_type = 'UNIQUE' LIMIT 1);
    END IF;
END $$;

-- Create a partial unique index for customers
CREATE UNIQUE INDEX IF NOT EXISTS customers_name_unique_active 
ON customers (name) 
WHERE deleted_at IS NULL;

-- 3. Fix VAT table unique constraint
DO $$ 
BEGIN
    -- Drop any existing unique constraints on vat.name
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name LIKE '%vat%name%' 
               AND table_name = 'vat' 
               AND constraint_type = 'UNIQUE') THEN
        EXECUTE 'ALTER TABLE vat DROP CONSTRAINT ' || 
                (SELECT constraint_name FROM information_schema.table_constraints 
                 WHERE constraint_name LIKE '%vat%name%' 
                 AND table_name = 'vat' 
                 AND constraint_type = 'UNIQUE' LIMIT 1);
    END IF;
END $$;

-- Create a partial unique index for VAT
CREATE UNIQUE INDEX IF NOT EXISTS vat_name_unique_active 
ON vat (name) 
WHERE deleted_at IS NULL;

-- Note: This approach allows:
-- - Multiple soft-deleted records with the same name
-- - Only one active (non-deleted) record with each name
-- - Prevents creating new records with names that are already active
