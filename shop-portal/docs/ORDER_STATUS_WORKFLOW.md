# Order status and fulfillment workflow

This document describes the order lifecycle, status flow, and fulfillment concepts (Begyűjtés, Ellenőrzés, Csomagolás) so the team can implement and reference a consistent, user-friendly flow.

---

## 1. Goals

- **User-friendly:** Few, clear statuses; one obvious “next step” per screen.
- **Descriptive:** Enough states to know where every order is (Új → Begyűjtés → … → Kézbesítve).
- **Industry-aligned:** Batch picking → verify → pack with scan → auto label/pickup (same pattern as major e‑com ERPs).
- **Stock-aware:** At takeover, show **Hiány** (shortage) or **Csomagolható** (ready to pick) from stock/fulfillability; no extra status for the user to choose.

---

## 2. Concepts

### 2.1 Order status (lifecycle)

Single pipeline per order. One value per order at any time.

| DB value           | Hungarian (UI) | Meaning |
|-------------------|----------------|--------|
| `new`             | Új             | Order taken over from buffer. Stock check done; UI shows **Hiány** or **Csomagolható** from fulfillability. |
| `picking`         | Begyűjtés      | Order is in an active **Begyűjtés** (pick batch). Picker is (or will be) walking the warehouse for this batch. |
| `picked`          | Kiszedve       | Batch finished; items are at packing area. Not yet verified. |
| `verifying`       | Ellenőrzés     | User is checking/confirming picked items. Optional step; can be merged with Kiszedve. |
| `packing`         | Csomagolás     | User is packing this order (e.g. scanning items into box). One order at a time. |
| `awaiting_carrier`| Futárra vár    | (Carrier) Box complete, label printed or to be printed; parcel not yet handed to carrier. |
| `shipped`         | Átadva / Úton  | Parcel handed to carrier / in transit. |
| `ready_for_pickup`| Személyes átvételre vár | (Store pickup) Ready for customer to collect. |
| `delivered`       | Kézbesítve     | Customer has it (carrier confirmed or picked up). |
| `cancelled`       | Törölve        | Order cancelled. |
| `refunded`        | Visszatérítve  | Refunded after delivery. |

### 2.2 Hiány / Beszerzés alatt / Csomagolható (not statuses)

- **Computed from:** `orders.fulfillability_status` (and stock check at buffer takeover).
- **When:** Shown only for orders in status **Új** (`new`).

| fulfillability_status   | Display (HU)      | Meaning |
|--------------------------|-------------------|--------|
| `not_fulfillable` or `partially_fulfillable` | **Hiány**         | Shortage: need to create/link a PO or wait for stock before picking. |
| `po_created`             | **Beszerzés alatt** | Shortage already covered: a PO was created or linked for this order; waiting for goods to arrive. |
| `fully_fulfillable`      | **Csomagolható**  | All items in stock; ready to add to a Begyűjtés and pick. |

User does **not** select these; the system displays them. When the user creates a PO from an order’s shortage (or links the order to a PO), the system should set `orders.fulfillability_status` to `po_created` (and link `order_items.purchase_order_id` / `purchase_order_item_id` where applicable). When the PO is received and stock is updated, re-run the stock check and set fulfillability to `fully_fulfillable` so the order becomes **Csomagolható**.

### 2.3 Begyűjtés (pick batch)

- **What:** One “pick run” that can include **multiple orders**.
- **Flow:** User creates/starts a Begyűjtés → orders in it get status **Begyűjtés** (`picking`) → user walks warehouse and collects items → back to computer → closes batch → those orders move to **Kiszedve** (`picked`).
- **Implementation:** Separate entity (e.g. `pick_batches` or `begyujtes`) with state (draft, in_progress, completed); orders reference the batch or are linked via a join table. Order status is still the single source of truth for “where is this order” in the pipeline.

---

## 3. Status flow (allowed transitions)

