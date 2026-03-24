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

---

## Orders: customer company support (20250329)

Run in **tenant** DB after order management and customer persons/companies exist:

| Order | File | Purpose |
|-------|------|---------|
| 1 | **20250329_orders_customer_company.sql** | Add `customer_company_id`, `customer_company_name` to `orders`; make `customer_firstname`/`customer_lastname` nullable |

Prerequisites: `orders`, `customer_companies` tables must exist (from 20250130 and 20250326 migrations).

---

## Optional tenant sample data (connections)

For **dev/demo** seed rows (ShopRenter / Számlázz placeholders), see:

- **`supabase/tenant_sample_webshop_connections.sql`**

Run only after `20250218_create_webshop_connections.sql`. Edit placeholders before running; safe to re-run (Számlázz insert is idempotent by name + type).

---

## Outgoing invoices (20260325) + Kimenő számlák UI (20260328)

Run in **tenant** DB **after** `webshop_connections` and `orders` exist.

| Order | File | Purpose |
|-------|------|---------|
| 1 | **20260325_create_invoices_table.sql** | Table `invoices` + internal invoice numbers + RLS; `connection_id` → Számlázz kapcsolat |
| 2 | **20260328_add_outgoing_invoices_page_to_permissions.sql** | `pages` + `user_permissions`: **Pénzügy → Kimenő számlák** (`/finance/outgoing-invoices`) |

**Admin database:** run the latest migration-list patch so `get_tenant_pending_migrations` stays in sync — currently **`20260328_tenant_migration_list_outgoing_invoices_permissions.sql`** (includes `20260328_add_outgoing_invoices_page_to_permissions` and prior names). Older files such as `20260325_tenant_migration_list_invoices.sql` are superseded by this chain.

Optional sample / notes: **`supabase/tenant_sample_invoices.sql`**.

---

## Fees catalog + order fees (20260329)

Run in **tenant** DB after order management tables already exist.

| Order | File | Purpose |
|-------|------|---------|
| 1 | **20260329_create_fees_tables.sql** | Create `fee_definitions` and `order_fees` tables (+ RLS, indexes, defaults) |
| 2 | **20260329_add_fees_page_to_permissions.sql** | `pages` + `user_permissions`: **Törzsadatok → Rendszer → Díjak** (`/fees`) |

**Admin database:** run **`20260329_tenant_migration_list_fees.sql`** so `get_tenant_pending_migrations` includes both new migration names.

Optional sample / notes: **`supabase/tenant_sample_fees.sql`**.

---

## Durable product sync jobs (20260324)

Run in **tenant** DB **after** `sync_audit_logs` exists (see `20250308_create_sync_audit_logs.sql`).

| Order | File | Purpose |
|-------|------|---------|
| 1 | **20260324_create_sync_jobs.sql** | Table `sync_jobs`: durable progress for ShopRenter → ERP product sync (survives refresh / multiple app instances) |

**Admin database:** also run **`20260324_tenant_migration_list_sync_jobs.sql`** so `get_tenant_pending_migrations` includes this migration name.

Verify:

```sql
SELECT id, status, total_units, synced_units, error_units FROM sync_jobs ORDER BY started_at DESC LIMIT 5;
```

---

## Adatműveletek oldal + beszállító XLSX import/export (20260330)

Run in **tenant** DB:

| Order | File | Purpose |
|-------|------|---------|
| 1 | **20260330_add_data_operations_page_to_permissions.sql** | Adds `/data-operations` to `pages` and grants default `user_permissions` |
| 2 | **20260330_suppliers_short_name_required_unique_code.sql** | Beszállító kód (`short_name`) kötelező + egyedi azonosító az import/export folyamathoz |

**Admin database:** also run **`20260330_tenant_migration_list_data_operations.sql`** so `get_tenant_pending_migrations` includes the new migration name.

Optional checklist / notes:

- **`supabase/tenant_sample_data_operations.sql`**
