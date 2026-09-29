-- Ügyfélrendelés (special order) — Alap plan
-- Display: Felvéve → Rendelve → Itt van → Átadva

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.customer_special_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_number text not null,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text not null,
  customer_mobile text not null,
  status text not null default 'felveve'
    check (status in ('felveve', 'rendelve', 'itt_van', 'atadva', 'torolve')),
  deposit_amount numeric(12, 2),
  promised_date date,
  sms_sent_at timestamptz,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, order_number)
);

create index if not exists customer_special_orders_tenant_created_idx
  on public.customer_special_orders (tenant_id, created_at desc)
  where deleted_at is null;

create table if not exists public.customer_special_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id uuid not null
    references public.customer_special_orders (id) on delete cascade,
  name text not null,
  qty numeric(12, 3) not null check (qty > 0),
  unit_id uuid references public.units (id) on delete set null,
  unit_shortform text not null default 'db',
  accessory_id uuid references public.accessories (id) on delete set null,
  material_id uuid references public.sheet_materials (id) on delete set null,
  linear_material_id uuid references public.linear_materials (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  status text not null default 'felveve'
    check (status in ('felveve', 'rendelve', 'itt_van', 'atadva', 'torolve')),
  purchase_order_item_id uuid
    references public.purchase_order_items (id) on delete set null,
  reserved_qty numeric(12, 3),
  reserved_at timestamptz,
  warehouse_id uuid references public.warehouses (id) on delete set null,
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint customer_special_order_items_one_catalog check (
    (
      (accessory_id is not null)::int
      + (material_id is not null)::int
      + (linear_material_id is not null)::int
    ) <= 1
  )
);

create index if not exists customer_special_order_items_order_idx
  on public.customer_special_order_items (order_id)
  where deleted_at is null;

create index if not exists customer_special_order_items_tenant_status_idx
  on public.customer_special_order_items (tenant_id, status)
  where deleted_at is null;

create index if not exists customer_special_order_items_po_item_idx
  on public.customer_special_order_items (purchase_order_item_id)
  where purchase_order_item_id is not null and deleted_at is null;

comment on table public.customer_special_orders is
  'Ügyfélrendelés fej — bolt special order (nincs polcon).';
comment on table public.customer_special_order_items is
  'Ügyfélrendelés tételek — korlátlan; PO link + foglalás.';

