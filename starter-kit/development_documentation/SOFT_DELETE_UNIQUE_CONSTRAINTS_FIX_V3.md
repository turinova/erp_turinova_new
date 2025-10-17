# Soft Delete Unique Constraints Fix V3

## Overview
This document describes the fix for unique constraint issues when implementing soft delete functionality across multiple tables (units, currencies, brands, customers, vat).

## Problem
When implementing soft delete functionality, the original unique constraints on the `name` column prevent creating new records with the same name as soft-deleted records. This creates a logical inconsistency where users cannot reuse names of deleted items.

## Solution
Replace standard unique constraints with partial unique indexes that only enforce uniqueness for active (non-soft-deleted) records.

## Affected Tables
- `brands` (fixed in V2)
- `customers` (fixed in V2) 
- `vat` (fixed in V2)
- `units` (fixed in V3)
- `currencies` (fixed in V3)

## Migration Script
```sql
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
```

## How It Works
1. **Dynamic Constraint Detection**: The script dynamically finds and drops existing unique constraints on the `name` column
2. **Partial Unique Indexes**: Creates new indexes that only apply to records where `deleted_at IS NULL`
3. **Soft Delete Compatibility**: Allows multiple soft-deleted records with the same name while preventing duplicate active records

## Testing
After applying the migration, test the following scenarios:

### Units Table
```bash
# 1. Create a unit
curl -X POST http://localhost:3000/api/units -H "Content-Type: application/json" -d '{"name":"Test Unit","shortform":"tu"}'

# 2. Soft delete the unit
curl -X DELETE http://localhost:3000/api/units/{unit_id}

# 3. Create another unit with the same name (should succeed)
curl -X POST http://localhost:3000/api/units -H "Content-Type: application/json" -d '{"name":"Test Unit","shortform":"tu"}'
```

### Currencies Table
```bash
# 1. Create a currency
curl -X POST http://localhost:3000/api/currencies -H "Content-Type: application/json" -d '{"name":"TEST","rate":1}'

# 2. Soft delete the currency
curl -X DELETE http://localhost:3000/api/currencies/{currency_id}

# 3. Create another currency with the same name (should succeed)
curl -X POST http://localhost:3000/api/currencies -H "Content-Type: application/json" -d '{"name":"TEST","rate":1}'
```

## Best Practices for Future Tables
When creating new tables with soft delete functionality:

1. **Don't create standard unique constraints** on name fields
2. **Use partial unique indexes** from the start:
   ```sql
   CREATE UNIQUE INDEX table_name_unique_active ON table_name (name) WHERE deleted_at IS NULL;
   ```
3. **Include soft delete columns** in initial table creation:
   ```sql
   CREATE TABLE example_table (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       name VARCHAR NOT NULL,
       deleted_at TIMESTAMPTZ DEFAULT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

## Rollback Procedure
If you need to rollback this change:

```sql
-- Drop partial unique indexes
DROP INDEX IF EXISTS units_name_unique_active;
DROP INDEX IF EXISTS currencies_name_unique_active;

-- Recreate standard unique constraints
ALTER TABLE units ADD CONSTRAINT units_name_unique UNIQUE (name);
ALTER TABLE currencies ADD CONSTRAINT currencies_name_unique UNIQUE (name);
```

## Files Modified
- `supabase/migrations/20250913063247_fix_soft_delete_unique_constraints_v3.sql`
- `development_documentation/fix_soft_delete_unique_constraints_v3.sql`

## Status
✅ **COMPLETED** - All tables now support proper soft delete functionality with reusable names.
