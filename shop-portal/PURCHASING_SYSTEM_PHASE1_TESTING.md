# Purchasing System - Phase 1 Testing Guide

## ✅ Phase 1 Complete: Database Migrations

All database migrations have been created and added to the tenant database template.

## 📋 Migration Files Created

1. `20250323_create_product_suppliers_table.sql` - Product-supplier relationships
2. `20250323_add_internal_barcode_to_products.sql` - Internal barcode support
3. `20250323_create_purchase_orders_table.sql` - Purchase orders table
4. `20250323_create_purchase_order_items_table.sql` - PO items table
5. `20250323_create_shipments_table.sql` - Shipments table
6. `20250323_create_shipment_purchase_orders_table.sql` - Shipment-PO relationships
7. `20250323_create_shipment_items_table.sql` - Shipment items (supports unexpected products)
8. `20250323_create_warehouse_operations_table.sql` - Warehouse operations
9. `20250323_create_stock_movements_table.sql` - Stock movements (immutable audit trail)
10. `20250323_create_stock_summary_view.sql` - Stock summary materialized view
11. `20250323_add_purchasing_pages_to_permissions.sql` - Permissions setup

## 🧪 Testing Instructions

### Step 1: Run Migrations Manually

Run each migration file in order in your Supabase SQL Editor:

1. Open Supabase Dashboard → SQL Editor
2. Run each migration file in this order:
   - `20250323_create_warehouses_table.sql` ⚠️ **MUST RUN FIRST** (if warehouses table doesn't exist)
   - `20250323_create_product_suppliers_table.sql`
   - `20250323_add_internal_barcode_to_products.sql`
   - `20250323_create_purchase_orders_table.sql`
   - `20250323_create_purchase_order_items_table.sql`
   - `20250323_create_shipments_table.sql`
   - `20250323_create_shipment_purchase_orders_table.sql`
   - `20250323_create_shipment_items_table.sql`
   - `20250323_create_warehouse_operations_table.sql`
   - `20250323_create_stock_movements_table.sql`
   - `20250323_create_stock_summary_view.sql`
   - `20250323_add_purchasing_pages_to_permissions.sql`

**Important:** If the `warehouses` table already exists in your database, you can skip `20250323_create_warehouses_table.sql`. Check first with:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'warehouses'
);
```

### Step 2: Verify Tables Created

Run this query to verify all tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'warehouses',
    'product_suppliers',
    'purchase_orders',
    'purchase_order_items',
    'shipments',
    'shipment_purchase_orders',
    'shipment_items',
    'warehouse_operations',
    'stock_movements',
    'stock_summary'
  )
ORDER BY table_name;
```

Expected: 10 tables (stock_summary is a view, not a table)

### Step 3: Verify Sequences Created

```sql
SELECT sequence_name 
FROM information_schema.sequences 
WHERE sequence_schema = 'public' 
  AND sequence_name IN (
    'purchase_order_number_seq',
    'shipment_number_seq',
    'warehouse_operation_number_seq'
  )
ORDER BY sequence_name;
```

Expected: 3 sequences

### Step 4: Test PO Number Generation

```sql
SELECT generate_purchase_order_number();
```

Expected: Format like `POR-2026-000001`

### Step 5: Test Shipment Number Generation

```sql
SELECT generate_shipment_number();
```

Expected: Format like `SHP-2026-0000001`

### Step 6: Test Warehouse Operation Number Generation

```sql
SELECT generate_warehouse_operation_number();
```

Expected: Format like `WOP-2026-0000002`

### Step 7: Verify Internal Barcode Column

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'shoprenter_products' 
  AND column_name = 'internal_barcode';
```

Expected: Column exists with type `character varying`

### Step 8: Verify Permissions Pages Added

```sql
SELECT path, name, category 
FROM pages 
WHERE category = 'Beszerzés' 
ORDER BY path;
```

Expected: 6 pages:
- `/purchase-orders`
- `/purchase-orders/new`
- `/purchase-orders/[id]`
- `/shipments`
- `/shipments/[id]/receiving`
- `/stock`

**Note:** Product-supplier relationships will be managed on the product edit page under a new "Beszállítók" tab (not a separate page).

### Step 9: Test RLS Policies

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'product_suppliers',
    'purchase_orders',
    'purchase_order_items',
    'shipments',
    'shipment_purchase_orders',
    'shipment_items',
    'warehouse_operations',
    'stock_movements'
  )
ORDER BY tablename;
```

Expected: All tables have `rowsecurity = true`

### Step 10: Test Stock Summary View

```sql
-- Refresh the view (will be empty initially)
SELECT refresh_stock_summary();

-- Check if view exists
SELECT * FROM stock_summary LIMIT 1;
```

Expected: View exists and can be queried (may be empty)

## ✅ Success Criteria

- [ ] All 9 tables created successfully
- [ ] All 3 sequences created successfully
- [ ] All 3 number generation functions work
- [ ] `internal_barcode` column added to `shoprenter_products`
- [ ] All 7 permission pages added
- [ ] RLS enabled on all tables
- [ ] Stock summary view created and refreshable
- [ ] No SQL errors during migration execution

## 🐛 Common Issues

**Issue:** `ERROR: function update_updated_at_column() does not exist`
- **Solution:** This function should already exist in your database. If not, check the tenant template for the function definition.

**Issue:** `ERROR: relation "warehouses" does not exist`
- **Solution:** The `warehouses` table should exist from previous migrations. Check if it exists in your database.

**Issue:** `ERROR: relation "suppliers" does not exist`
- **Solution:** The `suppliers` table was created in previous migrations. Ensure all supplier-related migrations have been run.

## 📝 Next Steps After Testing

Once Phase 1 testing is complete and verified:
1. Proceed to Phase 2: API endpoints
2. Then Phase 3: UI components

## 📞 Support

If you encounter any errors during testing, note:
- The exact error message
- Which migration file caused it
- Your database schema version
