-- Fix unique constraints for units and currencies tables to allow soft-deleted records
-- This script drops existing unique constraints and creates partial unique indexes

-- Drop existing unique constraints if they exist, using a more robust check
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- For units table
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'units'::regclass AND contype = 'u' AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'units'::regclass AND attname = 'name');
    IF FOUND THEN
        EXECUTE 'ALTER TABLE units DROP CONSTRAINT ' || constraint_name;
    END IF;

    -- For currencies table
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'currencies'::regclass AND contype = 'u' AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'currencies'::regclass AND attname = 'name');
    IF FOUND THEN
        EXECUTE 'ALTER TABLE currencies DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Create partial unique indexes for active records (deleted_at IS NULL)
-- These will only enforce uniqueness for records that are not soft-deleted.
CREATE UNIQUE INDEX IF NOT EXISTS units_name_unique_active ON units (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS currencies_name_unique_active ON currencies (name) WHERE deleted_at IS NULL;
