# Customers Soft Delete Migration Guide

## Overview
This guide documents the implementation of soft delete functionality for the customers table, including the `deleted_at` and `updated_at` columns with automatic timestamp management.

## Migration Applied

The following migration was successfully applied to the customers table:

**Migration File**: `supabase/migrations/20250913054735_add_soft_delete_to_customers.sql`

```sql
-- Add deleted_at and updated_at columns to customers table
ALTER TABLE customers ADD COLUMN deleted_at timestamptz;
ALTER TABLE customers ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_customers_deleted_at ON customers(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for customers table to automatically update updated_at
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
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
- **Usage**: Automatically updated on every UPDATE operation via database trigger

### 3. Creates Performance Index
- **Index**: `ix_customers_deleted_at`
- **Purpose**: Optimizes queries that filter out soft-deleted records
- **Condition**: Only indexes records where `deleted_at IS NULL`

### 4. Sets Up Automatic Timestamp Management
- **Uses Existing Trigger Function**: `update_updated_at_column()` (created for brands)
- **Trigger**: `update_customers_updated_at`
- **Behavior**: Automatically sets `updated_at` to current timestamp on every UPDATE

## API Behavior After Migration

### GET /api/customers
- **Before Migration**: Returns all customers
- **After Migration**: Returns only active customers (`deleted_at IS NULL`)
- **Response**: Includes `updated_at` field

### PUT /api/customers/{id}
- **Before Migration**: Updates customer data
- **After Migration**: Updates customer data and automatically sets `updated_at` timestamp

### DELETE /api/customers/{id}
- **Before Migration**: Hard delete (removes record from database)
- **After Migration**: Soft delete (sets `deleted_at` timestamp)

## Database Schema After Migration

```sql
CREATE TABLE customers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text NOT NULL,
  email                     text UNIQUE NOT NULL,
  mobile                    text,
  discount_percent          numeric(5,2) DEFAULT 0,
  billing_name              text,
  billing_country           text DEFAULT 'Magyarország',
  billing_city              text,
  billing_postal_code       text,
  billing_street            text,
  billing_house_number      text,
  billing_tax_number        text,
  billing_company_reg_number text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),  -- NEW
  deleted_at                timestamptz                              -- NEW
);
```

## Benefits

1. **Data Preservation**: Customer records are never actually deleted
2. **Audit Trail**: Can track when customers were "deleted"
3. **Recovery**: Soft-deleted customers can be restored
4. **Referential Integrity**: Maintains relationships with orders, invoices, etc.
5. **Performance**: Indexed queries for active customers
6. **Automatic Timestamps**: No manual timestamp management needed

## Usage Examples

### Soft Delete a Customer
```sql
UPDATE customers 
SET deleted_at = now() 
WHERE id = 'customer-uuid';
```

### Restore a Soft-Deleted Customer
```sql
UPDATE customers 
SET deleted_at = NULL 
WHERE id = 'customer-uuid';
```

### Query Only Active Customers
```sql
SELECT * FROM customers 
WHERE deleted_at IS NULL;
```

### Query All Customers (Including Soft-Deleted)
```sql
SELECT * FROM customers;
```

## Testing Results

✅ **Migration Applied Successfully**: Database schema updated with new columns

✅ **API Response Updated**: GET /api/customers now includes `updated_at` field

✅ **Soft Delete Working**: DELETE /api/customers/{id} successfully soft-deletes records

✅ **Filtering Working**: Soft-deleted customers are hidden from API responses

✅ **Data Preservation**: Soft-deleted customers remain in database with `deleted_at` timestamp

## API Response Example

**Before Migration**:
```json
{
  "id": "fcee2e83-beb7-4bc0-b2d1-05b76f1bf681",
  "name": "Kovács Péter",
  "email": "peter.kovacs@example.com",
  "mobile": "+36 30 999 2800",
  "discount_percent": 10,
  "billing_name": "Kovács Kft.",
  "billing_country": "Hungary",
  "billing_city": "Kecskemét",
  "billing_postal_code": "6000",
  "billing_street": "Mindszenti krt.",
  "billing_house_number": "10",
  "billing_tax_number": "12345678-1-02",
  "billing_company_reg_number": "01-09-999999",
  "created_at": "2025-09-10T10:42:13.464005+00:00"
}
```

**After Migration**:
```json
{
  "id": "fcee2e83-beb7-4bc0-b2d1-05b76f1bf681",
  "name": "Kovács Péter",
  "email": "peter.kovacs@example.com",
  "mobile": "+36 30 999 2800",
  "discount_percent": 10,
  "billing_name": "Kovács Kft.",
  "billing_country": "Hungary",
  "billing_city": "Kecskemét",
  "billing_postal_code": "6000",
  "billing_street": "Mindszenti krt.",
  "billing_house_number": "10",
  "billing_tax_number": "12345678-1-02",
  "billing_company_reg_number": "01-09-999999",
  "created_at": "2025-09-10T10:42:13.464005+00:00",
  "updated_at": "2025-09-13T05:47:43.955867+00:00"
}
```

## Related Files

- **Migration Script**: `supabase/migrations/20250913054735_add_soft_delete_to_customers.sql`
- **API Routes**: 
  - `src/app/api/customers/route.ts`
  - `src/app/api/customers/[id]/route.ts`
- **Frontend Page**: `src/app/(dashboard)/customers/page.tsx`

## Rollback (If Needed)

To remove soft delete functionality from customers:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;

-- Remove index
DROP INDEX IF EXISTS ix_customers_deleted_at;

-- Remove columns
ALTER TABLE customers DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE customers DROP COLUMN IF EXISTS updated_at;
```

---

**Last Updated**: December 2024  
**Project**: ERP Turinova  
**Status**: Successfully Implemented and Tested
