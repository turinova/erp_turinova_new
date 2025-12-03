# Shop Order Items → Purchase Order Conversion Feature

## 📋 Overview

This feature allows users to create Purchase Orders (POs) directly from Shop Order Items on the **Supplier Orders** page (`/supplier-orders`).

**Business Flow:**
1. Customer orders items (some may be free-typed, not in accessories database)
2. Items appear on `/supplier-orders` page grouped by supplier
3. User selects items from **SAME supplier**
4. Clicks "PO Létrehozása" button
5. Modal opens to resolve any free-typed items
6. PO is created with full traceability

---

## 🎯 Key Features

### ✅ **Implemented (December 3, 2024):**

1. **Smart Item Selection:**
   - Button only appears when items from SAME `partner_id` are selected
   - Shows selected count and partner name
   - Disabled with tooltip if items from multiple partners selected

2. **Duplicate Prevention:**
   - Checks if any selected item is already linked to existing PO
   - Shows error with PO number if duplicate found
   - Prevents accidental double-ordering

3. **Free-Typed Item Resolution:**
   - Categorizes items into "Ready" (with FK) and "Pending" (free-typed)
   - For pending items, provides inline actions:
     - **Link:** Search and link to existing accessory
     - **Create New:** Inline fields (Name + **required SKU**)
     - **Skip:** Don't include in this PO
   - Validates SKU uniqueness before creating new accessories

4. **Full Traceability:**
   - Sets `purchase_orders.source_type = 'customer_order'`
   - Populates `purchase_order_items.shop_order_item_id`
   - Can trace: Customer → Shop Order → Shop Order Item → PO Item → PO → Shipment

5. **Auto-Approval of Product Suggestions:**
   - When free-typed item is linked/created, updates `product_suggestions` table
   - Sets `status = 'approved'` and `accessory_id`
   - Prevents duplicate suggestions in the future

---

## 📁 Files Created/Modified

### **New Files:**

1. **`main-app/src/app/api/shop-order-items/create-purchase-order/route.ts`**
   - API endpoint for PO creation
   - Handles duplicate prevention, validation, and creation
   - Links shop_order_items to PO items

2. **`main-app/src/app/(dashboard)/supplier-orders/CreatePurchaseOrderModal.tsx`**
   - Modal UI for PO creation
   - Inline fields for creating new accessories
   - Autocomplete for linking existing accessories

3. **`supabase/migrations/FUTURE_20251203_add_in_po_status_to_shop_order_items.sql`**
   - Future migration: Adds `'in_po'` status
   - **NOT applied yet** (production database)

4. **`supabase/migrations/FUTURE_20251203_create_update_shop_items_on_po_confirm.sql`**
   - Future migration: Auto-updates status when PO confirmed
   - **NOT applied yet** (production database)

5. **`supabase/migrations/FUTURE_MIGRATIONS_README.md`**
   - Documentation for future migrations
   - Instructions for applying when ready

6. **`SHOP_ORDER_TO_PO_FEATURE.md`** (this file)
   - Complete feature documentation

### **Modified Files:**

1. **`main-app/src/app/(dashboard)/supplier-orders/SupplierOrdersClient.tsx`**
   - Added "PO Létrehozása" button
   - Added logic to check if PO can be created
   - Integrated modal component

---

## 🔄 Current Workflow (Without Future Migrations)

### **Step 1: User Creates Shop Order**
- Customer orders items (some free-typed, some from database)
- Items saved to `shop_order_items` with status `'open'`
- Free-typed items create entries in `product_suggestions` (status: `'pending'`)

### **Step 2: User Selects Items on Supplier Orders Page**
- Navigate to `/supplier-orders`
- Filter by status (open, ordered, arrived, etc.)
- Select items from **SAME supplier** using checkboxes
- Button appears: "PO Létrehozása (5)" with partner name in tooltip

### **Step 3: Modal Opens**
Shows two categories:

**✅ Kész tételek (Ready Items):**
- Items with `accessory_id`, `material_id`, or `linear_material_id`
- Green badge
- No action needed

**⚠️ Kezelendő tételek (Pending Items):**
- Free-typed items (all FKs are NULL)
- Yellow badge
- For each item, inline actions:

| Action | What happens |
|--------|-------------|
| **Összekapcsolás** (Link) | Autocomplete search → select existing accessory → links it |
| **Új termék** (Create New) | Inline fields: Name (pre-filled) + **SKU (required)** → creates new accessory |
| **Kihagyás** (Skip) | Item won't be included in PO |

