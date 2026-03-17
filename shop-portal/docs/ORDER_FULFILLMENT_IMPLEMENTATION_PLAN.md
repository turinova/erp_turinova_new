# Order fulfillment – full implementation plan

This document is the **master plan** for implementing the order status workflow, fulfillability display (Hiány / Beszerzés alatt / Csomagolható), Begyűjtés (pick batch), packing, and related features. Workflow rules and edge cases are in [ORDER_STATUS_WORKFLOW.md](./ORDER_STATUS_WORKFLOW.md).

---

## Overview

| Phase | Name | Goal |
|-------|------|------|
| **1** | Status foundation | Extend DB statuses, add status-change API + UI, enforce transitions. |
| **2** | Fulfillability display | Show Hiány / Beszerzés alatt / Csomagolható on Új orders (list + detail). |
| **3** | Stock check at takeover | Run fulfillability when order is created from buffer; set initial fulfillability_status. |
| **4** | Create/link PO from order | Create PO from order shortage; set po_created and order–PO links; “Beszerzés alatt” becomes visible. |
| **5** | Fulfillability after PO receive | When linked PO is received, re-run stock check for affected orders; update to fully_fulfillable when possible. |
| **6** | Begyűjtés (pick batch) | Batch entity, APIs, UI; orders move picking → picked. |
| **7** | Packing + scan + auto label/pickup | Pack screen, scan validation, box complete → auto label or pickup email. |
| **8** | Edge cases & polish | On-hold, stale batch, cancellation stock release, returns, sync (as needed). |

---

## Phase 1: Status foundation

**Goal:** Orders can move along the lifecycle (Új → … → Kézbesítve / Törölve / Visszatérítve) with validated transitions.

### 1.1 Migration: extend order status

- **File:** New migration e.g. `YYYYMMDD_orders_status_workflow.sql`.
- **Change:** Replace `orders_status_check` so `status` allows:  
  `pending_review`, `new`, `picking`, `picked`, `verifying`, `packing`, `shipped`, `ready_for_pickup`, `delivered`, `cancelled`, `refunded`.
