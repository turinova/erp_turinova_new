# Phase 2: API Endpoints - Implementation Summary

## ✅ Completed Endpoints

### 1. Purchase Orders API

#### `GET /api/purchase-orders`
- **Purpose**: List all purchase orders with pagination, search, and filtering
- **Query Params**: `page`, `limit`, `status`, `search`
- **Returns**: List of POs with supplier, warehouse, totals, status
- **Features**: 
  - Pagination support
  - Search by PO number or supplier name
  - Filter by status
  - Includes aggregated totals

#### `GET /api/purchase-orders/[id]`
- **Purpose**: Get a single purchase order with all items
- **Returns**: Complete PO with supplier, warehouse, currency, items, and all relationships
- **Features**: 
  - Includes all item details with product info
  - Filters out soft-deleted items

#### `POST /api/purchase-orders`
- **Purpose**: Create a new purchase order
- **Request Body**: 
  ```json
  {
    "supplier_id": "uuid",
    "warehouse_id": "uuid",
    "order_date": "2026-03-23",
    "expected_delivery_date": "2026-03-30",
    "currency_id": "uuid",
    "note": "Optional",
    "items": [...]
  }
  ```
- **Features**:
  - Auto-generates PO number (`POR-2026-000001`)
  - Calculates totals (net, VAT, gross, weight, quantity)
  - Creates PO + items in transaction
  - Validates supplier and warehouse exist
  - Status defaults to `'draft'`

#### `PUT /api/purchase-orders/[id]`
- **Purpose**: Update PO header (supplier, warehouse, dates, note, status)
- **Features**:
  - Cannot edit if status = `'received'`
  - Validates status transitions
  - Validates supplier and warehouse exist

#### `DELETE /api/purchase-orders/[id]`
- **Purpose**: Soft delete a purchase order
- **Features**:
  - Cannot delete if status = `'received'`
  - Checks for linked shipments
  - Soft deletes all items

---

### 2. Purchase Order Items API

#### `GET /api/purchase-orders/[id]/items`
- **Purpose**: Get all items for a purchase order
- **Returns**: Array of items with product, VAT, currency, unit details

#### `POST /api/purchase-orders/[id]/items`
- **Purpose**: Add an item to a purchase order
- **Request Body**:
  ```json
  {
    "product_id": "uuid",
    "product_supplier_id": "uuid", // optional
    "quantity": 10,
    "unit_cost": 5000,
    "vat_id": "uuid",
    "currency_id": "uuid",
    "unit_id": "uuid",
    "description": "Optional"
  }
  ```
- **Features**:
  - Validates product is connected to supplier
  - Cannot add if PO status = `'approved'` or `'received'`
  - Recalculates PO totals after adding

#### `PUT /api/purchase-orders/[id]/items/[itemId]`
- **Purpose**: Update a purchase order item
- **Features**:
  - Cannot edit if PO status = `'approved'` or `'received'`
  - Validates quantity > 0, unit_cost >= 0
  - Recalculates PO totals after updating

#### `DELETE /api/purchase-orders/[id]/items/[itemId]`
- **Purpose**: Remove an item from a purchase order (soft delete)
- **Features**:
  - Cannot delete if PO status = `'approved'` or `'received'`
  - Recalculates PO totals after deletion

---

### 3. Status Transition Endpoints

#### `PUT /api/purchase-orders/[id]/approve`
- **Purpose**: Approve a purchase order
- **Features**:
  - Sets `status = 'approved'`
  - Sets `approved_at` timestamp
  - Sets `approved_by` user ID
  - Only works if status = `'draft'` or `'pending_approval'`
  - Requires at least 1 item

#### `PUT /api/purchase-orders/[id]/cancel`
- **Purpose**: Cancel a purchase order
- **Features**:
  - Sets `status = 'cancelled'`
  - Cannot cancel if status = `'received'`
  - Checks for linked shipments
  - Optional cancellation reason

---

### 4. Barcode Scanning

#### `GET /api/products/barcode/[barcode]`
- **Purpose**: Find product by barcode
- **Supports**:
  - `internal_barcode` (ERP-generated)
  - `gtin` (supplier/manufacturer barcode)
  - `supplier_barcode` (from `product_suppliers` table)
- **Returns**: Product with ID, name, SKU, barcodes

---

### 5. Product-Supplier Suggestions

