# Order packing – implementation plan (done)

This document describes the implemented packing flow (Csomagolás): one order at a time, scan items into box, box complete → shipped or ready_for_pickup.

## Implemented

### 1. DB and migrations (run on tenant DB)

- **20250415_orders_shipped_at.sql** – add `orders.shipped_at` (timestamp when order is shipped).
- **20250415_add_packing_page_to_permissions.sql** – add page `/pack` (Csomagolás) to `pages` and grant to all users.
- **20250415_tenant_migration_list_add_packing.sql** – run on **admin DB** to add the two migration names to `get_tenant_pending_migrations`.

Store pickup is detected via `shipping_methods.requires_pickup_point = true` (no new column).

### 2. API

- **GET /api/orders/[id]/pack** – load order + lines for pack screen. If order is `picked`, sets status to `packing`. Returns order (with `is_pickup`) and lines (order_item_id, product_name, product_sku, product_gtin, internal_barcode, quantity).
- **POST /api/orders/[id]/pack** – body `{ scanned: { [order_item_id]: number } }`. Validates every line has scanned >= quantity; sets status to `shipped` or `ready_for_pickup`; sets `shipped_at` (and optional `tracking_number`) for shipped. Idempotent if order already shipped/ready_for_pickup.
- **GET /api/pack/orders** – list orders with status `picked` or `packing` for the queue page.

### 3. UI

- **Menu** – "Csomagolás" under Rendelések (verticalMenuData), href `/pack`. Filtered by permission `/pack`.
- **Packing queue** – `/pack`: table of orders (picked/packing), link "Csomagolás" → `/pack/orders/[id]`.
- **Pack screen** – `/pack/orders/[id]`: order header, address, progress bar, table of lines (expected vs scanned), scan via document keydown + paste (no visible input). "Csomag kész" enabled when all lines complete; POST complete then redirect to `/pack`.
- **Order detail** – when status is `picked` or `packing`, button "Csomagolás" links to `/pack/orders/[id]`.

### 4. Scan logic (client-side)

- Normalize barcode (trim, strip newlines/spaces). Match line by product_gtin, internal_barcode, or product_sku. First matching line with scanned < quantity gets +1. Wrong item → error message. Line already complete → "Ez a sor már kész." Over-scan: capped at quantity (no increment if already at qty).

### 5. Edge cases

- Order not picked/packing → 400 on GET pack and pack complete.
- Box complete when already shipped/ready_for_pickup → 409, no duplicate update.
- No shipping method or unknown → is_pickup = false (treated as carrier).
- Pickup email / label print: stubbed; status and shipped_at are set. Can be added later (email template, carrier API).

## Run order (manual SQL)

1. **Tenant DB:** run `20250415_orders_shipped_at.sql`, then `20250415_add_packing_page_to_permissions.sql`.
2. **Admin DB (if using tenant migration tracking):** run `20250415_tenant_migration_list_add_packing.sql` so new tenants get these migrations in the list.

## Future (optional)

- Persist pack progress (resume).
- Pickup email on box complete (ready_for_pickup).
- Label print or carrier API for shipped.
- Tracking number input modal after box complete for carrier.
- "Csomagolás megszakítása" (set order back to picked).
