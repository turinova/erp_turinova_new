-- Anyag-beszerzés: PO order_kind (product|material), polimorf tételek,
-- sheet/linear készletnapló, receive RPC bővítés.
-- Termék PO backward-compat: meglévő sorok = accessory / product.

-- ---------------------------------------------------------------------------
-- purchase_orders.order_kind
-- ---------------------------------------------------------------------------
alter table public.purchase_orders
  add column if not exists order_kind text;

update public.purchase_orders
set order_kind = 'product'
where order_kind is null;

alter table public.purchase_orders
  alter column order_kind set default 'product';

alter table public.purchase_orders
  alter column order_kind set not null;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_order_kind_check;

alter table public.purchase_orders
  add constraint purchase_orders_order_kind_check
  check (order_kind in ('product', 'material'));

create index if not exists purchase_orders_tenant_kind_alive_idx
  on public.purchase_orders (tenant_id, order_kind)
  where deleted_at is null;

comment on column public.purchase_orders.order_kind is
  'product = csak accessories; material = táblás + szálas együtt.';

comment on table public.purchase_orders is
  'Beszállítói rendelések — termék VAGY anyag (táblás/szálas) tételekkel.';

-- ---------------------------------------------------------------------------
-- linear_materials.stock_unit
-- ---------------------------------------------------------------------------
alter table public.linear_materials
  add column if not exists stock_unit text;

update public.linear_materials
set stock_unit = 'db'
where stock_unit is null;

alter table public.linear_materials
  alter column stock_unit set default 'db';

alter table public.linear_materials
  alter column stock_unit set not null;

alter table public.linear_materials
  drop constraint if exists linear_materials_stock_unit_check;

alter table public.linear_materials
  add constraint linear_materials_stock_unit_check
  check (stock_unit in ('db', 'fm'));

comment on column public.linear_materials.stock_unit is
  'Készlet/PO egység: db (szál) vagy fm. Egy anyag = egy egység.';

-- ---------------------------------------------------------------------------
-- purchase_order_items — polimorf
-- ---------------------------------------------------------------------------
alter table public.purchase_order_items
  add column if not exists line_kind text;

alter table public.purchase_order_items
  add column if not exists sheet_material_id uuid
    references public.sheet_materials (id) on delete restrict;

alter table public.purchase_order_items
  add column if not exists linear_material_id uuid
    references public.linear_materials (id) on delete restrict;

alter table public.purchase_order_items
  add column if not exists price_per_area_net numeric(12, 0);

alter table public.purchase_order_items
  add column if not exists area_or_length_factor numeric(14, 6);

update public.purchase_order_items
set line_kind = 'accessory'
where line_kind is null and accessory_id is not null;

alter table public.purchase_order_items
  alter column line_kind set default 'accessory';

alter table public.purchase_order_items
  alter column line_kind set not null;

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_line_kind_check;

alter table public.purchase_order_items
  add constraint purchase_order_items_line_kind_check
  check (line_kind in ('accessory', 'sheet_material', 'linear_material'));

-- accessory_id / unit_id nullable anyag sorokhoz
alter table public.purchase_order_items
  alter column accessory_id drop not null;

alter table public.purchase_order_items
  alter column unit_id drop not null;

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_line_fk_check;

alter table public.purchase_order_items
  add constraint purchase_order_items_line_fk_check
  check (
    (
      line_kind = 'accessory'
      and accessory_id is not null
      and sheet_material_id is null
      and linear_material_id is null
      and unit_id is not null
    )
    or (
      line_kind = 'sheet_material'
      and sheet_material_id is not null
      and accessory_id is null
      and linear_material_id is null
    )
    or (
      line_kind = 'linear_material'
      and linear_material_id is not null
      and accessory_id is null
      and sheet_material_id is null
    )
  );

drop index if exists public.purchase_order_items_po_accessory_alive_uidx;

create unique index if not exists purchase_order_items_po_accessory_alive_uidx
  on public.purchase_order_items (purchase_order_id, accessory_id)
  where deleted_at is null and accessory_id is not null;

create unique index if not exists purchase_order_items_po_sheet_alive_uidx
  on public.purchase_order_items (purchase_order_id, sheet_material_id)
  where deleted_at is null and sheet_material_id is not null;

create unique index if not exists purchase_order_items_po_linear_alive_uidx
  on public.purchase_order_items (purchase_order_id, linear_material_id)
  where deleted_at is null and linear_material_id is not null;

create index if not exists purchase_order_items_sheet_alive_idx
  on public.purchase_order_items (sheet_material_id)
  where deleted_at is null and sheet_material_id is not null;

create index if not exists purchase_order_items_linear_alive_idx
  on public.purchase_order_items (linear_material_id)
  where deleted_at is null and linear_material_id is not null;

comment on table public.purchase_order_items is
  'PO tételek — accessory VAGY sheet_material VAGY linear_material + ár/név snapshot.';

-- ---------------------------------------------------------------------------
-- goods_receipt_items — polimorf
-- ---------------------------------------------------------------------------
alter table public.goods_receipt_items
  add column if not exists line_kind text;