#### `GET /api/products/supplier/[supplierId]`
- **Purpose**: Get all products connected to a specific supplier
- **Query Params**: `search` (optional), `limit` (default: 50)
- **Returns**: 
  ```json
  {
    "supplier": { "id": "...", "name": "..." },
    "products": [
      {
        "product_supplier_id": "...",
        "product_id": "...",
        "product_name": "...",
        "supplier_sku": "...",
        "default_cost": 5000,
        "min_order_quantity": 1,
        "lead_time_days": 7,
        "is_preferred": true,
        "vat_id": "...",
        "vat_rate": 27,
        "unit_id": "...",
        "unit_name": "..."
      }
    ],
    "count": 10
  }
  ```
- **Features**:
  - Search by product name, SKU, or supplier SKU
  - Returns preferred suppliers first
  - Includes supplier-specific data (SKU, cost, lead time)

---

## 🔄 Status Transition Rules

### Purchase Orders:

| From Status | To Status | Endpoint | Validation |
|------------|-----------|----------|------------|
| `draft` | `pending_approval` | `PUT /api/purchase-orders/[id]` | Must have items |
| `draft` | `cancelled` | `PUT /api/purchase-orders/[id]/cancel` | - |
| `pending_approval` | `approved` | `PUT /api/purchase-orders/[id]/approve` | Must be authorized |
| `pending_approval` | `cancelled` | `PUT /api/purchase-orders/[id]/cancel` | - |
| `approved` | `cancelled` | `PUT /api/purchase-orders/[id]/cancel` | Check shipments |
| `approved` | `partially_received` | Auto (when shipment created) | Automatic |
| `partially_received` | `received` | Auto (when all items received) | Automatic |
| `received` | ❌ | None | Cannot change |

---

## 📊 Totals Calculation

All totals follow the **Hungarian rounding pattern** (matching Számlázz.hu requirements):

1. **Line Net**: `Math.round(unit_cost * quantity)`
2. **Line VAT**: `Math.round(line_net * vat_rate / 100)`
3. **Line Gross**: `line_net + line_vat` (sum of integers)

**PO Totals**:
- `total_net`: Sum of all line nets
- `total_vat`: Sum of all line VATs
- `total_gross`: Sum of all line grosses
- `total_quantity`: Sum of all quantities
- `item_count`: Count of items

**Auto-Recalculated**:
- When adding item
- When updating item
- When deleting item

---

## 🔒 Business Rules

1. **Item Editing**:
   - ✅ Allowed: `draft`, `pending_approval`
   - ❌ Not allowed: `approved`, `received`

2. **Product-Supplier Validation**:
   - Product must be connected to PO's supplier (via `product_suppliers`)
   - If `product_supplier_id` provided, validates it matches PO supplier

3. **PO Deletion**:
   - Cannot delete if status = `'received'`
   - Cannot delete if linked to shipments

4. **Status Transitions**:
   - Enforced via validation
   - Cannot skip statuses
   - Cannot go backwards (except cancel)

---

---

### 6. Shipments API

#### `GET /api/shipments`
- **Purpose**: List all shipments with pagination, search, and filtering
- **Query Params**: `page`, `limit`, `status`, `search`
- **Returns**: List of shipments with supplier, warehouse, status, dates

#### `GET /api/shipments/[id]`
- **Purpose**: Get a single shipment with all items and linked purchase orders
- **Returns**: Complete shipment with items, POs, supplier, warehouse

#### `POST /api/shipments`
- **Purpose**: Create a shipment from one or more approved purchase orders
- **Request Body**:
  ```json
  {
    "supplier_id": "uuid",
    "warehouse_id": "uuid",
    "purchase_order_ids": ["uuid1", "uuid2"],
    "expected_arrival_date": "2026-03-30",
    "currency_id": "uuid",
    "note": "Optional"
  }
  ```
- **Features**:
  - Validates all POs are `'approved'` and have same supplier
  - Auto-generates shipment number (`SHP-2026-0000001`)
  - Creates shipment items from PO items
  - Creates warehouse operation automatically
  - Status = `'waiting'` by default

#### `PUT /api/shipments/[id]`
- **Purpose**: Update shipment header (dates, status, note)
- **Features**:
  - Validates status transitions
  - Auto-updates dates based on status
  - Updates warehouse operation status when inspection starts

---

### 7. Shipment Items API

#### `GET /api/shipments/[id]/items`
- **Purpose**: Get all items in a shipment
- **Returns**: Items with expected/received/inspected/accepted/rejected quantities

#### `POST /api/shipments/[id]/items`
- **Purpose**: Add an unexpected item to a shipment
- **Request Body**:
  ```json
  {
    "product_id": "uuid",
    "received_quantity": 5,
    "unit_cost": 5000,
    "vat_id": "uuid",
    "currency_id": "uuid",
    "is_unexpected": true
  }
  ```