### **Step 4: User Fills Required Fields**
- **Raktár** (Warehouse) - Required dropdown
- **Várható érkezés** (Expected Date) - Optional date picker
- All pending items must have action (link/create/skip)
- "PO Létrehozása" button enables when all resolved

### **Step 5: Create Button Clicked**
Backend process:
1. Validates no duplicates (checks `purchase_order_items.shop_order_item_id`)
2. Validates same `partner_id` for all items
3. For free-typed items:
   - If **link**: Verifies accessory exists, updates `shop_order_items.accessory_id`
   - If **create**: 
     - Validates SKU unique
     - Creates new accessory (trigger calculates `net_price`)
     - Updates `shop_order_items.accessory_id`
     - Updates `product_suggestions` (status: `'approved'`)
   - If **skip**: Excludes from PO
4. Creates `purchase_order`:
   - `source_type = 'customer_order'`
   - `status = 'draft'`
   - `partner_id`, `warehouse_id`, `order_date`, `expected_date`
5. Creates `purchase_order_items`:
   - Links each to `shop_order_item_id`
   - Calculates `net_price = base_price * multiplier`
6. Returns: `po_number`, `items_added`, `items_skipped`, `new_accessories_created`

### **Step 6: Status Updates (Current Behavior)**
- `shop_order_items` remain as `'open'`
- User must manually update to `'ordered'` after PO is confirmed
- Trigger updates `shop_orders` status based on all items

---

## 🚀 Future Workflow (After Migrations Applied)

### **Changes:**
1. **Step 5:** After creating PO, items change to `'in_po'` status
2. **New Step:** When user confirms PO (draft → confirmed):
   - Trigger auto-updates linked `shop_order_items` to `'ordered'`
   - No manual status update needed
3. **shop_orders** status:
   - Items in `'in_po'` = order still `'open'` (waiting for PO confirmation)
   - Items in `'ordered'` = order `'ordered'` (PO confirmed)

---

## 🗃️ Database Schema

### **Tables Used:**

```
shop_orders
  ↓ (order_id)
shop_order_items
  ↓ (shop_order_item_id) ← LINKAGE!
purchase_order_items
  ↓ (purchase_order_id)
purchase_orders
  ↓ (purchase_order_id)
shipments
  ↓ (shipment_id)
shipment_items
  ↓ (creates)
stock_movements
```

### **Key Columns:**

**`purchase_orders`:**
- `source_type` = `'customer_order'` (vs `'stock_replenishment'`)
- Distinguishes POs created from customer demand vs. stock management

**`purchase_order_items`:**
- `shop_order_item_id` = Links back to customer order item
- Enables full traceability and reporting

**`shop_order_items`:**
- `status` = Currently stays `'open'`, future: `'in_po'` → `'ordered'`
- `accessory_id`, `material_id`, `linear_material_id` = Updated when linking/creating

**`product_suggestions`:**
- `status` = `'pending'` → `'approved'` when resolved
- `accessory_id` = Set when approved
- Prevents duplicate suggestions

---

## 📊 Reports & Queries You Can Now Run

### **1. Which customer orders are waiting for this PO?**
```sql
SELECT 
  so.order_number,
  so.customer_name,
  soi.product_name,
  soi.quantity
FROM purchase_order_items poi
JOIN shop_order_items soi ON soi.id = poi.shop_order_item_id
JOIN shop_orders so ON so.id = soi.order_id
WHERE poi.purchase_order_id = 'your-po-id'
  AND so.deleted_at IS NULL;
```

### **2. Which POs were created from customer orders?**
```sql
SELECT 
  po.po_number,
  po.status,
  p.name AS partner_name,
  COUNT(poi.id) AS items_count,
  COUNT(DISTINCT soi.order_id) AS customer_orders_count
FROM purchase_orders po
JOIN partners p ON p.id = po.partner_id
JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
LEFT JOIN shop_order_items soi ON soi.id = poi.shop_order_item_id
WHERE po.source_type = 'customer_order'
  AND po.deleted_at IS NULL
GROUP BY po.id, po.po_number, po.status, p.name
ORDER BY po.created_at DESC;
```

### **3. How many free-typed products were converted to accessories?**
```sql
SELECT 
  COUNT(*) AS total_conversions,
  COUNT(DISTINCT ps.accessory_id) AS unique_accessories
FROM product_suggestions ps
WHERE ps.status = 'approved'
  AND ps.accessory_id IS NOT NULL;
```

---

## 🎨 UI/UX Details

### **Button Appearance:**
- **Visible when:** Same partner_id items selected (1+)
- **Hidden when:** No selection OR multiple partners
- **Disabled with tooltip:** Shows reason if can't create PO
- **Label:** "PO Létrehozása (5)" - shows count
- **Color:** Secondary (purple)
- **Icon:** AddShoppingCart

