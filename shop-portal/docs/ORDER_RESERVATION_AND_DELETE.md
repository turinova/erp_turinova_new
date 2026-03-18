# Order reservation and delete (stock + UX)

This document describes how we align with common e‑commerce practice (reserve on confirm, cancel = release, soft delete for cleanup) and the exact rules for **reservation at buffer takeover** and **order cancel / delete** on the orders list.

## Alignment with common practice

- **Reserve on order confirmation**  
  Large retailers (Amazon, etc.) allocate/reserve inventory when an order is **confirmed**, so the same stock is not sold twice. In our flow, “take over from buffer” is that confirmation: the order becomes a real order and, if it is fully fulfillable, we reserve stock so “Csomagolható” means reserved quantity, not just available.

- **Cancel = release stock, keep order**  
  Orders are not “deleted” in the sense of removed from the system. The standard is **Cancel**: set status to `cancelled`, release any reserved stock, and keep the order for audit and reporting. Our **Cancel** action does exactly that.

- **Delete = hide from list (soft delete)**  
  “Delete” on the orders list is **soft delete** (`deleted_at`): the order stays in the DB for compliance and reporting but is hidden from the default list. Allowed only for early/terminal statuses; reserved stock is released when present. This matches “remove from my list” / “archive” behaviour without losing data.

## 1. Reservation at buffer takeover

**When:** Right after creating the order from the buffer and setting `fulfillability_status` (POST `/api/orders/buffer/[id]/process`).

**Condition:** Only when `fulfillability_status === 'fully_fulfillable'`. Orders in “Hiány” or “Beszerzés alatt” do not get reservation (stock is not all there yet).

**Actions:**

1. Resolve a **default warehouse** (e.g. first active warehouse) for reservation.
2. For each `order_item` with `product_id` and `quantity`:
   - Insert `stock_movements`: `movement_type = 'reserved'`, `quantity = item.quantity`, `source_type = 'order'`, `source_id = order.id`, `warehouse_id`, `product_id`.
3. Set `orders.stock_reserved = true` and `order_items.reserved_quantity = quantity` (and optionally `order_items.status = 'reserved'`).
4. Call `refresh_stock_summary()` so `quantity_available` / `quantity_reserved` are correct.

**Warehouse:** We use a single default warehouse (first active) for all reservations at takeover. Multi-warehouse allocation can be added later.

**Partial fulfillability:** We do **not** reserve when the order is only partially fulfillable; we reserve only when fully fulfillable. Partial reservation (reserve only the fulfillable part) can be a future enhancement.

## 1b. Reservation when order becomes fully fulfillable after PO receive

**When:** After stock is received for a purchase order (warehouse operation complete or shipment complete), we recompute fulfillability for orders linked to that PO. Any order that **becomes** `fully_fulfillable` and does **not** yet have `stock_reserved` is then reserved.

**Where:**  
- `PUT /api/warehouse-operations/[id]/complete` (after `recomputeFulfillabilityForOrdersLinkedToPOs`)  
- `POST /api/shipments/[id]/complete` (same)  
- `POST /api/orders/[id]/recheck-fulfillability` (manual “Készlet újraellenőrzése”): if the new status is `fully_fulfillable` and the order was not reserved, we reserve.

**Condition:** Only orders that are `fully_fulfillable`, `stock_reserved = false`, and in a **reservable status** (`new`, `picking`, `picked`, `verifying`, `packing`). We do not reserve for `cancelled`, `shipped`, `delivered`, etc.

**Edge cases:**  
- **No double reserve:** We only reserve when `stock_reserved = false`.  
- **Reserve failure:** If `reserveStockForOrder` fails for one order (e.g. no warehouse), we log and continue; the complete operation still succeeds.  
- **Multiple orders:** We reserve for each qualifying order; then call `refresh_stock_summary()` once. If several orders share the same scarce stock, they are all marked reservable from the same pre-reserve snapshot; in rare cases this can over-allocate. Serial reserve+refresh per order would avoid that at the cost of extra refreshes.

## 2. Cancel order (status → cancelled)

**Where:** Order detail (status dropdown) and orders list (row action “Megszüntetés” / Cancel).

**Rule:** Allowed only from statuses that already allow transition to `cancelled`: `new`, `picking`, `picked`, `verifying`, `packing` (see `ALLOWED_NEXT_STATUS` in `order-status.ts`).

**Actions when status is changed to `cancelled`:**