-- ---------------------------------------------------------------------------
-- Order number UR-YYYY-NNN
-- ---------------------------------------------------------------------------
create or replace function public.generate_customer_special_order_number(p_tenant_id uuid)
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
      substring(order_number from length('UR-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.customer_special_orders
  where tenant_id = p_tenant_id
    and order_number like 'UR-' || current_year::text || '-%'
    and deleted_at is null;

  return 'UR-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_customer_special_order_number(uuid) from public;
grant execute on function public.generate_customer_special_order_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Header status from items
-- ---------------------------------------------------------------------------
create or replace function public.recompute_customer_special_order_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select case
    when not exists (
      select 1 from public.customer_special_order_items i
      where i.order_id = p_order_id and i.deleted_at is null and i.status <> 'torolve'
    ) then 'torolve'
    when exists (
      select 1 from public.customer_special_order_items i
      where i.order_id = p_order_id and i.deleted_at is null and i.status = 'felveve'
    ) then 'felveve'
    when exists (
      select 1 from public.customer_special_order_items i
      where i.order_id = p_order_id and i.deleted_at is null and i.status = 'rendelve'
    ) then 'rendelve'
    when exists (
      select 1 from public.customer_special_order_items i
      where i.order_id = p_order_id and i.deleted_at is null and i.status = 'itt_van'
    ) then 'itt_van'
    when exists (
      select 1 from public.customer_special_order_items i
      where i.order_id = p_order_id and i.deleted_at is null and i.status = 'atadva'
    ) then 'atadva'
    else 'torolve'
  end
  into v_status;

  update public.customer_special_orders
  set status = v_status, updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.trg_customer_special_order_items_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_customer_special_order_status(
    coalesce(new.order_id, old.order_id)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists customer_special_order_items_recompute_trg
  on public.customer_special_order_items;
create trigger customer_special_order_items_recompute_trg
  after insert or update or delete on public.customer_special_order_items
  for each row
  execute function public.trg_customer_special_order_items_recompute();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.customer_special_orders enable row level security;
alter table public.customer_special_order_items enable row level security;

drop policy if exists cso_select_member on public.customer_special_orders;
create policy cso_select_member
  on public.customer_special_orders for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists cso_insert_writer on public.customer_special_orders;
create policy cso_insert_writer
  on public.customer_special_orders for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists cso_update_writer on public.customer_special_orders;
create policy cso_update_writer
  on public.customer_special_orders for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists csoi_select_member on public.customer_special_order_items;
create policy csoi_select_member
  on public.customer_special_order_items for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists csoi_insert_writer on public.customer_special_order_items;
create policy csoi_insert_writer
  on public.customer_special_order_items for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists csoi_update_writer on public.customer_special_order_items;
create policy csoi_update_writer
  on public.customer_special_order_items for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Stock source_type: customer_special_order
-- ---------------------------------------------------------------------------
alter table public.stock_movements
  drop constraint if exists stock_movements_source_type_check;

alter table public.stock_movements
  add constraint stock_movements_source_type_check
  check (
    source_type in (
      'purchase_receipt',
      'adjustment',
      'sale',
      'transfer',
      'sale_return',
      'customer_special_order'
    )
  );

-- ---------------------------------------------------------------------------
-- After goods receipt: mark linked special-order items as itt_van + reserve
-- ---------------------------------------------------------------------------
create or replace function public.mark_special_order_items_arrived_for_receipt(
  p_receipt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct csoi.id, csoi.qty, gr.warehouse_id
    from public.goods_receipt_items gri
    join public.goods_receipts gr on gr.id = gri.goods_receipt_id
    join public.customer_special_order_items csoi
      on csoi.purchase_order_item_id = gri.purchase_order_item_id
     and csoi.deleted_at is null
     and csoi.status = 'rendelve'
    where gri.goods_receipt_id = p_receipt_id
      and gri.quantity_received > 0
      and gri.purchase_order_item_id is not null
  loop
    update public.customer_special_order_items
    set
      status = 'itt_van',
      reserved_qty = r.qty,
      reserved_at = now(),
      warehouse_id = coalesce(warehouse_id, r.warehouse_id),
      updated_at = now()
    where id = r.id;
  end loop;
end;
$$;

-- Hook into receive_goods_receipt if we can wrap — call from app after receive instead
-- (RPC receive_goods_receipt is large). App layer calls this after successful receive.

-- ---------------------------------------------------------------------------
-- Feature + Alap + backfill
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values
  (
    'customer_special_orders',
    'Ügyfélrendelések',
    'Értékesítés',
    '/ugyfelrendelesek',
    42,
    true
  ),
  (
    '/ugyfelrendelesek',
    'Ügyfélrendelések',
    'Értékesítés',
    '/ugyfelrendelesek',
    43,
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
select p.id, v.feature_key
from public.product_plans p
cross join (
  values ('customer_special_orders'), ('/ugyfelrendelesek')
) as v(feature_key)
where p.key = 'alap'
  and exists (select 1 from public.product_features f where f.key = v.feature_key)
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, v.feature_key
from public.tenants t
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
cross join (
  values ('customer_special_orders'), ('/ugyfelrendelesek')
) as v(feature_key)
on conflict do nothing;

-- Also grant to all tenants (beszerzés style) so non-alap plans with custom grants work
insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, v.feature_key
from public.tenants t
cross join (
  values ('customer_special_orders'), ('/ugyfelrendelesek')
) as v(feature_key)
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/ugyfelrendelesek', true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