### **Modal Layout:**
```
┌─────────────────────────────────────────────┐
│ Beszerzési rendelés létrehozása        [X] │
├─────────────────────────────────────────────┤
│ ℹ️ 5 tétel kiválasztva                      │
│ Beszállító: **Partner Name**                │
│                                             │
│ [Raktár ▼]  [Várható érkezés: 2024-01-01] │
│                                             │
│ ✅ Kész tételek (3)                         │
│ ┌──────────────────────────────────────┐  │
│ │ Termék │ SKU │ Mennyiség │ Állapot   │  │
│ │ Item 1 │ SKU1│     5     │ ✓ Kész    │  │
│ └──────────────────────────────────────┘  │
│                                             │
│ ⚠️ Kezelendő tételek (2)                    │
│ Ezek a tételek még nincsenek a              │
│ termékadatbázisban. Válassz műveletet!      │
│ ┌──────────────────────────────────────┐  │
│ │ Termék │ SKU│ Mennyiség │ Művelet    │  │
│ │ Item 2 │ -  │     3     │            │  │
│ │   [Összekapcsolás ▼] vagy              │  │
│ │   [Name] [SKU*] [Új] [Kihagyás]       │  │
│ └──────────────────────────────────────┘  │
│                                             │
│                     [Mégse] [PO Létrehozása]│
└─────────────────────────────────────────────┘
```

### **Inline Fields for Creating Accessories:**
- **Name:** Pre-filled with `product_name`, editable
- **SKU:** Empty, user MUST enter, validates uniqueness
- **Base Price:** Auto-filled from shop_order_item
- **Multiplier:** Auto-filled from shop_order_item
- **Create button:** Disabled until SKU entered

---

## 🧪 Testing Checklist

### **Test Case 1: Create PO with Ready Items Only**
1. ✅ Select 3 items with `accessory_id` from same partner
2. ✅ Click "PO Létrehozása" button
3. ✅ Modal shows only "Kész tételek" section
4. ✅ Select warehouse
5. ✅ Click "PO Létrehozása"
6. ✅ Verify PO created with 3 items
7. ✅ Verify `purchase_order_items.shop_order_item_id` populated
8. ✅ Verify `purchase_orders.source_type = 'customer_order'`

### **Test Case 2: Create PO with Free-Typed Items (Link)**
1. ✅ Select 2 items: 1 ready, 1 free-typed (no `accessory_id`)
2. ✅ Click "PO Létrehozása" button
3. ✅ Modal shows both sections
4. ✅ For pending item: Use autocomplete to search existing accessory
5. ✅ Select accessory from dropdown
6. ✅ Chip appears: "Összekapcsolva: Accessory Name"
7. ✅ Click "PO Létrehozása"
8. ✅ Verify `shop_order_items.accessory_id` updated
9. ✅ Verify `product_suggestions.status = 'approved'`

### **Test Case 3: Create PO with Free-Typed Items (Create New)**
1. ✅ Select 1 free-typed item
2. ✅ Click "PO Létrehozása" button
3. ✅ For pending item: Enter SKU in inline field (e.g., "NEW-SKU-123")
4. ✅ Click "Új" button
5. ✅ Chip appears: "Új: Product Name (NEW-SKU-123)"
6. ✅ Select warehouse
7. ✅ Click "PO Létrehozása"
8. ✅ Verify new accessory created in `accessories` table
9. ✅ Verify `accessories.net_price` calculated by trigger
10. ✅ Verify `shop_order_items.accessory_id` updated

### **Test Case 4: Duplicate Prevention**
1. ✅ Create PO from item A
2. ✅ Try to create another PO including item A
3. ✅ Verify error message: "1 tétel már hozzá van rendelve beszerzési rendeléshez: PO-XXX (draft)"

### **Test Case 5: Multiple Partners Selected**
1. ✅ Select items from Partner A and Partner B
2. ✅ Verify button is disabled
3. ✅ Hover shows tooltip: "PO nem hozható létre: Több beszállító"

### **Test Case 6: Skip Free-Typed Item**
1. ✅ Select 2 items: 1 ready, 1 free-typed
2. ✅ For pending item: Click "Kihagyás"
3. ✅ Chip appears: "Kihagyva"
4. ✅ Click "PO Létrehozása"
5. ✅ Verify PO created with only 1 item (ready item)
6. ✅ Verify toast: "1 tétel hozzáadva, 1 kihagyva"

