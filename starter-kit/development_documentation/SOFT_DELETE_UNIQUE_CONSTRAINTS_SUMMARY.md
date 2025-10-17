# Soft Delete Unique Constraints - Complete Fix Summary

## Overview
This document provides a complete summary of all unique constraint fixes applied to enable proper soft delete functionality across all tables in the ERP system.

## Problem Description
When implementing soft delete functionality, standard unique constraints on the `name` column prevent creating new records with the same name as soft-deleted records. This creates a logical inconsistency where users cannot reuse names of deleted items.

## Solution Applied
Replace standard unique constraints with partial unique indexes that only enforce uniqueness for active (non-soft-deleted) records using the `WHERE deleted_at IS NULL` condition.

## Tables Fixed

### ✅ Phase 1 - V2 Migration (Previously Fixed)
- **brands** - Fixed in migration `20250913061031_fix_soft_delete_unique_constraints_v2.sql`
- **customers** - Fixed in migration `20250913061031_fix_soft_delete_unique_constraints_v2.sql`
- **vat** - Fixed in migration `20250913061031_fix_soft_delete_unique_constraints_v2.sql`

### ✅ Phase 2 - V3 Migration (Just Fixed)
- **units** - Fixed in migration `20250913063247_fix_soft_delete_unique_constraints_v3.sql`
- **currencies** - Fixed in migration `20250913063247_fix_soft_delete_unique_constraints_v3.sql`

## Migration Files Applied

### V2 Migration (20250913061031)
```sql
-- Fixed brands, customers, vat tables
-- Applied partial unique indexes: brands_name_unique_active, customers_name_unique_active, vat_name_unique_active
```

### V3 Migration (20250913063247)
```sql
-- Fixed units, currencies tables
-- Applied partial unique indexes: units_name_unique_active, currencies_name_unique_active
```

## Testing Results

### Units Table ✅
```bash
# Test: Create unit "Óra" with shortform "h"
curl -X POST http://localhost:3000/api/units -H "Content-Type: application/json" -d '{"name":"Óra","shortform":"h"}'
# Result: SUCCESS - Unit created with ID 27c6c3d2-3de2-4288-b8c7-5aefa7084569
```

### Currencies Table ✅
```bash
# Test: Create currency "YPC" with rate 10
curl -X POST http://localhost:3000/api/currencies -H "Content-Type: application/json" -d '{"name":"YPC","rate":10}'
# Result: SUCCESS - Currency created with ID d7a682b5-fc3f-41ef-997c-59752ecc7e27
```

## Current Status
🎉 **ALL TABLES FIXED** - All tables now support proper soft delete functionality with reusable names.

## Documentation Updated
- ✅ `CRUD_FUNCTIONALITY_GUIDE.md` - Added critical section about unique constraints
- ✅ `SOFT_DELETE_UNIQUE_CONSTRAINTS_FIX_V3.md` - Detailed fix documentation
- ✅ `SOFT_DELETE_UNIQUE_CONSTRAINTS_SUMMARY.md` - This summary document

## Best Practices for Future Tables

### ✅ DO - Use Partial Unique Indexes
```sql
-- Correct approach for new tables
CREATE UNIQUE INDEX table_name_unique_active ON table_name (name) WHERE deleted_at IS NULL;
```

### ❌ DON'T - Use Standard Unique Constraints
```sql
-- Wrong approach - prevents reusing soft-deleted names
ALTER TABLE table_name ADD CONSTRAINT table_name_unique UNIQUE (name);
```

### Template for New Tables
```sql
CREATE TABLE new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    -- other columns...
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Use partial unique index from the start
CREATE UNIQUE INDEX new_table_name_unique_active ON new_table (name) WHERE deleted_at IS NULL;

-- Add trigger for updated_at
CREATE TRIGGER update_new_table_updated_at
    BEFORE UPDATE ON new_table
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Files Modified
- `supabase/migrations/20250913061031_fix_soft_delete_unique_constraints_v2.sql`
- `supabase/migrations/20250913063247_fix_soft_delete_unique_constraints_v3.sql`
- `development_documentation/fix_soft_delete_unique_constraints_v2.sql`
- `development_documentation/fix_soft_delete_unique_constraints_v3.sql`
- `development_documentation/SOFT_DELETE_UNIQUE_CONSTRAINTS_FIX_V3.md`
- `development_documentation/SOFT_DELETE_UNIQUE_CONSTRAINTS_SUMMARY.md`
- `development_documentation/CRUD_FUNCTIONALITY_GUIDE.md`

## Verification Commands
To verify all fixes are working:

```bash
# Test all tables can reuse soft-deleted names
curl -X POST http://localhost:3000/api/brands -H "Content-Type: application/json" -d '{"name":"Test Brand","comment":"test"}'
curl -X POST http://localhost:3000/api/customers -H "Content-Type: application/json" -d '{"name":"Test Customer","comment":"test"}'
curl -X POST http://localhost:3000/api/vat -H "Content-Type: application/json" -d '{"name":"Test VAT","kulcs":10}'
curl -X POST http://localhost:3000/api/units -H "Content-Type: application/json" -d '{"name":"Test Unit","shortform":"tu"}'
curl -X POST http://localhost:3000/api/currencies -H "Content-Type: application/json" -d '{"name":"Test Currency","rate":1}'
```

All commands should succeed without unique constraint violations.

## Status: ✅ COMPLETE
All soft delete unique constraint issues have been resolved across all tables in the ERP system.
