# Customer Management Migration Summary

## Overview
Migrated from unified `customer_entities` table to separate `customer_persons` and `customer_companies` tables with relationship linking, following CloudERP's approach.

## Completed ✅

### 1. Database Migrations
- ✅ Created `customer_persons` table
- ✅ Created `customer_companies` table  
- ✅ Created `customer_person_company_relationships` table (many-to-many)
- ✅ Updated `customer_addresses` to support `person_id` and `company_id`
- ✅ Updated `customer_bank_accounts` to support `person_id` and `company_id`
- ✅ Created new `customer_platform_mappings` table (replaces `customer_entity_platform_mappings`)
- ✅ Added foreign key constraints
- ✅ Created data migration script (`20250326_migrate_customer_entities_to_persons_companies.sql`)
- ✅ Created cleanup script (`CLEANUP_OLD_CUSTOMER_TABLES.sql`)

### 2. Tenant Template
- ✅ Updated `tenant-database-template.sql` with new structure
- ✅ Added new pages to permissions system:
  - `/customers/persons`
  - `/customers/persons/new`
  - `/customers/persons/[id]`
  - `/customers/companies`
  - `/customers/companies/new`
  - `/customers/companies/[id]`

## Pending ⏳

### 3. API Endpoints (Need to be updated)
- ⏳ `/api/customers/route.ts` - List/create customers
- ⏳ `/api/customers/[id]/route.ts` - Get/update/delete customer
- ⏳ `/api/customers/[id]/addresses/route.ts` - Address management
- ⏳ `/api/customers/[id]/bank-accounts/route.ts` - Bank account management
- ⏳ `/api/customers/[id]/sync/route.ts` - Sync to webshop
- ⏳ `/api/connections/[id]/sync-customers/route.ts` - Sync from webshop

### 4. UI Components (Need to be updated)
- ⏳ `/customers/page.tsx` - Main customers list (split into persons/companies)
- ⏳ `/customers/CustomersTable.tsx` - Table component
- ⏳ `/customers/new/CustomerNewForm.tsx` - New customer form
- ⏳ `/customers/[id]/CustomerEditForm.tsx` - Edit customer form
- ⏳ `/customers/[id]/page.tsx` - Customer detail page
- ⏳ `CustomerAddressesCard.tsx` - Address management
- ⏳ `CustomerBankAccountsCard.tsx` - Bank account management

### 5. Sync Logic (Need to be updated)
- ⏳ ShopRenter customer sync (PULL)
- ⏳ ShopRenter customer sync (PUSH)
- ⏳ Platform mapping logic

### 6. Navigation Menu
- ⏳ Update vertical menu to show "Személyek" and "Cégek" instead of unified "Vevők"

## Migration Steps

### Step 1: Run Migrations
```bash
# Run these migrations in order:
1. 20250326_create_customer_persons_table.sql
2. 20250326_create_customer_companies_table.sql
3. 20250326_create_customer_person_company_relationships_table.sql
4. 20250326_update_customer_addresses_for_persons_companies.sql
5. 20250326_update_customer_bank_accounts_for_persons_companies.sql
6. 20250326_update_customer_platform_mappings_for_persons_companies.sql
7. 20250326_migrate_customer_entities_to_persons_companies.sql
8. 20250326_add_foreign_keys_for_persons_companies.sql
9. 20250326_add_customer_persons_companies_pages_to_permissions.sql
```

### Step 2: Verify Migration
```sql
-- Check counts match
SELECT COUNT(*) FROM customer_entities WHERE entity_type = 'person';
SELECT COUNT(*) FROM customer_persons;

SELECT COUNT(*) FROM customer_entities WHERE entity_type = 'company';
SELECT COUNT(*) FROM customer_companies;
```

### Step 3: Update APIs and UI
- Update all API endpoints to use new tables
- Update all UI components
- Update sync logic

### Step 4: Cleanup (After verification)
```sql
-- Run CLEANUP_OLD_CUSTOMER_TABLES.sql
-- This will drop:
-- - customer_entities table
-- - customer_entity_platform_mappings table
-- - Deprecated columns (customer_entity_id from addresses/bank_accounts)
```

## Cleanup SQL File
Location: `shop-portal/supabase/migrations/CLEANUP_OLD_CUSTOMER_TABLES.sql`

**⚠️ WARNING**: Only run cleanup after:
1. All data has been successfully migrated
2. All APIs and UI have been updated
3. You have a database backup
4. You've verified the migration worked correctly

## New Structure Benefits

1. **Real-world relationships**: Persons can be linked to multiple companies
2. **No data duplication**: Person data stored once, linked to multiple companies
3. **B2B support**: Companies can have multiple contact persons
4. **Flexible roles**: Owner, contact person, manager, etc.
5. **Better webshop sync**: Clear separation between person and company data

## Next Steps

1. Update API endpoints to use new tables
2. Create separate UI for persons and companies
3. Add relationship management UI
4. Update sync logic
5. Test thoroughly
6. Run cleanup script
