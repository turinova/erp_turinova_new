# Brands Soft Delete Migration Guide

## Overview
This guide explains how to implement soft delete functionality for the brands table, including the `deleted_at` and `updated_at` columns with automatic timestamp management.

## Migration Script

Run the following SQL script in your Supabase database:

```sql
-- Add deleted_at and updated_at columns to brands table
ALTER TABLE brands ADD COLUMN deleted_at timestamptz;
ALTER TABLE brands ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_brands_deleted_at ON brands(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for brands table to automatically update updated_at
CREATE TRIGGER update_brands_updated_at 
    BEFORE UPDATE ON brands 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## What This Migration Does

### 1. Adds `deleted_at` Column
- **Type**: `timestamptz` (nullable)
- **Purpose**: Marks records as soft-deleted when set to a timestamp
- **Usage**: Records with `deleted_at IS NULL` are considered active

### 2. Adds `updated_at` Column
- **Type**: `timestamptz` (not null, defaults to current timestamp)
- **Purpose**: Tracks when a record was last modified
- **Usage**: Automatically updated on every UPDATE operation

### 3. Creates Performance Index
- **Index**: `ix_brands_deleted_at`
- **Purpose**: Optimizes queries that filter out soft-deleted records
- **Condition**: Only indexes records where `deleted_at IS NULL`

### 4. Sets Up Automatic Timestamp Management
- **Trigger Function**: `update_updated_at_column()`
- **Trigger**: `update_brands_updated_at`
- **Behavior**: Automatically sets `updated_at` to current timestamp on every UPDATE

## API Behavior After Migration

### GET /api/brands
- **Before Migration**: Returns all brands
- **After Migration**: Returns only active brands (`deleted_at IS NULL`)
- **Response**: Includes `updated_at` field

### DELETE /api/brands/{id}
- **Before Migration**: Hard delete (fails due to foreign key constraints)
- **After Migration**: Soft delete (sets `deleted_at` timestamp)

## Database Schema After Migration

```sql
CREATE TABLE brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  comment     text,                    -- Added separately
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),  -- NEW
  deleted_at  timestamptz                              -- NEW
);
```

## Benefits

1. **Data Preservation**: Records are never actually deleted
2. **Audit Trail**: Can track when records were "deleted"
3. **Recovery**: Soft-deleted records can be restored
4. **Foreign Key Safety**: Maintains referential integrity
5. **Performance**: Indexed queries for active records
6. **Automatic Timestamps**: No manual timestamp management needed

## Usage Examples

### Soft Delete a Brand
```sql
UPDATE brands 
SET deleted_at = now() 
WHERE id = 'brand-uuid';
```

### Restore a Soft-Deleted Brand
```sql
UPDATE brands 
SET deleted_at = NULL 
WHERE id = 'brand-uuid';
```

### Query Only Active Brands
```sql
SELECT * FROM brands 
WHERE deleted_at IS NULL;
```

### Query All Brands (Including Soft-Deleted)
```sql
SELECT * FROM brands;
```

## Testing the Migration

1. **Run the migration script** in Supabase
2. **Test the API endpoints**:
   - `GET /api/brands` - Should return brands with `updated_at` field
   - `DELETE /api/brands/{id}` - Should soft delete (set `deleted_at`)
3. **Verify soft delete works**:
   - Delete a brand via API
   - Check that it disappears from the list
   - Verify it still exists in database with `deleted_at` set

## Rollback (If Needed)

To remove soft delete functionality:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;

-- Remove trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Remove index
DROP INDEX IF EXISTS ix_brands_deleted_at;

-- Remove columns
ALTER TABLE brands DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE brands DROP COLUMN IF EXISTS updated_at;
```

## Related Files

- **Migration Script**: `add_deleted_at_to_brands.sql`
- **API Routes**: 
  - `src/app/api/brands/route.ts`
  - `src/app/api/brands/[id]/route.ts`
- **Frontend Page**: `src/app/(dashboard)/gyartok/page.tsx`

---

**Last Updated**: December 2024  
**Project**: ERP Turinova  
**Status**: Ready for Implementation
