# Beszállítói várólista – Implementation Plan

This document describes the full implementation of the **Beszállítói várólista** (Supplier waiting list / Replenishment list): a page where demand from orders (short items not yet on a purchase order) is listed, tracked, and turned into new POs or added to existing POs. Goal: **user-friendly, bulletproof purchasing from orders**.

---

## 1. Overview

| Item | Description |
|------|-------------|
| **Data source** | Order items that are short (demand) and not yet linked to a PO. No new table; query `order_items` + `orders` (+ products, stock optional). |
| **Main page** | `/replenishment` – list demand, filter, select, "Create new PO" or "Add to existing PO". |
| **Order detail** | Button "Hiány pótlása" when order is Új and not fully fulfillable → create PO from that order or open várólista filtered by order. |
| **Permissions** | New page `/replenishment` under Beszerzés; same access as purchase orders. |

---

## 2. Data Model (no new table)

**Definition of "várólista" (open demand):**

- `order_items` where:
  - `deleted_at` IS NULL
  - `purchase_order_id` IS NULL
  - Parent `orders.deleted_at` IS NULL and `orders.status` IN (`new`, `picking`, `picked`, `verifying`, `packing`)
  - Parent `orders.fulfillability_status` IN (`not_fulfillable`, `partially_fulfillable`) — so we only show orders that still have shortage

**Optional:** Exclude order_items where `product_id` IS NULL from the "add to PO" flow (show them in a separate "no product" block with message to pair product first).

**Optional later:** Add a DB view `replenishment_demand_lines` that joins order_items ↔ orders ↔ products and applies the above filters for simpler querying.

---

## 3. APIs

### 3.1 GET `/api/replenishment`

**Purpose:** List all várólista lines (demand not yet on a PO).

**Query params:**

- `group_by`: `product` (default) | `line` — one row per product (summed qty + source orders) or one row per order_item.
- `order_id`: optional — filter to demand from one order.
- `supplier_id`: optional — filter to products that have this supplier in product_suppliers.

**Response:** `{ lines: [...], totalCount, warnings?: string[] }`

**Logic:**

- Load order_items with `purchase_order_id` IS NULL, join orders (status in new/picking/picked/verifying/packing, fulfillability_status in not_fulfillable, partially_fulfillable).
- For each line: product_id, quantity, order_id, order_number, product_name, product_sku; optionally quantity_available and shortfall.
- If `group_by=product`: group by product_id, sum(quantity), collect order_ids/order_numbers and order_item_ids.
- Include only order_items where product exists (join shoprenter_products, deleted_at null) for "add to PO" lines; optionally return separate array for lines without product_id for "pair product first" block.

### 3.2 POST `/api/replenishment/create-po`

**Purpose:** Create one new purchase order from selected várólista lines.

**Body:** `{ items: [{ order_item_id }] or [{ product_id, quantity }], supplier_id, warehouse_id, currency_id?, expected_delivery_date?, note? }`

**Logic:**

- Resolve to (product_id, quantity). If order_item_id: load order_items, aggregate by product_id.
- Validate all products have at least one supplier (product_suppliers); if not, return 400 with list of products missing supplier.
- Validate single supplier for selection (or use body.supplier_id); only include products that have that supplier.
- Resolve vat_id, unit_id, unit_cost from product + product_supplier (with fallbacks; see edge cases).
- Create PO via existing POST /api/purchase-orders shape; then link each order_item to the new PO item (set order_items.purchase_order_id, purchase_order_item_id).
- Recompute orders.fulfillability_status for affected orders (e.g. all items on PO → po_created).

**Returns:** `{ purchase_order: { id, po_number, ... } }` (201).

### 3.3 POST `/api/replenishment/add-to-po`

**Purpose:** Add selected várólista lines to an existing (draft) PO.

**Body:** `{ purchase_order_id, items: [{ order_item_id }] or [{ product_id, quantity }] }`

**Logic:**

- Load PO; check status is draft or pending_approval.
- Resolve items; for each product, ensure product has that PO's supplier (product_suppliers); otherwise skip or return 400.
- Call existing POST /api/purchase-orders/[id]/items for each product; then set order_items.purchase_order_id and purchase_order_item_id.
- Recompute orders.fulfillability_status for affected orders.

**Returns:** `{ purchase_order: { id, ... }, added_items: [...], skipped?: [...] }` (200).

### 3.4 GET `/api/orders/[id]/replenishment-lines` (optional)

**Purpose:** Get várólista lines for one order (for "Hiány pótlása" from order detail).

**Returns:** Same shape as replenishment list filtered by order_id.

---

## 4. Pages and Functions

### 4.1 Page: Beszállítói várólista (`/replenishment`)

- **List demand** — Table grouped by product (default): product name, SKU, total quantity needed, source orders (links), supplier (or "— Nincs beszállító").
- **Filter** — By supplier, by order number (order_id).
- **Select lines** — Checkbox per row; "Select all on page".
- **Create new PO** — Button "Új beszerzési rendelés"; enabled when selection has at least one line with product_id and at least one product with supplier. Modal or flow: choose supplier (prefilled if single), warehouse, optional dates → POST create-po → redirect to new PO.
- **Add to existing PO** — Button "Hozzáadás meglévőhöz"; select open PO (draft) → POST add-to-po; only lines whose product has that PO's supplier are addable.
- **Link to order** — Order number links to `/orders/[id]`.
- **Empty state** — "Nincs nyitott hiány. A rendelések átvételekor a hiányzó tételek itt jelennek meg."
- **Lines without product** — Optional separate block: "Tételek termék nélkül" with message to pair product first; no Create/Add to PO for these.

