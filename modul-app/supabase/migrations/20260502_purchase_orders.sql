-- Beszállítói rendelések (PO) — csak termékek (accessories)
-- Státusz: draft → ordered → partial → received | cancelled
-- Beérkezés (receipt) későbbi migráció; partial/received a receive RPC állítja majd

-- ---------------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,

  po_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'partial', 'received', 'cancelled')),

  expected_date date,
  note text,
  currency text not null default 'HUF'
    check (currency in ('HUF', 'EUR', 'USD')),

  email_sent boolean not null default false,
  email_sent_at timestamptz,

  ordered_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists purchase_orders_tenant_alive_idx
  on public.purchase_orders (tenant_id)
  where deleted_at is null;

create unique index if not exists purchase_orders_tenant_number_alive_uidx
  on public.purchase_orders (tenant_id, po_number)
  where deleted_at is null;

create index if not exists purchase_orders_tenant_status_alive_idx
  on public.purchase_orders (tenant_id, status)
  where deleted_at is null;

create index if not exists purchase_orders_supplier_alive_idx
  on public.purchase_orders (supplier_id)
  where deleted_at is null;

alter table public.purchase_orders enable row level security;

drop policy if exists purchase_orders_select_member on public.purchase_orders;
create policy purchase_orders_select_member
  on public.purchase_orders
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists purchase_orders_insert_writer on public.purchase_orders;
create policy purchase_orders_insert_writer
  on public.purchase_orders
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists purchase_orders_update_writer on public.purchase_orders;
create policy purchase_orders_update_writer
  on public.purchase_orders
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists purchase_orders_delete_writer on public.purchase_orders;
create policy purchase_orders_delete_writer
  on public.purchase_orders
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.purchase_orders is
  'Beszállítói rendelések — termék (accessory) tételekkel.';

-- ---------------------------------------------------------------------------
-- purchase_order_items
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,

  accessory_id uuid not null references public.accessories (id) on delete restrict,

  name_snapshot text not null,
  sku_snapshot text not null,

  quantity numeric(12, 3) not null check (quantity > 0),
  net_price numeric(12, 0) not null check (net_price >= 0),

  tax_rate_id uuid not null references public.tax_rates (id) on delete restrict,
  tax_rate_percent numeric(5, 2) not null check (tax_rate_percent >= 0 and tax_rate_percent <= 100),
  unit_id uuid not null references public.units (id) on delete restrict,
  unit_shortform text not null,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists purchase_order_items_po_alive_idx
  on public.purchase_order_items (purchase_order_id)
  where deleted_at is null;

create unique index if not exists purchase_order_items_po_accessory_alive_uidx
  on public.purchase_order_items (purchase_order_id, accessory_id)
  where deleted_at is null;

alter table public.purchase_order_items enable row level security;

drop policy if exists purchase_order_items_select_member on public.purchase_order_items;
create policy purchase_order_items_select_member
  on public.purchase_order_items
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists purchase_order_items_insert_writer on public.purchase_order_items;
create policy purchase_order_items_insert_writer
  on public.purchase_order_items
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists purchase_order_items_update_writer on public.purchase_order_items;
create policy purchase_order_items_update_writer
  on public.purchase_order_items
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists purchase_order_items_delete_writer on public.purchase_order_items;
create policy purchase_order_items_delete_writer
  on public.purchase_order_items
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.purchase_order_items is
  'PO tételek — accessory FK + ár/név snapshot; egy accessory / PO (duplikátum qty merge).';

-- ---------------------------------------------------------------------------
-- PO number: BR-YYYY-NNN
-- ---------------------------------------------------------------------------
create or replace function public.generate_purchase_order_number(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year integer;
  next_number integer;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id required';
  end if;

  if not public.can_write_tenant(p_tenant_id) then
    raise exception 'not allowed';
  end if;

  current_year := extract(year from now())::integer;

  select coalesce(max(
    cast(
      substring(po_number from length('BR-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.purchase_orders
  where tenant_id = p_tenant_id
    and po_number like 'BR-' || current_year::text || '-%'
    and deleted_at is null;

  return 'BR-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_purchase_order_number(uuid) from public;
grant execute on function public.generate_purchase_order_number(uuid) to authenticated;

comment on function public.generate_purchase_order_number(uuid) is
  'Tenant-scoped beszállítói rendelésszám: BR-YYYY-NNN.';

-- ---------------------------------------------------------------------------
-- Page feature + Alap + backfill
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beszallitoi-rendelesek',
  'Beszállítói rendelések',
  'Beszerzés',
  '/beszallitoi-rendelesek',
  46,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/beszallitoi-rendelesek'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/beszallitoi-rendelesek'
from public.tenants t
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  m.tenant_id,
  m.id,
  '/beszallitoi-rendelesek',
  true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