- **Features**:
  - Only allowed if shipment status = `'arrived'` or `'inspecting'`
  - Required fields: product_id, received_quantity, unit_cost, vat_id

#### `PUT /api/shipments/[id]/items/[itemId]`
- **Purpose**: Update received/inspected quantities
- **Request Body**:
  ```json
  {
    "received_quantity": 10,
    "inspected_quantity": 10,
    "accepted_quantity": 9,
    "rejected_quantity": 1,
    "shelf_location": "A-12-3",
    "inspection_notes": "1 damaged"
  }
  ```
- **Features**:
  - Validates: `inspected_quantity = accepted_quantity + rejected_quantity`
  - Only allowed if shipment status = `'arrived'` or `'inspecting'`

---

### 8. Warehouse Operations API

#### `GET /api/warehouse-operations`
- **Purpose**: List warehouse operations
- **Query Params**: `warehouse_id`, `status`, `operation_type`, `page`, `limit`
- **Returns**: List of operations with shipment, warehouse, user info

#### `GET /api/warehouse-operations/[id]`
- **Purpose**: Get a single warehouse operation
- **Returns**: Complete operation with all relationships

#### `PUT /api/warehouse-operations/[id]/complete`
- **Purpose**: Complete a warehouse operation (receiving)
- **Features**:
  - Sets `completed_at` and `completed_by`
  - Status = `'completed'`
  - Creates stock movements for all accepted items
  - Updates PO `received_quantity` for each item
  - Updates PO status (`partially_received` or `received`)
  - Updates shipment status to `'completed'`
  - Refreshes `stock_summary` view

---

### 9. Stock Management API

#### `GET /api/stock`
- **Purpose**: Get stock summary (from `stock_summary` view)
- **Query Params**: `warehouse_id`, `product_id`, `search`, `page`, `limit`
- **Returns**: Product stock levels per warehouse
- **Features**:
  - Auto-refreshes stock summary view before query
  - Includes: quantity_on_hand, quantity_reserved, quantity_available, average_cost, total_value

#### `GET /api/stock/movements`
- **Purpose**: Get stock movement history
- **Query Params**: `warehouse_id`, `product_id`, `movement_type`, `page`, `limit`
- **Returns**: Immutable audit trail of all stock changes
- **Features**:
  - Includes warehouse, product, user, warehouse operation info
  - Ordered by `created_at` DESC (newest first)

#### `POST /api/stock/adjustment`
- **Purpose**: Manual stock adjustment
- **Request Body**:
  ```json
  {
    "warehouse_id": "uuid",
    "product_id": "uuid",
    "quantity": -5, // Negative = decrease, Positive = increase
    "unit_cost": 5000, // Optional
    "shelf_location": "A-12-3",
    "note": "Manual adjustment - damaged goods"
  }
  ```
- **Features**:
  - Creates stock movement with `movement_type = 'adjustment'`
  - Creates warehouse operation if note/shelf_location provided
  - Refreshes `stock_summary` view
  - Supports both positive (increase) and negative (decrease) adjustments

---

## 🧪 Testing Checklist

- [ ] Create PO with items
- [ ] List POs with pagination
- [ ] Search POs by number or supplier
- [ ] Filter POs by status
- [ ] Get single PO with all items
- [ ] Add item to PO
- [ ] Update item in PO
- [ ] Delete item from PO
- [ ] Approve PO
- [ ] Cancel PO
- [ ] Validate status transitions
- [ ] Test barcode scanning (internal, gtin, supplier)
- [ ] Test product-supplier suggestions
- [ ] Test totals recalculation
- [ ] Test validation rules (editing approved PO, etc.)

---

## 📚 API Patterns Used

1. **Authentication**: `getTenantSupabase()` + `auth.getUser()`
2. **Error Handling**: Consistent error responses (401, 404, 400, 500)
3. **Validation**: Input validation before database operations
4. **Soft Deletes**: `deleted_at` instead of hard deletes
5. **Totals Calculation**: Hungarian rounding pattern
6. **Status Management**: Enforced transitions with validation
7. **Relationships**: Supabase joins for nested data

---

## ✅ Status: Phase 2 Complete

**All APIs Implemented**: 
- ✅ Purchase Orders (CRUD + Status Transitions)
- ✅ Purchase Order Items (CRUD)
- ✅ Shipments (CRUD)
- ✅ Shipment Items (CRUD)
- ✅ Warehouse Operations (GET + Complete)
- ✅ Stock Management (Summary + Movements + Adjustments)
- ✅ Barcode Scanning
- ✅ Product-Supplier Suggestions

**Ready for Phase 3**: UI Components Implementation