### **Test Case 7: SKU Uniqueness Validation**
1. ✅ Select free-typed item
2. ✅ Try to create with existing SKU
3. ✅ Verify error: "SKU már létezik: XXX. Válassz másik SKU-t."

---

## 🔧 API Endpoints

### **POST `/api/shop-order-items/create-purchase-order`**

**Request Body:**
```json
{
  "shop_order_item_ids": ["uuid1", "uuid2"],
  "warehouse_id": "uuid",
  "expected_date": "2024-01-15" // optional,
  "item_actions": [
    {
      "item_id": "uuid1",
      "action": "include" // Ready item with FK
    },
    {
      "item_id": "uuid2",
      "action": "link",
      "accessory_id": "uuid3",
      "accessory_name": "Linked Accessory"
    },
    {
      "item_id": "uuid3",
      "action": "create",
      "new_accessory_data": {
        "name": "New Product",
        "sku": "NEW-SKU-123",
        "base_price": 1000,
        "multiplier": 1.38
      }
    },
    {
      "item_id": "uuid4",
      "action": "skip"
    }
  ]
}
```

**Success Response:**
```json
{
  "success": true,
  "purchase_order_id": "uuid",
  "po_number": "PO-20241203-001",
  "items_added": 3,
  "items_skipped": 1,
  "new_accessories_created": 1
}
```

**Error Responses:**
```json
// Duplicate item
{ "error": "1 tétel már hozzá van rendelve beszerzési rendeléshez: PO-001 (draft)" }

// Multiple partners
{ "error": "Csak azonos beszállítójú tételeket lehet egyszerre rendelni" }

// SKU already exists
{ "error": "SKU már létezik: NEW-SKU-123. Válassz másik SKU-t." }

// Missing SKU
{ "error": "SKU megadása kötelező a termékhez: Product Name" }
```

---

## 🎯 Status Transitions

### **Current (Without Migrations):**
```
shop_order_items:
  open → (stays open when added to PO) → (manually set to) ordered → arrived → handed_over
```

### **Future (With Migrations):**
```
shop_order_items:
  open → in_po (auto when added to draft PO) → ordered (auto when PO confirmed) → arrived → handed_over
```

---

## 🔍 Traceability Examples

### **Query: Find all customer orders in a PO**
```sql
SELECT DISTINCT
  so.order_number,
  so.customer_name,
  so.customer_mobile
FROM purchase_orders po
JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
JOIN shop_order_items soi ON soi.id = poi.shop_order_item_id
JOIN shop_orders so ON so.id = soi.order_id
WHERE po.id = 'your-po-id';
```

### **Query: Find which PO a customer order item is in**
```sql
SELECT 
  po.po_number,
  po.status AS po_status,
  poi.quantity,
  poi.net_price
FROM shop_order_items soi
JOIN purchase_order_items poi ON poi.shop_order_item_id = soi.id
JOIN purchase_orders po ON po.id = poi.purchase_order_id
WHERE soi.id = 'your-shop-order-item-id';
```

---

## 📈 Benefits

1. **Faster Ordering:** Create POs directly from customer demand
2. **Data Quality:** Resolve free-typed items, build proper accessory catalog
3. **Traceability:** Full audit trail from customer to supplier
4. **Automation:** Auto-approval of product suggestions
5. **Duplicate Prevention:** Can't accidentally order same item twice
6. **Business Intelligence:** Track which POs are from customer orders vs. stock replenishment

---

## ⚠️ Important Notes

1. **Production Safety:**
   - Feature works WITHOUT database migrations
   - Migrations are saved for future use (prefixed with `FUTURE_`)
   - Status remains as `'open'` until migrations applied

2. **Manual Steps Required (Current):**
   - After PO is confirmed, manually update item status to `'ordered'`
   - Use bulk status update on supplier-orders page

3. **SKU Requirement:**
   - SKU is **REQUIRED** for creating new accessories
   - Must be **UNIQUE** across all non-deleted accessories
   - Validation happens in API before creation

4. **Partner Consistency:**
   - Can only create PO from items with SAME `partner_id`
   - System enforces this in UI (button disabled) and API (validation)

---

## 🔜 Next Steps

When ready to apply migrations:
1. Read `supabase/migrations/FUTURE_MIGRATIONS_README.md`
2. Test migrations on staging database
3. Backup production database
4. Remove `FUTURE_` prefix from migration files
5. Run migrations
6. Enjoy automatic status updates! 🎉

---

**Created:** December 3, 2024
**Status:** ✅ Implemented and ready to use
**Database Migrations:** 📋 Prepared for future deployment

