-- Beérkezések (goods receipts) + készletnapló + receive RPC
-- UI: /beerkezesek — N beérkezés / PO; max 1 checking / PO

-- ---------------------------------------------------------------------------
-- stock_movements (ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,

  product_type text not null default 'accessory'
    check (product_type in ('accessory')),
  accessory_id uuid not null references public.accessories (id) on delete restrict,

  quantity numeric(14, 3) not null check (quantity > 0),
  movement_type text not null check (movement_type in ('in', 'out')),
  source_type text not null
    check (source_type in ('purchase_receipt', 'adjustment', 'sale', 'transfer')),
  source_id uuid,

  unit_cost_net numeric(12, 0),
  note text,
  stock_movement_number text not null,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_tenant_created_idx
  on public.stock_movements (tenant_id, created_at desc);

create index if not exists stock_movements_accessory_wh_idx
  on public.stock_movements (tenant_id, accessory_id, warehouse_id);

create index if not exists stock_movements_source_idx
  on public.stock_movements (source_type, source_id);

create unique index if not exists stock_movements_tenant_number_uidx
  on public.stock_movements (tenant_id, stock_movement_number);

alter table public.stock_movements enable row level security;

drop policy if exists stock_movements_select_member on public.stock_movements;
create policy stock_movements_select_member
  on public.stock_movements
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists stock_movements_insert_writer on public.stock_movements;
create policy stock_movements_insert_writer
  on public.stock_movements
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

-- Nincs update/delete policy — ledger immmutable (korrekció = új mozgás)

comment on table public.stock_movements is
  'Készletnapló — SUM(in)-SUM(out) = készlet. Bevételezés forrása: purchase_receipt.';

-- ---------------------------------------------------------------------------
-- goods_receipts
-- ---------------------------------------------------------------------------
create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,

  receipt_number text not null,
  status text not null default 'checking'
    check (status in ('checking', 'received', 'cancelled')),

  note text,
  received_at timestamptz,
  received_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists goods_receipts_tenant_alive_idx
  on public.goods_receipts (tenant_id)
  where deleted_at is null;

create unique index if not exists goods_receipts_tenant_number_alive_uidx
  on public.goods_receipts (tenant_id, receipt_number)
  where deleted_at is null;

create index if not exists goods_receipts_po_alive_idx
  on public.goods_receipts (purchase_order_id)
  where deleted_at is null;

create index if not exists goods_receipts_tenant_status_alive_idx
  on public.goods_receipts (tenant_id, status)
  where deleted_at is null;

-- Max 1 checking beérkezés / PO
create unique index if not exists goods_receipts_one_checking_per_po_uidx
  on public.goods_receipts (purchase_order_id)
  where status = 'checking' and deleted_at is null;

alter table public.goods_receipts enable row level security;

drop policy if exists goods_receipts_select_member on public.goods_receipts;
create policy goods_receipts_select_member
  on public.goods_receipts
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists goods_receipts_insert_writer on public.goods_receipts;
create policy goods_receipts_insert_writer
  on public.goods_receipts
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists goods_receipts_update_writer on public.goods_receipts;
create policy goods_receipts_update_writer
  on public.goods_receipts
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists goods_receipts_delete_writer on public.goods_receipts;
create policy goods_receipts_delete_writer
  on public.goods_receipts
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.goods_receipts is
  'Beérkezések — fizikai áru számolása PO ellen. UI: Beérkezések.';

-- ---------------------------------------------------------------------------
-- goods_receipt_items
-- ---------------------------------------------------------------------------
create table if not exists public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  goods_receipt_id uuid not null references public.goods_receipts (id) on delete cascade,
  purchase_order_item_id uuid not null references public.purchase_order_items (id) on delete restrict,

  accessory_id uuid not null references public.accessories (id) on delete restrict,
  name_snapshot text not null,
  sku_snapshot text not null,
  unit_shortform text not null,

  target_quantity numeric(12, 3) not null check (target_quantity >= 0),
  quantity_received numeric(12, 3) not null default 0
    check (quantity_received >= 0),

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists goods_receipt_items_receipt_alive_idx
  on public.goods_receipt_items (goods_receipt_id)
  where deleted_at is null;

create unique index if not exists goods_receipt_items_receipt_po_item_alive_uidx
  on public.goods_receipt_items (goods_receipt_id, purchase_order_item_id)
  where deleted_at is null;

alter table public.goods_receipt_items enable row level security;

drop policy if exists goods_receipt_items_select_member on public.goods_receipt_items;
create policy goods_receipt_items_select_member
  on public.goods_receipt_items
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists goods_receipt_items_insert_writer on public.goods_receipt_items;
create policy goods_receipt_items_insert_writer
  on public.goods_receipt_items
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists goods_receipt_items_update_writer on public.goods_receipt_items;
create policy goods_receipt_items_update_writer
  on public.goods_receipt_items
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists goods_receipt_items_delete_writer on public.goods_receipt_items;
create policy goods_receipt_items_delete_writer
  on public.goods_receipt_items
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Number generators
-- ---------------------------------------------------------------------------
create or replace function public.generate_goods_receipt_number(p_tenant_id uuid)
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
      substring(receipt_number from length('BE-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.goods_receipts
  where tenant_id = p_tenant_id
    and receipt_number like 'BE-' || current_year::text || '-%'
    and deleted_at is null;

  return 'BE-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_goods_receipt_number(uuid) from public;
grant execute on function public.generate_goods_receipt_number(uuid) to authenticated;

create or replace function public.generate_stock_movement_number(p_tenant_id uuid)
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

  current_year := extract(year from now())::integer;

  select coalesce(max(
    cast(
      substring(stock_movement_number from length('SM-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.stock_movements
  where tenant_id = p_tenant_id
    and stock_movement_number like 'SM-' || current_year::text || '-%';

  return 'SM-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_stock_movement_number(uuid) from public;
grant execute on function public.generate_stock_movement_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- receive_goods_receipt — all-or-nothing
-- ---------------------------------------------------------------------------
create or replace function public.receive_goods_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.goods_receipts%rowtype;
  v_po public.purchase_orders%rowtype;
  v_item record;
  v_received_count integer;
  v_all_received boolean := true;
  v_po_item record;
  v_received_qty numeric(12, 3);
  v_ordered_qty numeric(12, 3);
  v_sm_number text;
  v_user_id uuid := auth.uid();
begin
  if p_receipt_id is null then
    return jsonb_build_object('ok', false, 'message', 'Hiányzó beérkezés azonosító.');
  end if;

  select * into v_receipt
  from public.goods_receipts
  where id = p_receipt_id
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A beérkezés nem található.');
  end if;

  if not public.can_write_tenant(v_receipt.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  -- Idempotens: már bevételezve
  if v_receipt.status = 'received' then
    select * into v_po
    from public.purchase_orders
    where id = v_receipt.purchase_order_id;
    return jsonb_build_object(
      'ok', true,
      'already_received', true,
      'receipt_id', v_receipt.id,
      'po_id', v_receipt.purchase_order_id,
      'po_status', coalesce(v_po.status, 'received')
    );
  end if;

  if v_receipt.status <> 'checking' then
    return jsonb_build_object(
      'ok', false,
      'message', 'Csak ellenőrzés alatt lévő beérkezést lehet bevételezni.'
    );
  end if;

  select * into v_po
  from public.purchase_orders
  where id = v_receipt.purchase_order_id
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A rendelés nem található.');
  end if;

  if v_po.status not in ('ordered', 'partial') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Ehhez a rendeléshez nem lehet bevételezni (státusz: ' || v_po.status || ').'
    );
  end if;

  select count(*) into v_received_count
  from public.goods_receipt_items
  where goods_receipt_id = p_receipt_id
    and deleted_at is null
    and quantity_received > 0;

  if v_received_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'message', 'Legalább egy tételnél meg kell adni a kapott mennyiséget.'
    );
  end if;

  for v_item in
    select
      gri.id,
      gri.accessory_id,
      gri.quantity_received,
      gri.name_snapshot,
      poi.net_price
    from public.goods_receipt_items gri
    inner join public.purchase_order_items poi
      on poi.id = gri.purchase_order_item_id
    where gri.goods_receipt_id = p_receipt_id
      and gri.deleted_at is null
      and gri.quantity_received > 0
  loop
    v_sm_number := public.generate_stock_movement_number(v_receipt.tenant_id);

    insert into public.stock_movements (
      tenant_id,
      warehouse_id,
      product_type,
      accessory_id,
      quantity,
      movement_type,
      source_type,
      source_id,
      unit_cost_net,
      note,
      stock_movement_number,
      created_by
    ) values (
      v_receipt.tenant_id,
      v_receipt.warehouse_id,
      'accessory',
      v_item.accessory_id,
      v_item.quantity_received,
      'in',
      'purchase_receipt',
      p_receipt_id,
      v_item.net_price,
      v_item.name_snapshot,
      v_sm_number,
      v_user_id
    );
  end loop;

  update public.goods_receipts
  set
    status = 'received',
    received_at = now(),
    received_by = v_user_id,
    updated_at = now()
  where id = p_receipt_id;

  -- PO státusz újraszámolás (minden received beérkezés)
  for v_po_item in
    select poi.id, poi.quantity as ordered_qty
    from public.purchase_order_items poi
    where poi.purchase_order_id = v_po.id
      and poi.deleted_at is null
  loop
    select coalesce(sum(gri.quantity_received), 0) into v_received_qty
    from public.goods_receipt_items gri
    inner join public.goods_receipts gr on gr.id = gri.goods_receipt_id
    where gri.purchase_order_item_id = v_po_item.id
      and gri.deleted_at is null
      and gr.deleted_at is null
      and gr.status = 'received';

    v_ordered_qty := v_po_item.ordered_qty;

    if v_received_qty < v_ordered_qty then
      v_all_received := false;
      exit;
    end if;
  end loop;

  if v_all_received then
    update public.purchase_orders
    set status = 'received', updated_at = now()
    where id = v_po.id;
  else
    update public.purchase_orders
    set status = 'partial', updated_at = now()
    where id = v_po.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'po_id', v_po.id,
    'po_status', case when v_all_received then 'received' else 'partial' end,
    'items_received', v_received_count
  );
end;
$$;

revoke all on function public.receive_goods_receipt(uuid) from public;
grant execute on function public.receive_goods_receipt(uuid) to authenticated;

comment on function public.receive_goods_receipt(uuid) is
  'Bevételezés: stock_movements + receipt received + PO partial/received. All-or-nothing.';

-- ---------------------------------------------------------------------------
-- Page feature + Alap + backfill
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beerkezesek',
  'Beérkezések',
  'Beszerzés',
  '/beerkezesek',
  47,
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
select p.id, '/beerkezesek'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/beerkezesek'
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
  '/beerkezesek',
  true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
