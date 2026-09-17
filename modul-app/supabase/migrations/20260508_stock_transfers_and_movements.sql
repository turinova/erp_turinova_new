-- Áttárolás (instant warehouse transfer) + page entitlements for /keszlet/*
-- Ledger: stock_movements source_type = 'transfer' (already allowed in 20260504)

-- ---------------------------------------------------------------------------
-- stock_transfers
-- ---------------------------------------------------------------------------
create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  from_warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  to_warehouse_id uuid not null references public.warehouses (id) on delete restrict,

  transfer_number text not null,
  status text not null default 'completed'
    check (status in ('completed', 'cancelled')),

  note text,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint stock_transfers_distinct_warehouses
    check (from_warehouse_id <> to_warehouse_id)
);

create index if not exists stock_transfers_tenant_alive_idx
  on public.stock_transfers (tenant_id)
  where deleted_at is null;

create unique index if not exists stock_transfers_tenant_number_alive_uidx
  on public.stock_transfers (tenant_id, transfer_number)
  where deleted_at is null;

create index if not exists stock_transfers_tenant_created_idx
  on public.stock_transfers (tenant_id, created_at desc)
  where deleted_at is null;

alter table public.stock_transfers enable row level security;

drop policy if exists stock_transfers_select_member on public.stock_transfers;
create policy stock_transfers_select_member
  on public.stock_transfers
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists stock_transfers_insert_writer on public.stock_transfers;
create policy stock_transfers_insert_writer
  on public.stock_transfers
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists stock_transfers_update_writer on public.stock_transfers;
create policy stock_transfers_update_writer
  on public.stock_transfers
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

comment on table public.stock_transfers is
  'Raktárak közötti áttárolás. V1: azonnali completed (OUT+IN ledger).';

-- ---------------------------------------------------------------------------
-- stock_transfer_items
-- ---------------------------------------------------------------------------
create table if not exists public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  stock_transfer_id uuid not null references public.stock_transfers (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete restrict,

  name_snapshot text not null,
  sku_snapshot text not null,
  unit_shortform text not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists stock_transfer_items_transfer_idx
  on public.stock_transfer_items (stock_transfer_id)
  where deleted_at is null;

create unique index if not exists stock_transfer_items_transfer_accessory_alive_uidx
  on public.stock_transfer_items (stock_transfer_id, accessory_id)
  where deleted_at is null;

alter table public.stock_transfer_items enable row level security;

drop policy if exists stock_transfer_items_select_member on public.stock_transfer_items;
create policy stock_transfer_items_select_member
  on public.stock_transfer_items
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists stock_transfer_items_insert_writer on public.stock_transfer_items;
create policy stock_transfer_items_insert_writer
  on public.stock_transfer_items
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Number generator
-- ---------------------------------------------------------------------------
create or replace function public.generate_stock_transfer_number(p_tenant_id uuid)
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
      substring(transfer_number from length('ST-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.stock_transfers
  where tenant_id = p_tenant_id
    and transfer_number like 'ST-' || current_year::text || '-%';

  return 'ST-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_stock_transfer_number(uuid) from public;
grant execute on function public.generate_stock_transfer_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- On-hand helper (single accessory @ warehouse)
-- ---------------------------------------------------------------------------
create or replace function public.accessory_on_hand(
  p_tenant_id uuid,
  p_accessory_id uuid,
  p_warehouse_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when movement_type = 'in' then quantity
      when movement_type = 'out' then -quantity
      else 0
    end
  ), 0)
  from public.stock_movements
  where tenant_id = p_tenant_id
    and accessory_id = p_accessory_id
    and warehouse_id = p_warehouse_id;
$$;

revoke all on function public.accessory_on_hand(uuid, uuid, uuid) from public;
grant execute on function public.accessory_on_hand(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_stock_transfer — instant complete (all-or-nothing)
-- p_items: [{"accessory_id":"uuid","quantity":1.5}, ...]
-- ---------------------------------------------------------------------------
create or replace function public.create_stock_transfer(
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from public.warehouses%rowtype;
  v_to public.warehouses%rowtype;
  v_tenant_id uuid;
  v_user_id uuid := auth.uid();
  v_transfer_id uuid;
  v_transfer_number text;
  v_item jsonb;
  v_accessory_id uuid;
  v_qty numeric(14, 3);
  v_on_hand numeric(14, 3);
  v_acc public.accessories%rowtype;
  v_unit_shortform text;
  v_sort integer := 0;
  v_sm_number text;
  v_item_count integer := 0;
  v_seen uuid[] := '{}';
  v_prepared jsonb := '[]'::jsonb;
  v_row jsonb;
begin
  if p_from_warehouse_id is null or p_to_warehouse_id is null then
    return jsonb_build_object('ok', false, 'message', 'Válaszd ki a forrás- és célraktárat.');
  end if;

  if p_from_warehouse_id = p_to_warehouse_id then
    return jsonb_build_object('ok', false, 'message', 'A forrás- és célraktár nem lehet ugyanaz.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Adj hozzá legalább egy terméket.');
  end if;

  select * into v_from
  from public.warehouses
  where id = p_from_warehouse_id
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A forrásraktár nem található.');
  end if;

  if not v_from.is_active then
    return jsonb_build_object('ok', false, 'message', 'A forrásraktár inaktív.');
  end if;

  if not public.can_write_tenant(v_from.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  v_tenant_id := v_from.tenant_id;

  select * into v_to
  from public.warehouses
  where id = p_to_warehouse_id
    and tenant_id = v_tenant_id
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A célraktár nem található.');
  end if;

  if not v_to.is_active then
    return jsonb_build_object('ok', false, 'message', 'A célraktár inaktív.');
  end if;

  -- Pass 1: validate only (no writes) so ok:false never leaves orphan rows
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_accessory_id := (v_item ->> 'accessory_id')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen termék azonosító.');
    end;

    begin
      v_qty := (v_item ->> 'quantity')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen mennyiség.');
    end;

    if v_accessory_id is null or v_qty is null or v_qty <= 0 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Minden tételnél legyen termék és pozitív mennyiség.'
      );
    end if;

    if v_accessory_id = any (v_seen) then
      return jsonb_build_object(
        'ok', false,
        'message', 'Ugyanaz a termék többször szerepel — egyesítsd a mennyiségeket.'
      );
    end if;
    v_seen := array_append(v_seen, v_accessory_id);

    select * into v_acc
    from public.accessories
    where id = v_accessory_id
      and tenant_id = v_tenant_id
      and deleted_at is null;

    if not found then
      return jsonb_build_object('ok', false, 'message', 'Ismeretlen termék a listában.');
    end if;

    select coalesce(u.shortform, 'db') into v_unit_shortform
    from public.units u
    where u.id = v_acc.unit_id;

    v_on_hand := public.accessory_on_hand(
      v_tenant_id,
      v_accessory_id,
      p_from_warehouse_id
    );

    if v_on_hand < v_qty then
      return jsonb_build_object(
        'ok', false,
        'message',
          'Nincs elég készlet: '
          || v_acc.name
          || ' (készleten: '
          || trim(to_char(v_on_hand, 'FM999999990.999'))
          || ', kérve: '
          || trim(to_char(v_qty, 'FM999999990.999'))
          || ').'
      );
    end if;

    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'accessory_id', v_accessory_id,
      'quantity', v_qty,
      'name', v_acc.name,
      'sku', v_acc.sku,
      'unit_shortform', coalesce(v_unit_shortform, 'db')
    ));
  end loop;

  if jsonb_array_length(v_prepared) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Adj hozzá legalább egy terméket.');
  end if;

  -- Pass 2: write
  v_transfer_number := public.generate_stock_transfer_number(v_tenant_id);
  v_transfer_id := gen_random_uuid();

  insert into public.stock_transfers (
    id,
    tenant_id,
    from_warehouse_id,
    to_warehouse_id,
    transfer_number,
    status,
    note,
    completed_at,
    completed_by
  ) values (
    v_transfer_id,
    v_tenant_id,
    p_from_warehouse_id,
    p_to_warehouse_id,
    v_transfer_number,
    'completed',
    nullif(trim(coalesce(p_note, '')), ''),
    now(),
    v_user_id
  );

  for v_row in select * from jsonb_array_elements(v_prepared)
  loop
    v_accessory_id := (v_row ->> 'accessory_id')::uuid;
    v_qty := (v_row ->> 'quantity')::numeric;

    insert into public.stock_transfer_items (
      tenant_id,
      stock_transfer_id,
      accessory_id,
      name_snapshot,
      sku_snapshot,
      unit_shortform,
      quantity,
      sort_order
    ) values (
      v_tenant_id,
      v_transfer_id,
      v_accessory_id,
      v_row ->> 'name',
      v_row ->> 'sku',
      v_row ->> 'unit_shortform',
      v_qty,
      v_sort
    );

    v_sm_number := public.generate_stock_movement_number(v_tenant_id);
    insert into public.stock_movements (
      tenant_id,
      warehouse_id,
      product_type,
      accessory_id,
      quantity,
      movement_type,
      source_type,
      source_id,
      note,
      stock_movement_number,
      created_by
    ) values (
      v_tenant_id,
      p_from_warehouse_id,
      'accessory',
      v_accessory_id,
      v_qty,
      'out',
      'transfer',
      v_transfer_id,
      v_row ->> 'name',
      v_sm_number,
      v_user_id
    );

    v_sm_number := public.generate_stock_movement_number(v_tenant_id);
    insert into public.stock_movements (
      tenant_id,
      warehouse_id,
      product_type,
      accessory_id,
      quantity,
      movement_type,
      source_type,
      source_id,
      note,
      stock_movement_number,
      created_by
    ) values (
      v_tenant_id,
      p_to_warehouse_id,
      'accessory',
      v_accessory_id,
      v_qty,
      'in',
      'transfer',
      v_transfer_id,
      v_row ->> 'name',
      v_sm_number,
      v_user_id
    );

    v_sort := v_sort + 1;
    v_item_count := v_item_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'id', v_transfer_id,
    'transfer_number', v_transfer_number,
    'items_count', v_item_count
  );
end;
$$;

revoke all on function public.create_stock_transfer(uuid, uuid, text, jsonb) from public;
grant execute on function public.create_stock_transfer(uuid, uuid, text, jsonb) to authenticated;

comment on function public.create_stock_transfer(uuid, uuid, text, jsonb) is
  'Azonnali áttárolás: header + items + OUT/IN stock_movements. All-or-nothing.';

-- ---------------------------------------------------------------------------
-- Page features + Alap + backfill
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values
  (
    '/keszlet/atadasok',
    'Áttárolások',
    'Beszerzés',
    '/keszlet/atadasok',
    48,
    true
  ),
  (
    '/keszlet/mozgasok',
    'Készletmozgások',
    'Beszerzés',
    '/keszlet/mozgasok',
    49,
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
select p.id, f.key
from public.product_plans p
cross join (values ('/keszlet/atadasok'), ('/keszlet/mozgasok')) as f(key)
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, f.key
from public.tenants t
cross join (values ('/keszlet/atadasok'), ('/keszlet/mozgasok')) as f(key)
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
  f.key,
  true
from public.tenant_memberships m
cross join (values ('/keszlet/atadasok'), ('/keszlet/mozgasok')) as f(key)
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