alter table public.goods_receipt_items
  add column if not exists sheet_material_id uuid
    references public.sheet_materials (id) on delete restrict;

alter table public.goods_receipt_items
  add column if not exists linear_material_id uuid
    references public.linear_materials (id) on delete restrict;

update public.goods_receipt_items
set line_kind = 'accessory'
where line_kind is null;

alter table public.goods_receipt_items
  alter column line_kind set default 'accessory';

alter table public.goods_receipt_items
  alter column line_kind set not null;

alter table public.goods_receipt_items
  drop constraint if exists goods_receipt_items_line_kind_check;

alter table public.goods_receipt_items
  add constraint goods_receipt_items_line_kind_check
  check (line_kind in ('accessory', 'sheet_material', 'linear_material'));

alter table public.goods_receipt_items
  alter column accessory_id drop not null;

alter table public.goods_receipt_items
  drop constraint if exists goods_receipt_items_line_fk_check;

alter table public.goods_receipt_items
  add constraint goods_receipt_items_line_fk_check
  check (
    (
      line_kind = 'accessory'
      and accessory_id is not null
      and sheet_material_id is null
      and linear_material_id is null
    )
    or (
      line_kind = 'sheet_material'
      and sheet_material_id is not null
      and accessory_id is null
      and linear_material_id is null
    )
    or (
      line_kind = 'linear_material'
      and linear_material_id is not null
      and accessory_id is null
      and sheet_material_id is null
    )
  );

drop index if exists public.goods_receipt_items_receipt_extra_accessory_alive_uidx;

create unique index if not exists goods_receipt_items_receipt_extra_accessory_alive_uidx
  on public.goods_receipt_items (goods_receipt_id, accessory_id)
  where deleted_at is null and is_extra = true and accessory_id is not null;

-- ---------------------------------------------------------------------------
-- sheet_stock_movements
-- ---------------------------------------------------------------------------
create table if not exists public.sheet_stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  sheet_material_id uuid not null references public.sheet_materials (id) on delete restrict,

  quantity numeric(14, 3) not null check (quantity > 0),
  movement_type text not null check (movement_type in ('in', 'out')),
  source_type text not null
    check (source_type in ('purchase_receipt', 'adjustment', 'transfer')),
  source_id uuid,

  unit_cost_net numeric(12, 0),
  note text,
  stock_movement_number text not null,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sheet_stock_movements_tenant_created_idx
  on public.sheet_stock_movements (tenant_id, created_at desc);

create index if not exists sheet_stock_movements_material_wh_idx
  on public.sheet_stock_movements (tenant_id, sheet_material_id, warehouse_id);

create index if not exists sheet_stock_movements_source_idx
  on public.sheet_stock_movements (source_type, source_id);

create unique index if not exists sheet_stock_movements_tenant_number_uidx
  on public.sheet_stock_movements (tenant_id, stock_movement_number);

alter table public.sheet_stock_movements enable row level security;

drop policy if exists sheet_stock_movements_select_member on public.sheet_stock_movements;
create policy sheet_stock_movements_select_member
  on public.sheet_stock_movements
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sheet_stock_movements_insert_writer on public.sheet_stock_movements;
create policy sheet_stock_movements_insert_writer
  on public.sheet_stock_movements
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

comment on table public.sheet_stock_movements is
  'Táblás anyag készletnapló — qty = tábla db. Bevételezés: purchase_receipt.';

-- ---------------------------------------------------------------------------
-- linear_stock_movements
-- ---------------------------------------------------------------------------
create table if not exists public.linear_stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  linear_material_id uuid not null references public.linear_materials (id) on delete restrict,

  quantity numeric(14, 3) not null check (quantity > 0),
  movement_type text not null check (movement_type in ('in', 'out')),
  source_type text not null
    check (source_type in ('purchase_receipt', 'adjustment', 'transfer')),
  source_id uuid,

  unit_cost_net numeric(12, 0),
  note text,
  stock_movement_number text not null,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists linear_stock_movements_tenant_created_idx
  on public.linear_stock_movements (tenant_id, created_at desc);

create index if not exists linear_stock_movements_material_wh_idx
  on public.linear_stock_movements (tenant_id, linear_material_id, warehouse_id);

create index if not exists linear_stock_movements_source_idx
  on public.linear_stock_movements (source_type, source_id);

create unique index if not exists linear_stock_movements_tenant_number_uidx
  on public.linear_stock_movements (tenant_id, stock_movement_number);

alter table public.linear_stock_movements enable row level security;

drop policy if exists linear_stock_movements_select_member on public.linear_stock_movements;
create policy linear_stock_movements_select_member
  on public.linear_stock_movements
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists linear_stock_movements_insert_writer on public.linear_stock_movements;
create policy linear_stock_movements_insert_writer
  on public.linear_stock_movements
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

comment on table public.linear_stock_movements is
  'Szálas/munkalap készletnapló — qty = db vagy fm (törzs stock_unit).';

