-- Fix unique constraints for soft delete tables
-- This ensures that even soft-deleted records prevent duplicate names

-- 1. Fix brands table unique constraint
-- Drop the existing unique constraint
ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_name_unique;

-- Create a partial unique index that only applies to non-deleted records
-- This allows multiple soft-deleted records with the same name, but prevents active duplicates
CREATE UNIQUE INDEX IF NOT EXISTS brands_name_unique_active 
ON brands (name) 
WHERE deleted_at IS NULL;

-- 2. Fix customers table unique constraint
-- Drop the existing unique constraint
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_name_unique;

-- Create a partial unique index for customers
CREATE UNIQUE INDEX IF NOT EXISTS customers_name_unique_active 
ON customers (name) 
WHERE deleted_at IS NULL;

-- 3. Fix VAT table unique constraint
-- Drop the existing unique constraint
ALTER TABLE vat DROP CONSTRAINT IF EXISTS vat_name_unique;

-- Create a partial unique index for VAT
CREATE UNIQUE INDEX IF NOT EXISTS vat_name_unique_active 
ON vat (name) 
WHERE deleted_at IS NULL;

-- Note: This approach allows:
-- - Multiple soft-deleted records with the same name
-- - Only one active (non-deleted) record with each name
-- - Prevents creating new records with names that are already active
