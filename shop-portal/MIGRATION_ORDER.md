# 📋 Purchasing System - Migration Order

## ⚠️ IMPORTANT: Run migrations in this exact order!

PostgreSQL foreign key constraints require dependencies to exist before they can be referenced.

---

## ✅ Correct Migration Order

### Step 1: Prerequisites (if not already created)
Check if these tables exist first:
```sql
-- Check if warehouses exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'warehouses'
);
```

If `warehouses` doesn't exist, run:
1. **`20250323_create_warehouses_table.sql`** ⚠️ **MUST RUN FIRST**

---

### Step 2: Core Tables (in order)

2. **`20250323_create_product_suppliers_table.sql`**
   - Depends on: `shoprenter_products`, `suppliers`

3. **`20250323_add_internal_barcode_to_products.sql`**
   - Depends on: `shoprenter_products`

4. **`20250323_create_purchase_orders_table.sql`**
   - Depends on: `suppliers`, `warehouses`, `currencies`, `users`

5. **`20250323_create_purchase_order_items_table.sql`**
   - Depends on: `purchase_orders`, `shoprenter_products`, `product_suppliers`, `vat`, `currencies`, `units`

6. **`20250323_create_shipments_table.sql`**
   - Depends on: `suppliers`, `warehouses`, `currencies`

7. **`20250323_create_shipment_purchase_orders_table.sql`**
   - Depends on: `shipments`, `purchase_orders`

8. **`20250323_create_shipment_items_table.sql`**
   - Depends on: `shipments`, `purchase_order_items`, `shoprenter_products`, `vat`, `currencies`

9. **`20250323_create_warehouse_operations_table.sql`**
   - Depends on: `shipments`, `warehouses`, `users`

10. **`20250323_create_stock_movements_table.sql`**
    - Depends on: `warehouses`, `shoprenter_products`, `warehouse_operations`, `users`

11. **`20250323_create_stock_summary_view.sql`**
    - Depends on: `stock_movements`, `warehouses`, `shoprenter_products`

---

### Step 3: Permissions & Navigation

12. **`20250323_add_purchasing_pages_to_permissions.sql`**
    - Depends on: `pages` table (from permission system)

---

## 🚀 Quick Copy-Paste Order

Run these in Supabase SQL Editor in this exact order:

```sql
-- 1. Warehouses (if not exists)
-- 20250323_create_warehouses_table.sql

-- 2. Product-Supplier relationships
-- 20250323_create_product_suppliers_table.sql

-- 3. Internal barcode
-- 20250323_add_internal_barcode_to_products.sql

-- 4. Purchase Orders
-- 20250323_create_purchase_orders_table.sql

-- 5. Purchase Order Items
-- 20250323_create_purchase_order_items_table.sql

-- 6. Shipments
-- 20250323_create_shipments_table.sql

-- 7. Shipment-PO links
-- 20250323_create_shipment_purchase_orders_table.sql

-- 8. Shipment Items
-- 20250323_create_shipment_items_table.sql

-- 9. Warehouse Operations
-- 20250323_create_warehouse_operations_table.sql

-- 10. Stock Movements
-- 20250323_create_stock_movements_table.sql

-- 11. Stock Summary View
-- 20250323_create_stock_summary_view.sql

-- 12. Permissions
-- 20250323_add_purchasing_pages_to_permissions.sql
```

---

## ✅ Verification

After running all migrations, verify with:

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

Expected: **10 tables** (stock_summary is a view, not a table)

---

## ❌ Common Errors

### Error: "relation X does not exist"
- **Cause**: Running migrations out of order
- **Fix**: Check the dependency order above and run prerequisites first

### Error: "syntax error at or near IF NOT EXISTS"
- **Cause**: PostgreSQL doesn't support `ADD CONSTRAINT IF NOT EXISTS`
- **Fix**: Already fixed in the migration files

### Error: "duplicate key value violates unique constraint"
- **Cause**: Migration already partially ran
- **Fix**: Drop the table and re-run, or check what's already created

---

## 📝 Notes

- All migrations use `CREATE TABLE IF NOT EXISTS` so they're safe to re-run
- Foreign keys use `ON DELETE RESTRICT` or `ON DELETE CASCADE` appropriately
- RLS (Row Level Security) is enabled on all tables
- All tables have `updated_at` triggers