### 4.2 Order detail (`/orders/[id]`) — extend

- **"Hiány pótlása" / "Beszerzés indítása"** — Visible when order status is Új and fulfillability is Hiány or Beszerzés alatt. Action: create PO from this order's short items (POST create-po with items = this order's short order_items) or navigate to `/replenishment?order_id=<id>`.
- **Show "on PO"** — When order_items have purchase_order_id, show "Beszerzés alatt" and link to that PO.

### 4.3 Purchase order detail (`/purchase-orders/[id]`) — optional

- **"Add from várólista"** — When PO is draft: open modal to pick várólista lines (filtered by same supplier), call add-to-po.

---

## 5. Permissions and Tenant DB

- **New page:** `/replenishment` — "Beszállítói várólista", "Rendelési hiányok követése és beszerzési rendelés létrehozása", category "Beszerzés".
- **Migration:** Add to `pages` (INSERT with ON CONFLICT path DO UPDATE); grant to users who have purchase-orders access (or same role as Beszerzés).
- **Tenant DB:** Add migration name to `get_tenant_pending_migrations` in tenant_migration_tracking so tenant DBs run the same permission migration.

---

## 6. Edge Cases and Handling

### 6.1 Product / supplier setup

| Edge case | Handling |
|-----------|----------|
| **Order item has no product_id** | Exclude from "Create/Add PO" selection. Show in separate "Tételek termék nélkül" block with message: "Párosítsa a terméket a termékeknél." |
| **Product has no beszállító** | Show "— Nincs beszállító" in list. Block "Create PO" if selection has only such products; show message. For mixed selection: create PO for products with supplier, warn "X tétel kihagyva (nincs beszállító)". |
| **Product has multiple suppliers** | Use preferred supplier; user chooses supplier in "Create PO" form; only products with that supplier go into PO. |
| **Add to existing PO – supplier mismatch** | Only allow adding lines whose product has that PO's supplier. Filter selectable lines when user picks PO; show message if none remain. |

### 6.2 Missing master data (VAT, unit, cost)

| Edge case | Handling |
|-----------|----------|
| **Missing vat_id or unit_id** | Resolve from product → product_supplier → tenant default. If still missing: 400 with list of products to fix. |
| **No unit cost** | Allow 0; user can edit on PO. |
| **Currency** | PO-level currency (user or tenant default). |

### 6.3 Selection and actions

| Edge case | Handling |
|-----------|----------|
| **Selected lines from different suppliers** | One PO = one supplier. Validate "all selected products have chosen supplier"; if mixed, show message or "Create one PO per supplier". |
| **Some lines already on PO** | API filters to order_items where purchase_order_id IS NULL; skip already-linked; return skipped in response. List only shows unlinked lines. |
| **Order cancelled** | List only includes orders with status in (new, picking, picked, verifying, packing). Cancelled orders drop off automatically. |
| **Product deleted** | Exclude from list (join products where deleted_at null). API 404 if product_id in request. |

### 6.4 Errors and UX

| Edge case | Handling |
|-----------|----------|
| **PO creation fails after partial link** | Prefer transactional: create PO + items, then link order_items; on failure rollback or leave PO draft and do not link; clear error message. |
| **Add to PO fails for some items** | All-or-nothing: if one fails (e.g. product not linked to supplier), return 400 with list; user fixes data and retries. |
| **Empty selection** | Buttons disabled; API 400 if no items. |
| **List empty** | Empty state: "Nincs nyitott hiány. A rendelések átvételekor a hiányzó tételek itt jelennek meg." |
| **Warehouse for new PO** | Required in form; default first active or last used. |

---

## 7. Implementation Order

1. **Doc** — This document (done).
2. **Migration** — Add `/replenishment` to pages + tenant tracking.
3. **GET /api/replenishment** — List demand (group_by=product/line, filters).
4. **Page /replenishment** — Table, filters, checkboxes, empty state, links to orders (no actions yet).
5. **POST /api/replenishment/create-po** — Create PO from selection, link order_items, update fulfillability.
6. **POST /api/replenishment/add-to-po** — Add to existing PO, link order_items.
7. **Replenishment page actions** — "Új beszerzési rendelés" and "Hozzáadás meglévőhöz" with modals.
8. **Order detail** — "Hiány pótlása" button and flow.

---

## 8. Summary Table

| Page | Route | Main functions |
|------|--------|-----------------|
| Beszállítói várólista | `/replenishment` | List demand (by product/line); filter; select; "Új beszerzési rendelés"; "Hozzáadás meglévőhöz"; link to orders. |
| Order detail | `/orders/[id]` | "Hiány pótlása"; show "Beszerzés alatt" + link to PO. |

| API | Method | Purpose |
|-----|--------|---------|
| `/api/replenishment` | GET | List várólista lines (group by product/line, filters). |
| `/api/replenishment/create-po` | POST | Create new PO from selection, link order_items. |
| `/api/replenishment/add-to-po` | POST | Add selection to existing PO, link order_items. |
