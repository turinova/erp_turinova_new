-- Ügyfélrendelés ↔ értékesítés összekötés (átadás = sale, stock csak sale-nél)

-- ---------------------------------------------------------------------------
-- Fej shortcut-ok
-- ---------------------------------------------------------------------------
alter table public.customer_special_orders
  add column if not exists sales_order_id uuid
    references public.sales_orders (id) on delete set null;

comment on column public.customer_special_orders.sales_order_id is
  'Legutóbbi / elsődleges értékesítés az átadáskor (shortcut). Több sale: cso_sale_links.';

create index if not exists customer_special_orders_sales_order_idx
  on public.customer_special_orders (sales_order_id)
  where sales_order_id is not null and deleted_at is null;

alter table public.sales_orders
  add column if not exists customer_special_order_id uuid
    references public.customer_special_orders (id) on delete set null;

comment on column public.sales_orders.customer_special_order_id is
  'Ha az eladás ügyfélrendelés-átadásból jött — lista/szűrő badge.';

create index if not exists sales_orders_cso_id_idx
  on public.sales_orders (tenant_id, customer_special_order_id)
  where customer_special_order_id is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Tétel-szintű nyom (opcionális match)
-- ---------------------------------------------------------------------------
alter table public.sales_order_items
  add column if not exists customer_special_order_item_id uuid
    references public.customer_special_order_items (id) on delete set null;

create index if not exists sales_order_items_cso_item_idx
  on public.sales_order_items (customer_special_order_item_id)
  where customer_special_order_item_id is not null;

-- ---------------------------------------------------------------------------
-- Több részleges átadás → több sale
-- ---------------------------------------------------------------------------
create table if not exists public.cso_sale_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_special_order_id uuid not null
    references public.customer_special_orders (id) on delete cascade,
  sales_order_id uuid not null
    references public.sales_orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (customer_special_order_id, sales_order_id)
);

create index if not exists cso_sale_links_tenant_cso_idx
  on public.cso_sale_links (tenant_id, customer_special_order_id);

create index if not exists cso_sale_links_tenant_sale_idx
  on public.cso_sale_links (tenant_id, sales_order_id);

comment on table public.cso_sale_links is
  'Ügyfélrendelés ↔ értékesítés(ek) — részleges átadásnál több sale.';

alter table public.cso_sale_links enable row level security;

drop policy if exists cso_sale_links_select_member on public.cso_sale_links;
create policy cso_sale_links_select_member
  on public.cso_sale_links for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists cso_sale_links_insert_writer on public.cso_sale_links;
create policy cso_sale_links_insert_writer
  on public.cso_sale_links for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists cso_sale_links_delete_writer on public.cso_sale_links;
create policy cso_sale_links_delete_writer
  on public.cso_sale_links for delete to authenticated
  using (public.can_write_tenant(tenant_id));
