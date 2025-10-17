# Soft Delete Unique Constraints Fix

## Problem Description

When implementing soft delete functionality, we encountered a logical issue where:

1. **Soft delete a record** with a specific name (e.g., "Test Brand")
2. **Try to create a new record** with the same name
3. **Creation fails** with "Name already exists" error

This happened because the original unique constraints were preventing duplicate names even for soft-deleted records, which is not the desired behavior.

## Root Cause

The original unique constraints were applied to the entire table without considering the `deleted_at` column:

```sql
-- Original problematic constraint
ALTER TABLE brands ADD CONSTRAINT brands_name_unique UNIQUE (name);
```

This constraint prevented any duplicate names, even when records were soft-deleted.

## Solution

We implemented **partial unique indexes** that only apply to non-deleted records:

```sql
-- New solution: Partial unique index
CREATE UNIQUE INDEX brands_name_unique_active 
ON brands (name) 
WHERE deleted_at IS NULL;
```

## Implementation

### Migration Applied

**File**: `supabase/migrations/20250913061031_fix_soft_delete_unique_constraints_v2.sql`

**Tables Fixed**:
- `brands` table
- `customers` table  
- `vat` table

### Migration Process

1. **Drop existing unique constraints** using dynamic SQL to handle different constraint names
2. **Create partial unique indexes** that only apply to active (non-deleted) records

```sql
-- Example for brands table
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

-- Create partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS brands_name_unique_active 
ON brands (name) 
WHERE deleted_at IS NULL;
```

## Behavior After Fix

### ✅ Allowed Operations
- **Multiple soft-deleted records** with the same name
- **Create new record** with name of a soft-deleted record
- **Soft delete and recreate** the same record

### ❌ Prevented Operations  
- **Duplicate active records** with the same name
- **Create new record** when an active record with that name exists

## Testing Results

### Brands Table
```bash
# 1. Create brand
curl -X POST http://localhost:3000/api/brands \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Brand","comment":"Test comment"}'
# ✅ Success: Brand created

# 2. Soft delete brand
curl -X DELETE http://localhost:3000/api/brands/{id}
# ✅ Success: Brand soft deleted

# 3. Create new brand with same name
curl -X POST http://localhost:3000/api/brands \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Brand","comment":"New comment"}'
# ✅ Success: New brand created with same name
```

### VAT Table
```bash
# 1. Create VAT rate
curl -X POST http://localhost:3000/api/vat \
  -H "Content-Type: application/json" \
  -d '{"name":"ÁFA 5%","kulcs":5.0}'
# ✅ Success: VAT rate created

# 2. Soft delete VAT rate
curl -X DELETE http://localhost:3000/api/vat/{id}
# ✅ Success: VAT rate soft deleted

# 3. Create new VAT rate with same name
curl -X POST http://localhost:3000/api/vat \
  -H "Content-Type: application/json" \
  -d '{"name":"ÁFA 5%","kulcs":5.0}'
# ✅ Success: New VAT rate created with same name
```

## Benefits

1. **Logical Consistency**: Soft-deleted records don't prevent reuse of names
2. **Data Integrity**: Still prevents duplicate active records
3. **User Experience**: Users can recreate records with previously used names
4. **Audit Trail**: Soft-deleted records are preserved for historical purposes

## Future Considerations

When implementing soft delete for new tables, always use partial unique indexes:

```sql
-- Template for new tables with soft delete
CREATE UNIQUE INDEX {table_name}_name_unique_active 
ON {table_name} (name) 
WHERE deleted_at IS NULL;
```

This ensures consistent behavior across all tables with soft delete functionality.