-- ---------------------------------------------------------------------------
-- Number generators
-- ---------------------------------------------------------------------------
create or replace function public.generate_sheet_stock_movement_number(p_tenant_id uuid)
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
      substring(stock_movement_number from length('SSM-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.sheet_stock_movements
  where tenant_id = p_tenant_id
    and stock_movement_number like 'SSM-' || current_year::text || '-%';

  return 'SSM-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_sheet_stock_movement_number(uuid) from public;
grant execute on function public.generate_sheet_stock_movement_number(uuid) to authenticated;

create or replace function public.generate_linear_stock_movement_number(p_tenant_id uuid)
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
      substring(stock_movement_number from length('LSM-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.linear_stock_movements
  where tenant_id = p_tenant_id
    and stock_movement_number like 'LSM-' || current_year::text || '-%';

  return 'LSM-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_linear_stock_movement_number(uuid) from public;
grant execute on function public.generate_linear_stock_movement_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- receive_goods_receipt — accessory + sheet + linear ledgers
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
  v_unit_cost numeric(12, 0);
  v_line_kind text;
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
      gri.line_kind,
      gri.accessory_id,
      gri.sheet_material_id,
      gri.linear_material_id,
      gri.quantity_received,
      gri.name_snapshot,
      gri.is_extra,
      gri.purchase_order_item_id,
      poi.net_price as po_net_price,
      acc.purchase_price_net as acc_purchase_price,
      acc.price_net as acc_price_net
    from public.goods_receipt_items gri
    left join public.purchase_order_items poi
      on poi.id = gri.purchase_order_item_id
    left join public.accessories acc
      on acc.id = gri.accessory_id
    where gri.goods_receipt_id = p_receipt_id
      and gri.deleted_at is null
      and gri.quantity_received > 0
  loop
    v_line_kind := coalesce(v_item.line_kind, 'accessory');
    v_unit_cost := coalesce(
      v_item.po_net_price,
      case
        when v_item.acc_purchase_price is not null and v_item.acc_purchase_price > 0
          then round(v_item.acc_purchase_price)
        else round(coalesce(v_item.acc_price_net, 0))
      end
    );

    if v_line_kind = 'sheet_material' then
      if v_item.sheet_material_id is null then
        return jsonb_build_object('ok', false, 'message', 'Hiányzó táblás anyag a beérkezés soron.');
      end if;
      v_sm_number := public.generate_sheet_stock_movement_number(v_receipt.tenant_id);
      insert into public.sheet_stock_movements (
        tenant_id, warehouse_id, sheet_material_id, quantity, movement_type,
        source_type, source_id, unit_cost_net, note, stock_movement_number, created_by
      ) values (
        v_receipt.tenant_id, v_receipt.warehouse_id, v_item.sheet_material_id,
        v_item.quantity_received, 'in', 'purchase_receipt', p_receipt_id,
        v_unit_cost,
        case when v_item.is_extra then 'PO-n kívüli: ' || v_item.name_snapshot
             else v_item.name_snapshot end,
        v_sm_number, v_user_id
      );
    elsif v_line_kind = 'linear_material' then
      if v_item.linear_material_id is null then
        return jsonb_build_object('ok', false, 'message', 'Hiányzó szálas anyag a beérkezés soron.');
      end if;
      v_sm_number := public.generate_linear_stock_movement_number(v_receipt.tenant_id);
      insert into public.linear_stock_movements (
        tenant_id, warehouse_id, linear_material_id, quantity, movement_type,
        source_type, source_id, unit_cost_net, note, stock_movement_number, created_by
      ) values (
        v_receipt.tenant_id, v_receipt.warehouse_id, v_item.linear_material_id,
        v_item.quantity_received, 'in', 'purchase_receipt', p_receipt_id,
        v_unit_cost,
        case when v_item.is_extra then 'PO-n kívüli: ' || v_item.name_snapshot
             else v_item.name_snapshot end,
        v_sm_number, v_user_id
      );
    else
      if v_item.accessory_id is null then
        return jsonb_build_object('ok', false, 'message', 'Hiányzó termék a beérkezés soron.');
      end if;
      v_sm_number := public.generate_stock_movement_number(v_receipt.tenant_id);
      insert into public.stock_movements (
        tenant_id, warehouse_id, product_type, accessory_id, quantity, movement_type,
        source_type, source_id, unit_cost_net, note, stock_movement_number, created_by
      ) values (
        v_receipt.tenant_id, v_receipt.warehouse_id, 'accessory', v_item.accessory_id,
        v_item.quantity_received, 'in', 'purchase_receipt', p_receipt_id,
        v_unit_cost,
        case when v_item.is_extra then 'PO-n kívüli: ' || v_item.name_snapshot
             else v_item.name_snapshot end,
        v_sm_number, v_user_id
      );
    end if;
  end loop;

  update public.goods_receipts
  set
    status = 'received',
    received_at = now(),
    received_by = v_user_id,
    updated_at = now()
  where id = p_receipt_id;

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

comment on function public.receive_goods_receipt(uuid) is
  'Bevételezés: accessory / sheet / linear stock + receipt received + PO partial/received.';