```
  [Buffer takeover]
        │
        ▼
   ┌─────────┐
   │   Új    │  (new)  ←── Hiány / Csomagolható shown here
   └────┬────┘
        │ add to Begyűjtés & start batch
        ▼
   ┌─────────────┐
   │ Begyűjtés   │  (picking)
   └──────┬──────┘
          │ batch completed
          ▼
   ┌─────────────┐
   │  Kiszedve   │  (picked)
   └──────┬──────┘
          │ optional: Ellenőrzés
          ▼
   ┌─────────────┐     ┌─────────────┐
   │ Ellenőrzés  │ ──► │  Csomagolás  │  (packing)
   │ (verifying) │     └──────┬───────┘
   └─────────────┘            │
          │                    │ last item scanned → box complete
          └────────────────────┤
                               ▼
                    ┌──────────────────────┐
                    │ Átadva / Átvehető     │  (shipped / ready_for_pickup)
                    │ auto label or email   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Kézbesítve        │  (delivered)
                    └──────────────────────┘

  Cancellation: Új | Begyűjtés | Kiszedve | Ellenőrzés | Csomagolás → Törölve (cancelled)
  Refund:       Kézbesítve → Visszatérítve (refunded)
```

### Allowed next statuses (for validation)

| From        | To |
|------------|----|
| `new`      | `picking`, `cancelled` |
| `picking`  | `picked`, `cancelled` |
| `picked`   | `verifying`, `packing`, `cancelled` |
| `verifying`| `packing`, `cancelled` |
| `packing`  | `shipped`, `ready_for_pickup`, `cancelled` |
| `shipped`  | `delivered` |
| `ready_for_pickup` | `delivered` |
| `delivered`| `refunded` |
| `cancelled`| — (terminal) |
| `refunded` | — (terminal) |

---

## 4. Pack complete = one system action

When the user has scanned all items for an order into the box (or otherwise confirms “box complete”):

1. **Shipping:** Automatically print shipping label (or send to carrier API); set status to `shipped`.
2. **Store pickup:** Automatically send pickup email to customer; set status to `ready_for_pickup` (or `shipped` if you treat both as “left warehouse”).

No separate “mark as packed” then “mark as shipped” — one action at box complete keeps the flow simple and avoids errors.

---

## 5. Edge cases: cancellation and returns

### 5.1 Cancellation

**When cancellation is allowed (order status → `cancelled`):**

- From: `new`, `picking`, `picked`, `verifying`, `packing` only.
- Not from: `shipped`, `ready_for_pickup`, `delivered` (use return/refund flow instead).

**Rules:**

- **Payment:** If the order was already paid, cancelling should trigger or link to a **refund** (money back). That can be handled in `order_payments` (e.g. negative amount or refund record) and `payment_status`; the order status stays `cancelled`.
- **Stock:** When cancelling an order that was already `picking`/`picked`/`packing`, consider whether reserved stock should be **released** back to available (so other orders can use it). If you have reservation logic, add a step on transition to `cancelled`: release reserved quantity for all items.
- **Partial cancellation:** Cancelling only some items (reduce quantity or remove a line) is a different feature: keep the order open, update items and totals, and only move to `cancelled` when the **entire** order is cancelled. If you support “partial cancel”, the order can stay in e.g. `new`/`packing` with fewer items; when the last line is cancelled, then set status to `cancelled`.
- **Cancel after shipped:** Once status is `shipped` or `ready_for_pickup`, do **not** use “cancel” for “customer changed mind”. Use a **return** flow (see below). If you need “recall from carrier”, that is an operational exception (carrier API or manual); the order can later move to `cancelled` or stay `shipped` with an internal note “recalled”. For simplicity, keep: **no transition from `shipped`/`ready_for_pickup` to `cancelled`** in the standard flow; returns go through “return received” → refund.

**Summary:** Cancellation = only from pre-ship statuses; handle refund and stock release when applicable; no cancel-from-shipped in the main flow.

---

### 5.2 Returns (post-delivery)

