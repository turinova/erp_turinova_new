# Manual SQL migration order (shop-portal tenant DB)

Run these in your **tenant** Supabase SQL Editor in the order below.  
If a migration was already applied, skip it or run only the new ones.

---

## Order to run (payment & shipping mapping feature)

Run in this order. Prerequisites: `webshop_connections`, `payment_methods`, `shipping_methods` (and `update_updated_at_column()` function) must already exist.

| Order | File | Purpose |
|-------|------|---------|
| 1 | **20250327_create_connection_payment_method_mappings.sql** | Table: platform payment code → ERP payment_method_id per connection |
| 2 | **20250327_create_connection_shipping_method_mappings.sql** | Table: platform shipping code → ERP shipping_method_id per connection |

No extra permission migrations: mapping UI lives under the existing `/connections` page.

---

## Phased testing

### Phase 1 – Database only
1. Run the two SQL files above in your tenant DB.
2. In SQL Editor run:
   - `SELECT * FROM connection_payment_method_mappings;`
   - `SELECT * FROM connection_shipping_method_mappings;`
   Both should return 0 rows without errors.

### Phase 2 – APIs
1. Open a connection (e.g. Kapcsolatok), open the ⋮ menu on a ShopRenter connection.
2. Click **Fizetési mód leképezés** → dialog should open and load ERP payment methods and mappings (empty at first).
3. Click **Szállítási mód leképezés** → same for shipping methods and mappings.
4. Add a mapping (platform code + ERP method), save; then delete it. Same for shipping.

### Phase 3 – Buffer process
1. Create at least one payment and one shipping mapping for a connection.
2. Put an order in the buffer (or use test webhook) with `paymentMethodCode` and `shippingMethodExtension` (or `shippingMethodCode`) matching your mapping.
3. Process the buffer entry; the created order should have `payment_method_id` and `shipping_method_id` from the mapping.
4. Optional: remove the mapping and process another order; it should fall back to matching by `payment_methods.code` / `shipping_methods.code` if those match.

### Phase 4 – Shipping methods törzs
1. Open **Törzsadatok → Szállítási módok**. List should load (or be empty).
2. Add a new shipping method (name, code, extension), edit it, then soft-delete if needed.

---

## Full migration order (reference)

For a **new tenant**, run all migrations in chronological order. The 20250327 files must run **after**:
- 20250218_create_webshop_connections.sql
- 20250322_create_payment_methods_table.sql
- 20250130_create_order_management_system.sql (adds payment_methods columns and creates shipping_methods)

So: … (earlier migrations) … → **20250327_create_connection_payment_method_mappings.sql** → **20250327_create_connection_shipping_method_mappings.sql** → (any later migrations).
