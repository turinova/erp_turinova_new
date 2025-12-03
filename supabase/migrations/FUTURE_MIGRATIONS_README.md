# Future Database Migrations

This folder contains migration files prefixed with `FUTURE_` that are **NOT YET APPLIED** to the production database.

## ⚠️ WARNING

**DO NOT run these migrations on production yet!**

These files are prepared for future implementation when it's safe to modify the production database schema.

---

## 📋 Migration Files

### 1. `FUTURE_20251203_add_in_po_status_to_shop_order_items.sql`

**Purpose:** Adds a new status `'in_po'` to the `shop_order_items` table.

**What it does:**
- Modifies the `shop_order_items_status_check` constraint to include `'in_po'`
- Updates the `update_shop_order_status()` trigger function to handle the new status
- Adds comprehensive comments explaining the status workflow

**Status workflow:**
```
open → in_po (added to draft PO) → ordered (PO confirmed) → arrived → handed_over
```

**Why we need this:**
- Currently, when items are added to a draft purchase order, they stay as `'open'`
- With `'in_po'` status, we can distinguish between:
  - Items that need to be added to a PO (`'open'`)
  - Items that are in a draft PO waiting for confirmation (`'in_po'`)
  - Items in confirmed POs (`'ordered'`)

---

### 2. `FUTURE_20251203_create_update_shop_items_on_po_confirm.sql`

**Purpose:** Auto-updates `shop_order_items` status when a purchase order is confirmed.

**What it does:**
- Creates a new trigger function `update_shop_order_items_on_po_confirm()`
- Creates a trigger on `purchase_orders` that fires when status changes to `'confirmed'`
- Automatically updates linked `shop_order_items` from `'in_po'` to `'ordered'`

**Why we need this:**
- Eliminates manual status updates after confirming a PO
- Maintains data consistency throughout the order lifecycle
- Provides full traceability from customer order → PO → shipment

---

## 🚀 How to Apply (When Ready)

### Prerequisites:
1. ✅ Backup the production database
2. ✅ Test migrations on a staging/development database
3. ✅ Verify no active transactions are modifying `shop_order_items`
4. ✅ Schedule maintenance window if needed

### Steps:

1. **Remove the `FUTURE_` prefix:**
   ```bash
   cd /Volumes/T7/erp_turinova_new/supabase/migrations
   mv FUTURE_20251203_add_in_po_status_to_shop_order_items.sql 20251203_add_in_po_status_to_shop_order_items.sql
   mv FUTURE_20251203_create_update_shop_items_on_po_confirm.sql 20251203_create_update_shop_items_on_po_confirm.sql
   ```

2. **Run migrations in order:**
   ```bash
   # Apply first migration (add status)
   psql -U your_user -d your_db -f 20251203_add_in_po_status_to_shop_order_items.sql
   
   # Apply second migration (add trigger)
   psql -U your_user -d your_db -f 20251203_create_update_shop_items_on_po_confirm.sql
   ```

   **OR** if using Supabase CLI:
   ```bash
   supabase db push
   ```

3. **Verify migrations:**
   ```sql
   -- Check constraint was updated
   SELECT conname, consrc 
   FROM pg_constraint 
   WHERE conrelid = 'shop_order_items'::regclass 
     AND conname = 'shop_order_items_status_check';
   
   -- Check trigger was created
   SELECT trigger_name, event_manipulation, action_statement
   FROM information_schema.triggers
   WHERE trigger_name = 'trigger_update_shop_items_on_po_confirm';
   ```

---

## 📊 Current vs Future Behavior

### **Current Behavior (Without migrations):**
1. User creates PO from shop order items → items stay `'open'`
2. User manually updates item status to `'ordered'` after PO is confirmed
3. No automatic link between PO confirmation and item status

### **Future Behavior (With migrations):**
1. User creates PO from shop order items → items change to `'in_po'`
2. User confirms PO → **trigger auto-updates** items to `'ordered'`
3. Full automation and traceability

---

## 🔗 Related Files

### Frontend:
- `/main-app/src/app/api/shop-order-items/create-purchase-order/route.ts`
  - Currently: Does NOT change status (keeps as `'open'`)
  - Future: Change status to `'in_po'` (uncomment line)

- `/main-app/src/app/(dashboard)/supplier-orders/CreatePurchaseOrderModal.tsx`
  - Modal for creating PO from shop order items
  - No changes needed

- `/main-app/src/app/(dashboard)/supplier-orders/SupplierOrdersClient.tsx`
  - Button to trigger PO creation
  - No changes needed

### Backend:
- `purchase_orders.source_type = 'customer_order'` is already set
- `purchase_order_items.shop_order_item_id` is already populated
- Full traceability is already in place!

---

## ✅ Benefits After Migration

1. **Better Status Tracking:**
   - See which items are in draft POs vs. confirmed POs
   - Identify items still waiting to be ordered

2. **Automation:**
   - No manual status updates needed after PO confirmation
   - Reduces human error

3. **Traceability:**
   - Full audit trail: customer order → shop item → PO → shipment
   - Easy reporting: "Which customer orders are in this PO?"

4. **Business Intelligence:**
   - Track time in each status
   - Identify bottlenecks in the ordering process
   - Measure supplier confirmation times

---

## 📝 Notes

- The feature works **WITHOUT** these migrations, but with limited status tracking
- Items will stay as `'open'` status when added to POs
- Manual status updates are still required
- These migrations add **automation and better visibility**

---

**Created:** December 3, 2024
**Status:** Ready for future deployment
**Risk Level:** Low (adds new status, doesn't remove existing ones)