- **Reference:** [ORDER_STATUS_WORKFLOW.md § 6](./ORDER_STATUS_WORKFLOW.md#6-current-schema-vs-this-workflow).

### 1.2 Shared constants and transition rules

- **Where:** e.g. `src/lib/order-status.ts` (or under `orders/`).
- **Deliverables:**
  - `ORDER_STATUS_LABELS`: DB value → Hungarian label.
  - `ORDER_STATUS_COLORS`: DB value → MUI color (for chips).
  - `ALLOWED_NEXT_STATUS: Record<string, string[]>`: from the workflow doc (e.g. `new` → `['picking', 'cancelled']`, etc.).
  - Helper: `getAllowedNextStatus(current: string): string[]`.
- **Use in:** API (validation), order list, order detail.

### 1.3 API: change order status

- **Endpoint:** `PATCH /api/orders/[id]` (body: `{ status, comment? }`) or dedicated `PUT /api/orders/[id]/status`.
- **Logic:**
  - Load current order; check `current_status` in `ALLOWED_NEXT_STATUS[current_status]` includes requested `status`.
  - If invalid → 400 with clear message.
  - Update `orders.status` (and optionally `platform_status_id` / `platform_status_text` if provided).
  - Existing trigger writes to `order_status_history`; if API uses INSERT for history, set `source = 'manual'` or `'api'`.
- **Auth:** Same as rest of orders (authenticated user).

### 1.4 Order detail: status change UI

- **Where:** Order detail page (e.g. Rendelési adatok card or dedicated status block).
- **Behaviour:**
  - Show current status (chip with label from `ORDER_STATUS_LABELS`).
  - Dropdown or button group with **only** allowed next statuses (from `getAllowedNextStatus(order.status)`).
  - On change: call status API, then refresh or update local state; show success/error toast.
- **Edge:** If terminal status (`cancelled`, `refunded`), show status only (no selector).

### 1.5 Order list: status column

- **Where:** Orders table.
- **Change:** Use shared `ORDER_STATUS_LABELS` and `ORDER_STATUS_COLORS` so list matches detail and supports new values (`picking`, `picked`, `verifying`, `ready_for_pickup`).
- **Optional:** Filter by status (dropdown) using the same list.

**Phase 1 done when:** User can open an order and move it along the pipeline (e.g. Új → Törölve, or Új → Begyűjtés → …) with only allowed transitions; list shows all statuses correctly.

---

## Phase 2: Fulfillability display (Hiány / Beszerzés alatt / Csomagolható)

**Goal:** For orders in status **Új**, show the right badge from `fulfillability_status` without adding new statuses.

### 2.1 Display logic

- **Where:** Shared helper or component, used by order list and order detail.
- **Rule:** Only when `order.status === 'new'`:
  - `not_fulfillable` or `partially_fulfillable` → show badge **Hiány** (e.g. warning/error color).
  - `po_created` → show badge **Beszerzés alatt** (e.g. info color).
  - `fully_fulfillable` → show badge **Csomagolható** (e.g. success color).
  - `unknown` / `checking` → show **—** or “Ellenőrzés” (optional).
- **Placement:** Next to status chip on list; in Rendelési adatok or a small “Készlet” block on detail.

### 2.2 Order list

- Add a column or combined cell (e.g. “Új + badge”) so list view shows Hiány / Beszerzés alatt / Csomagolható for Új orders.
- **Optional:** Filter “Csomagolható only” for warehouse users.

### 2.3 Order detail

- On order detail, when status is Új, show the same badge (Hiány / Beszerzés alatt / Csomagolható) prominently (e.g. next to status chip or in a short “Készlet” line).

**Phase 2 done when:** Every Új order shows the correct fulfillability badge on list and detail; no new DB status.

---

## Phase 3: Stock check at buffer takeover

**Goal:** When an order is created from the buffer, set initial `fulfillability_status` from current stock so Hiány/Csomagolható/Beszérzés alatt is correct from day one.

### 3.1 After creating order + order_items

- **Where:** Buffer process route, after `createOrderItems` and `recomputeOrderTotalsFromItems`.
- **Logic:**
  - For the new order, get all order_items (product_id, quantity).
  - For each product_id, sum `quantity_available` from `stock_summary` (same as item-availability API).
  - Compare needed vs available per line; derive overall: all lines OK → `fully_fulfillable`, none OK → `not_fulfillable`, else `partially_fulfillable`.
  - Do **not** set `po_created` here (that happens when user creates/links a PO).
- **Update:** `orders.fulfillability_status` and optionally `order_items.fulfillability_status` if you store per-line.

### 3.2 Optional: background job or manual “Refresh fulfillability”

- If stock changes often, allow “re-check” button on order detail (for Új orders) that re-runs the same logic and updates `fulfillability_status`. Useful before Begyűjtés.

**Phase 3 done when:** New orders from buffer get correct fulfillability_status; Phase 2 badges show the right value without extra user action.

---

## Phase 4: Create / link PO from order (Beszerzés alatt)

**Goal:** When user creates a PO from an order’s shortage (or links the order to a PO), set `po_created` and order–PO links so the order shows “Beszerzés alatt”.

### 4.1 “Create PO from order” flow

- **Entry:** From order detail (e.g. button “Beszerzés indítása” or “Hiány pótlása”) when order is Új and fulfillability is not fully_fulfillable.
- **Logic:**
  - Determine missing quantities per product (order line qty − available stock); only lines with shortfall.
  - Create a new purchase order (existing PO creation API or new endpoint) with those lines (product, quantity, supplier/warehouse from config or default).
  - For each created PO line that fulfills an order line: set `order_items.purchase_order_id`, `order_items.purchase_order_item_id` to the new PO and PO item.
  - Set `orders.fulfillability_status = 'po_created'` (and optionally set each linked order_item’s fulfillability_status to `po_created`).
- **UI:** After creation, redirect or link to the new PO; order detail shows “Beszerzés alatt”.

### 4.2 Optional: “Link order to existing PO”

- If a PO already exists for the same products, allow linking: select PO (and maybe PO lines), then update order_items and order fulfillability_status to `po_created` as above.

**Phase 4 done when:** Creating a PO from an order’s shortage updates the order so it shows “Beszerzés alatt”; order_items are linked to PO lines where applicable.

---

## Phase 5: Fulfillability after PO receive

**Goal:** When a PO linked to order(s) is received (e.g. shipment completed, stock updated), re-run stock check for those orders and set `fully_fulfillable` when all items are in stock so they become “Csomagolható”.

### 5.1 Trigger or API hook

- **When:** After PO receive (e.g. shipment complete / warehouse operation complete that updates stock).
- **Logic:**
  - Find all orders that have at least one order_item with `purchase_order_id` = received PO (or order_items referencing PO items of that PO).
  - For each such order: re-run fulfillability logic (compare order line qty vs current stock); if all lines OK, set `orders.fulfillability_status = 'fully_fulfillable'`; else keep or set `partially_fulfillable` / `not_fulfillable`.
  - Optionally clear `order_items.purchase_order_id` / `purchase_order_item_id` when no longer needed, or leave for audit.

### 5.2 Where to call this

- In the same place that today updates PO status / stock on receive (e.g. shipment complete route or warehouse operation complete); add a call to “recompute fulfillability for orders linked to this PO”.

**Phase 5 done when:** Receiving a PO that covers an order’s shortage updates the order to Csomagolható when stock is sufficient.

---

## Phase 6: Begyűjtés (pick batch)

**Goal:** User can create a pick batch from Csomagolható orders, start it (orders → picking), complete it (orders → picked).

### 6.1 DB: pick_batches (or begyujtes)

- **Table:** e.g. `pick_batches`: id, name/code, status (draft, in_progress, completed, cancelled), created_at, started_at, completed_at, created_by, etc.
- **Link:** `pick_batch_orders`: pick_batch_id, order_id (and maybe sort_order). Or denormalize: `orders.pick_batch_id` (nullable).
- **Migration:** New migration file.

### 6.2 APIs

- **Create batch:** POST e.g. `/api/pick-batches` (body: optional name; or create empty).
- **Add/remove orders:** e.g. POST `/api/pick-batches/[id]/orders` (body: order_ids), DELETE for remove. Validate: orders must be status `new` and fulfillability `fully_fulfillable` (Csomagolható).
- **Start batch:** PATCH `/api/pick-batches/[id]` with `status: 'in_progress'`. Set all linked orders’ status to `picking`.
- **Complete batch:** PATCH with `status: 'completed'`. Set all linked orders’ status to `picked`.
- **Cancel/abandon batch:** PATCH with `status: 'cancelled'` (or separate endpoint). Set orders back to `new`.

### 6.3 UI

- **List of batches:** e.g. “Begyűjtések” page or section: table of batches with status, order count, dates.
- **Create batch:** “Új begyűjtés” → select Csomagolható orders (from order list filtered by Új + Csomagolható), add to batch, save.
- **Start / Complete:** On batch detail, buttons “Begyűjtés indítása” and “Begyűjtés kész”; confirm and call API. Orders move picking → picked as above.
- **Order detail:** Show “In batch: &lt;batch name&gt;” when order has `pick_batch_id` or is in a batch; link to batch.

**Phase 6 done when:** User can create a Begyűjtés from Csomagolható orders, start it (orders show Begyűjtés), complete it (orders show Kiszedve); no pack/scan yet.

---

## Phase 7: Packing + scan + auto label / pickup

**Goal:** User packs one order at a time; scans items into box; when all items scanned, system prints shipping label or sends pickup email and sets status to shipped/ready_for_pickup.

### 7.1 Pack screen (per order)

- **Entry:** From order detail when status is `picked` or `verifying` or `packing`; button “Csomagolás” opens pack screen (or dedicated route e.g. `/orders/[id]/pack`).
- **Data:** Load order and order_items (product_id, quantity, product_sku/name for display and scan).
- **UI:** List of lines; for each line, expected qty and “scanned” qty; input or barcode scan to add quantity. When total scanned per line matches order, line marked complete; when all lines complete, “Box complete” enabled.

### 7.2 Box complete action

- **Validation:** All lines have scanned qty = order qty (or allow overage policy if needed).
- **Then:**
  - If shipping method = carrier: call label API (or print endpoint); set `orders.status = 'shipped'`; optionally set `tracking_number`, `shipped_at`.
  - If store pickup: send pickup email (template + customer email); set `orders.status = 'ready_for_pickup'`.
- **One action:** No separate “mark shipped”; pack complete = label/email + status update.

### 7.3 Label and email

- **Label:** Integrate with carrier API (e.g. GLS, MPL) or local print service; or generate PDF and download. Depends on existing integrations.
- **Pickup email:** Use existing email sending (if any) or a simple endpoint that sends “Your order is ready for pickup” to `order.customer_email`.

**Phase 7 done when:** User can pack an order by scanning (or entering) quantities; on box complete, label is printed or pickup email sent and order moves to shipped/ready_for_pickup.

---

## Phase 8: Edge cases and polish

**Goal:** Handle cancellation stock release, optional on-hold, stale batch, returns, and webshop sync as needed.

### 8.1 Cancellation: release stock

- When order status changes to `cancelled` from `picking` / `picked` / `packing`, release any reserved stock for that order’s items (if you have reservation logic). Implement in status-change API or trigger.

### 8.2 On-hold (optional)

- Add flag e.g. `orders.on_hold` (boolean) and optionally `on_hold_reason` (text). When true, exclude order from “Csomagolható” / Begyűjtés selection. Show “Tartás” or “Felfüggesztve” on list and detail. Toggle from order detail.

### 8.3 Stale Begyűjtés

- Allow “Abandon batch” so orders in a batch that was never completed go back to `new`. Optionally: scheduled job that sets batches “in_progress” for > 24h back to cancelled and orders to `new`.

### 8.4 Returns (simple)

- No new status; when customer returns and you process refund, set order to `refunded` (and record in `order_payments`). Optional: small `order_returns` or notes table for “return requested” / “return received” for visibility.

### 8.5 Webshop (ShopRenter) sync

- When order status becomes `shipped`, `delivered`, `cancelled`, `refunded`, optionally call ShopRenter API to update order status so customer and webshop admin see the same. Document which statuses are pushed and error handling.

**Phase 8 done when:** Cancellation releases stock; optional on-hold and stale-batch handling work; returns and sync are documented and implemented to the level you need.

---

## Dependencies and order

```
Phase 1 (status foundation)     ← start here
    ↓
Phase 2 (fulfillability display) ← needs Phase 1 for “Új” and list/detail
Phase 3 (stock check at takeover)
    ↓
Phase 4 (create PO from order)   ← needs Phase 2 + 3 so “Beszerzés alatt” and initial fulfillability exist
Phase 5 (fulfillability after PO receive)
    ↓
Phase 6 (Begyűjtés)              ← needs Phase 1 + 2 (status + Csomagolható)
    ↓
Phase 7 (packing + scan + label) ← needs Phase 1 + 6 (status + picked orders)
    ↓
Phase 8 (edge cases)             ← can be done in parallel or after Phase 7
```

---

## Reference

- Workflow and edge cases: [ORDER_STATUS_WORKFLOW.md](./ORDER_STATUS_WORKFLOW.md)
- Current orders schema: `supabase/migrations/20250130_create_order_management_system.sql`
- Buffer process: `src/app/api/orders/buffer/[id]/process/route.ts`

---

*Last updated: 2025-03. Adjust phases and scope as you implement.*