**Typical return flow:**

1. Order is **delivered**.
2. Customer requests return → you may track this as **return requested** (optional status or separate return request).
3. Customer sends goods back → **return received** (optional status or event).
4. You process refund and possibly restock → order moves to **refunded**.

**Options:**

- **Simple (minimal statuses):** Keep only `delivered` and `refunded`. “Return requested” and “return received” are just **notes**, **internal flags**, or a separate **returns** table (e.g. `order_returns`: order_id, status, received_at, refunded_at). Order status goes `delivered` → `refunded` when you complete the refund. No new order status values.
- **Explicit (more statuses):** Add `return_requested` and/or `return_received` so the order clearly shows “waiting for return” or “return in warehouse”. Then: `delivered` → `return_requested` → `return_received` → `refunded`. Better for reporting and for warehouse (e.g. “receive return” screen); more statuses to maintain and validate.

**Recommendation for “plug and play”:** Start **simple**: order stays `delivered` until you record the refund, then move to `refunded`. Use a small **return request** table or notes to record “customer asked for return” and “we received the goods”; optionally link a **refund payment** (negative amount in `order_payments`). Add `return_requested` / `return_received` later if you need them in filters and reports.

**Partial return:** Customer sends back only some items. Options: (a) one order can have **partial refund** (order stays `delivered`, `payment_status` = partial or paid with a refund record for part of the amount); (b) or you treat “partial return” as a separate process (e.g. credit note, new RMA) and only use `refunded` when the **whole** order is fully refunded. Document which rule you use.

**Exchange:** Customer returns one item and gets another. Often modeled as: return (refund or credit) + new order (new order_id). Keep the original order as `delivered` → `refunded` (or partial refund); the replacement is a new order. No need for an “exchange” status on the original order.

---

### 5.3 Allowed transitions (updated with edge cases)

| From        | To |
|------------|----|
| `new`      | `picking`, `cancelled` |
| `picking`  | `picked`, `cancelled` |
| `picked`   | `verifying`, `packing`, `cancelled` |
| `verifying`| `packing`, `cancelled` |
| `packing`  | `shipped`, `ready_for_pickup`, `cancelled` |
| `shipped`  | `delivered` *(no cancel; use return if needed)* |
| `ready_for_pickup` | `delivered` *(no cancel; use return if needed)* |
| `delivered`| `refunded` *(optionally via return_requested / return_received later)* |
| `cancelled`| — (terminal) |
| `refunded` | — (terminal) |

**No transition:** `shipped` or `ready_for_pickup` → `cancelled`. Use return + refund instead.

---

### 5.4 More edge cases

Other situations to consider (policy or future features):