1. If `orders.stock_reserved === true`: call **release reserved stock** for this order (see below).
2. Update `orders.status = 'cancelled'` (and trigger writes `order_status_history`).
3. Set `orders.stock_reserved = false` and `order_items.reserved_quantity = 0` for all items of this order.

**Implementation:** PATCH `/api/orders/[id]` when `body.status === 'cancelled'`: first release reserved stock (if any), then apply the status update.

## 3. Release reserved stock (shared logic)

Used when **cancelling** an order or when **soft-deleting** an order that had reserved stock.

**Logic:**

1. Find all `stock_movements` where `source_type = 'order'`, `source_id = order.id`, `movement_type = 'reserved'`.
2. For each such row, insert a `stock_movements` row with `movement_type = 'released'`, same `warehouse_id`, `product_id`, and `quantity` (positive), `source_type = 'order'`, `source_id = order.id`.
3. Set `orders.stock_reserved = false` and `order_items.reserved_quantity = 0` for that order.
4. Call `refresh_stock_summary()`.

Reserved and released quantities are balanced so `stock_summary.quantity_reserved` and `quantity_available` stay correct.

## 3b. Consume on ship / deliver (release reservation + post outbound)

**When:** Order status is set to `shipped` (handed to carrier) or `delivered` (customer collected).

**Where:**  
- `POST /api/dispatch/carrier/mark-shipped` (each order set to shipped)  
- `POST /api/dispatch/pickup/mark-delivered` (each order set to delivered)  
- `PATCH /api/orders/[id]` when `body.status` is `shipped` or `delivered`

**Logic (idempotent):** If `stock_movements` already has `movement_type = 'out'` for this order, skip. Otherwise:

1. Insert `released` for each reserved movement (same as cancel).
2. Insert `out` for each order item with `product_id` (quantity positive; warehouse from reserved row for that product or default warehouse). This reduces `quantity_on_hand`.
3. Set `orders.stock_reserved = false` and `order_items.reserved_quantity = 0`.
4. Call `refresh_stock_summary()`.

**Edge cases:** Order never reserved → only `out` from order_items (default warehouse). No product_id items → skipped. Double submit → skip when `out` already exists.

## 4. Delete order (soft delete from list)

**Meaning:** Set `orders.deleted_at` (and optionally `order_items.deleted_at`). The order is hidden from the default list (`WHERE deleted_at IS NULL`) but remains in the DB.

**Allowed statuses for delete:** `pending_review`, `new`, `cancelled`, `refunded`.  
We do **not** allow delete for `picking`, `picked`, `verifying`, `packing`, `shipped`, `ready_for_pickup`, `delivered` (order is in progress or already fulfilled; use Cancel first if applicable).

**Actions when deleting:**

1. If `orders.stock_reserved === true`: release reserved stock (same as above).
2. Set `orders.deleted_at = NOW()` (and optionally `order_items.deleted_at` for consistency).
3. Call `refresh_stock_summary()` if we released stock.

**API:** `DELETE /api/orders/[id]` returns 400 if status is not in the allowed set; otherwise performs the steps above.

**UI:** On the orders list, show “Eltávolítás a listából” (or “Törlés”) only for orders whose status is in the deletable set. After success, refresh the list.

## 5. Summary table

| Action        | When allowed                    | Stock effect              | Order record      |
|---------------|----------------------------------|---------------------------|-------------------|
| Reserve       | At buffer takeover, fully fulfillable; or after PO receive / recheck when order becomes fully fulfillable and not yet reserved | Creates `reserved` movements | `stock_reserved = true` |
| Cancel        | From new / picking / picked / verifying / packing | Release reserved          | status = cancelled, kept |
| Ship/Deliver  | awaiting_carrier → shipped, or ready_for_pickup → delivered, or PATCH status to shipped/delivered | Release reserved + create `out` (reduce on_hand) | status = shipped or delivered |
| Delete (soft) | pending_review, new, cancelled, refunded | Release reserved if any   | deleted_at set, kept in DB |

## 6. References

- Order status workflow: `docs/ORDER_STATUS_WORKFLOW.md`
- Fulfillment plan: `docs/ORDER_FULFILLMENT_IMPLEMENTATION_PLAN.md`
- Schema: `orders.stock_reserved`, `order_items.reserved_quantity`, `stock_movements` (`reserved` / `released`, `source_type` / `source_id`)
- Lib: `src/lib/order-reservation.ts` (reserve, release, consumeReservedAndPostOutbound), `src/lib/order-fulfillability.ts` (fulfillability, `getOrderIdsToReserveLinkedToPOs`)