| Edge case | What happens | Recommendation |
|-----------|----------------|-----------------|
| **Cancel order that is in a Begyűjtés** | Order is in batch; we cancel the order. | Remove order from the batch; move status to `cancelled`. If items were already picked for that order, release them (put back to stock or mark batch as “partial” for that order). |
| **On-hold / hold** | Customer or staff wants “don’t ship yet” (payment check, address check, fraud). | Option A: keep order in `new` and set a flag e.g. `on_hold` / `hold_reason` so it doesn’t appear in “ready to pick” until released. Option B: add status `on_hold` (from `new` only; release → back to `new`). Start with a flag to keep status list short. |
| **Backorder** | We accept order even when not all in stock; ship when stock arrives. | Order stays in `new` with Hiány until fulfillability is full (e.g. after PO received). No extra status; “backorder” = order in `new` + not Csomagolható. Optionally filter “backorder” = new + partial/not_fulfillable. |
| **Stale Begyűjtés** | Batch was started but never completed (picker left, forgot). Orders stuck in `picking`. | Allow “abandon batch” or “cancel batch”: batch marked failed/cancelled; all orders in it go back to `new` (and release any reserved stock). Consider auto-timeout (e.g. after 24 h) to revert to `new` if batch not completed. |
| **Edit order after picking started** | Need to add/remove item after order is in `picking` or `picked`. | Policy: block line changes once status is `picking` or later; or allow only with “unpick” (order back to `new`, re-run stock check, then can edit and re-add to a new batch). Document which rule you use. |
| **Split shipment** | One order, multiple parcels (ship part now, rest later). | Option A: track parcels in a `shipments` table; order status = `shipped` when at least one parcel shipped, `delivered` when all parcels delivered. Option B: add `partially_shipped` if you need it in filters. Start with “one order = one shipment” for simplicity; add split later. |
| **Lost in transit / never delivered** | Parcel shipped but carrier says lost or customer never got it. | Keep `shipped` until decision: then either (a) resend (new shipment, same order) or (b) refund → `refunded`. No “lost” status needed; handle via note + refund or reship. |
| **Payment failed after pack** | Order packed, then payment bounces or chargeback. | Don’t ship; move order to `cancelled` (or an “on_hold” state) and release stock. If already shipped, handle as dispute/chargeback (refund or fight); order can go to `refunded`. |
| **Store pickup: customer never collects** | Order is `ready_for_pickup` but customer doesn’t come. | Policy: after X days (e.g. 7–14), auto or manual move to `cancelled` and restock; optionally refund. No new status; use a job or manual step “expire pickup orders”. |
| **Duplicate order** | Same order created twice from buffer or manually. | Prevent in buffer (unique platform_order_id); if duplicate exists, cancel one and keep the other. No status change; operational cleanup. |
| **Wrong item shipped** | Customer gets wrong product. | Handle as return (customer sends back) + correct item sent (new shipment or new order). Original order can go to `refunded` or stay `delivered` with partial refund; correction is separate shipment/order. |
| **Sync with webshop (ShopRenter)** | We change status in ERP; should we push to webshop? | When we set `shipped` / `delivered` / `cancelled` / `refunded`, optionally call platform API to update order status so customer and webshop admin see the same. Document sync rules (which statuses push, when). |
| **Draft / quote** | Order not yet confirmed (quote, draft). | If needed: keep as `pending_review` or add `draft`; only move to `new` when “confirmed”. Current flow: buffer → `new`; manual orders can start as `new` or `pending_review`. |

---

## 6. Current schema vs this workflow

- **Existing `orders.status`** (from migration): `pending_review`, `new`, `packing`, `shipped`, `delivered`, `cancelled`, `refunded`.
- **To support this workflow we need:** Add `picking`, `picked`, `verifying`, and optionally `ready_for_pickup` to the DB constraint and to the UI.
- **Fulfillability:** Already in schema as `orders.fulfillability_status` (includes `po_created`); use it to drive **Hiány** / **Beszerzés alatt** / **Csomagolható** on Új.
- **Beszerzés alatt (po_created):** Schema is ready (`fulfillability_status = 'po_created'`; `order_items.purchase_order_id` / `purchase_order_item_id` for linking to PO lines). **Not yet implemented:** (1) Setting `fulfillability_status` to `po_created` when user creates or links a PO to the order, (2) Displaying “Beszerzés alatt” in the order list/detail. Plan: when implementing “create PO from order shortage” (or “link order to PO”), set order/items fulfillability and PO links; in UI show three badges for Új: Hiány, Beszerzés alatt, Csomagolható.
- **Begyűjtés:** New entity (table + APIs + UI) for pick batches; orders get `picking` when in an active batch and `picked` when batch is completed.

---

## 7. References

- Order table and status constraint: `supabase/migrations/20250130_create_order_management_system.sql`
- Order status history: same migration, `order_status_history` table and `record_order_status_change` trigger
- Buffer process (sets initial status `new`): `src/app/api/orders/buffer/[id]/process/route.ts`
- UI labels today: `src/app/(dashboard)/orders/OrdersTableBody.tsx`, `OrderDetailForm.tsx`

---

*Last updated: 2025-03 (workflow design). Adjust DB and APIs as implementation progresses.*
