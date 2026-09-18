-- Visszáru (S5) — sales_returns + create_sale_return
-- Eredeti eladás immutable; készlet in + refund payment külön.

-- ---------------------------------------------------------------------------
-- stock_movements.source_type: + sale_return
-- ---------------------------------------------------------------------------
alter table public.stock_movements
  drop constraint if exists stock_movements_source_type_check;

alter table public.stock_movements
  add constraint stock_movements_source_type_check
  check (source_type in (
    'purchase_receipt',
    'adjustment',
    'sale',
    'transfer',
    'sale_return'
  ));

-- ---------------------------------------------------------------------------
-- sales_orders status + payment_status bővítés
-- ---------------------------------------------------------------------------
alter table public.sales_orders
  drop constraint if exists sales_orders_status_check;

alter table public.sales_orders
  add constraint sales_orders_status_check
  check (status in (
    'draft',
    'confirmed',
    'fulfilled',
    'partially_returned',
    'cancelled',
    'returned'
  ));

alter table public.sales_orders
  drop constraint if exists sales_orders_payment_status_check;

alter table public.sales_orders
  add constraint sales_orders_payment_status_check
  check (payment_status in (
    'unpaid',
    'partial',
    'paid',
    'partially_refunded',
    'refunded'
  ));

-- ---------------------------------------------------------------------------
-- sales_returns
-- ---------------------------------------------------------------------------
create table if not exists public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,

  return_number text not null,
  status text not null default 'completed'
    check (status in ('completed')),

  reason text,
  note text,

  subtotal_net numeric(12, 0) not null default 0,
  total_vat numeric(12, 0) not null default 0,
  total_gross numeric(12, 0) not null default 0,
  cash_rounding_amount numeric(12, 0) not null default 0,
  refund_amount numeric(12, 0) not null default 0
    check (refund_amount >= 0),

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sales_returns_tenant_alive_idx
  on public.sales_returns (tenant_id)
  where deleted_at is null;

create unique index if not exists sales_returns_tenant_number_alive_uidx
  on public.sales_returns (tenant_id, return_number)
  where deleted_at is null;

create index if not exists sales_returns_sale_idx
  on public.sales_returns (sales_order_id)
  where deleted_at is null;

create index if not exists sales_returns_tenant_created_idx
  on public.sales_returns (tenant_id, created_at desc)
  where deleted_at is null;

alter table public.sales_returns enable row level security;

drop policy if exists sales_returns_select_member on public.sales_returns;
create policy sales_returns_select_member
  on public.sales_returns for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sales_returns_insert_writer on public.sales_returns;
create policy sales_returns_insert_writer
  on public.sales_returns for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

comment on table public.sales_returns is
  'Visszáru doksi — link az eredeti sales_orders-ra. S5 counter return.';

-- ---------------------------------------------------------------------------
-- sales_return_items
-- ---------------------------------------------------------------------------
create table if not exists public.sales_return_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sales_return_id uuid not null references public.sales_returns (id) on delete cascade,
  sales_order_item_id uuid not null references public.sales_order_items (id) on delete restrict,

  accessory_id uuid references public.accessories (id) on delete restrict,
  item_kind text not null default 'product'
    check (item_kind in ('product', 'fee')),
  name_snapshot text not null,
  sku_snapshot text,
  unit_shortform text not null default 'db',

  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price_gross numeric(12, 0) not null default 0,
  tax_rate_percent numeric(5, 2) not null default 0,

  total_net numeric(12, 0) not null default 0,
  total_vat numeric(12, 0) not null default 0,
  total_gross numeric(12, 0) not null default 0,

  restock boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sales_return_items_return_idx
  on public.sales_return_items (sales_return_id)
  where deleted_at is null;

create index if not exists sales_return_items_original_idx
  on public.sales_return_items (sales_order_item_id)
  where deleted_at is null;

alter table public.sales_return_items enable row level security;

drop policy if exists sales_return_items_select_member on public.sales_return_items;
create policy sales_return_items_select_member
  on public.sales_return_items for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sales_return_items_insert_writer on public.sales_return_items;
create policy sales_return_items_insert_writer
  on public.sales_return_items for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- sales_payments: kind + sales_return_id
-- ---------------------------------------------------------------------------
alter table public.sales_payments
  add column if not exists kind text not null default 'payment';

alter table public.sales_payments
  drop constraint if exists sales_payments_kind_check;

alter table public.sales_payments
  add constraint sales_payments_kind_check
  check (kind in ('payment', 'refund'));

alter table public.sales_payments
  add column if not exists sales_return_id uuid
    references public.sales_returns (id) on delete set null;

create index if not exists sales_payments_return_idx
  on public.sales_payments (sales_return_id)
  where deleted_at is null and sales_return_id is not null;

-- ---------------------------------------------------------------------------
-- generate_sale_return_number V-YYYY-NNN
-- ---------------------------------------------------------------------------
create or replace function public.generate_sale_return_number(p_tenant_id uuid)
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
      substring(return_number from length('V-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.sales_returns
  where tenant_id = p_tenant_id
    and return_number like 'V-' || current_year::text || '-%';

  return 'V-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_sale_return_number(uuid) from public;
grant execute on function public.generate_sale_return_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_sale_return
-- p_items: [{sales_order_item_id, quantity, restock?}]
-- ---------------------------------------------------------------------------
create or replace function public.create_sale_return(
  p_sales_order_id uuid,
  p_items jsonb,
  p_payment_method_id uuid,
  p_note text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale public.sales_orders%rowtype;
  v_tenant_id uuid;
  v_item jsonb;
  v_soi public.sales_order_items%rowtype;
  v_qty numeric(14, 3);
  v_restock boolean;
  v_already numeric(14, 3);
  v_returnable numeric(14, 3);
  v_seen uuid[] := '{}';
  v_item_id uuid;

  v_sum_items_gross numeric(12, 0) := 0;
  v_factor numeric;
  v_line_effective numeric(12, 0);
  v_line_already_gross numeric(12, 0);
  v_line_remaining_gross numeric(12, 0);
  v_line_refund_gross numeric(12, 0);
  v_line_net numeric(12, 0);
  v_line_vat numeric(12, 0);
  v_unit_gross numeric(12, 0);

  v_prepared jsonb := '[]'::jsonb;
  v_row jsonb;
  v_sort integer := 0;

  v_sub_gross numeric(12, 0) := 0;
  v_sub_net numeric(12, 0) := 0;
  v_sub_vat numeric(12, 0) := 0;
  v_cash_round numeric(12, 0) := 0;
  v_refund numeric(12, 0) := 0;

  v_paid_sum numeric(12, 0) := 0;
  v_refunded_sum numeric(12, 0) := 0;
  v_net_paid numeric(12, 0) := 0;

  v_is_full_first boolean := false;
  v_all_returnable_left numeric(14, 3) := 0;
  v_returning_all_left boolean := true;
  v_has_cash boolean := false;
  v_pm_name text;
  v_pm_id uuid;

  v_return_id uuid;
  v_return_number text;
  v_sm_number text;
  v_pay_status text;
  v_sale_status text;
  v_any_remaining boolean := false;
  v_rem numeric(14, 3);
  v_req_qty numeric(14, 3) := 0;
  v_rounded numeric(12, 0);
begin
  if p_sales_order_id is null then
    return jsonb_build_object('ok', false, 'message', 'Hiányzik az eladás.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Válassz legalább egy tételt.');
  end if;

  select * into v_sale
  from public.sales_orders
  where id = p_sales_order_id
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Az eladás nem található.');
  end if;

  v_tenant_id := v_sale.tenant_id;

  if not public.can_write_tenant(v_tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  if v_sale.status not in ('fulfilled', 'partially_returned') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Ebből az eladásból nem indítható visszáru.'
    );
  end if;

  -- Original items gross sum (after line discount, before global)
  select coalesce(sum(total_gross), 0)
  into v_sum_items_gross
  from public.sales_order_items
  where sales_order_id = v_sale.id
    and deleted_at is null;

  if v_sum_items_gross <= 0 then
    v_factor := 0;
  else
    v_factor := v_sale.total_gross::numeric / v_sum_items_gross::numeric;
  end if;

  -- How much returnable left across all items (for full-return detection)
  for v_soi in
    select *
    from public.sales_order_items
    where sales_order_id = v_sale.id
      and deleted_at is null
  loop
    select coalesce(sum(sri.quantity), 0)
    into v_already
    from public.sales_return_items sri
    join public.sales_returns sr on sr.id = sri.sales_return_id
    where sri.sales_order_item_id = v_soi.id
      and sri.deleted_at is null
      and sr.deleted_at is null;

    v_all_returnable_left := v_all_returnable_left + greatest(0, v_soi.quantity - v_already);
  end loop;

  -- Paid / already refunded
  select
    coalesce(sum(case when coalesce(kind, 'payment') = 'payment' and status = 'completed' then amount else 0 end), 0),
    coalesce(sum(case when kind = 'refund' and status = 'completed' then amount else 0 end), 0)
  into v_paid_sum, v_refunded_sum
  from public.sales_payments
  where sales_order_id = v_sale.id
    and deleted_at is null;

  v_net_paid := greatest(0, v_paid_sum - v_refunded_sum);

  -- Prepare lines
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_item_id := nullif(v_item ->> 'sales_order_item_id', '')::uuid;
      v_qty := (v_item ->> 'quantity')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen tétel adat.');
    end;

    if v_item_id is null then
      return jsonb_build_object('ok', false, 'message', 'Hiányzik a tétel azonosító.');
    end if;

    if v_item_id = any (v_seen) then
      return jsonb_build_object('ok', false, 'message', 'Ugyanaz a tétel többször szerepel.');
    end if;
    v_seen := array_append(v_seen, v_item_id);

    if v_qty is null or v_qty <= 0 then
      return jsonb_build_object('ok', false, 'message', 'A mennyiség legyen pozitív.');
    end if;

    select * into v_soi
    from public.sales_order_items
    where id = v_item_id
      and sales_order_id = v_sale.id
      and deleted_at is null;

    if not found then
      return jsonb_build_object('ok', false, 'message', 'Ismeretlen tétel az eladáson.');
    end if;

    select coalesce(sum(sri.quantity), 0)
    into v_already
    from public.sales_return_items sri
    join public.sales_returns sr on sr.id = sri.sales_return_id
    where sri.sales_order_item_id = v_soi.id
      and sri.deleted_at is null
      and sr.deleted_at is null;

    v_returnable := v_soi.quantity - v_already;
    if v_qty > v_returnable + 0.0001 then
      return jsonb_build_object(
        'ok', false,
        'message',
          'Túl sok visszáru: ' || v_soi.name_snapshot
          || ' (max ' || trim(to_char(v_returnable, 'FM999999990.999')) || ').'
      );
    end if;

    -- restock: fees never; products default true
    if v_soi.item_kind = 'fee' then
      v_restock := false;
    else
      v_restock := coalesce((v_item ->> 'restock')::boolean, true);
      if v_soi.accessory_id is null then
        v_restock := false;
      end if;
    end if;

    -- Effective line gross after global discount (full original line)
    v_line_effective := round(v_soi.total_gross * v_factor);

    -- Already refunded gross for this line (from prior returns)
    select coalesce(sum(sri.total_gross), 0)
    into v_line_already_gross
    from public.sales_return_items sri
    join public.sales_returns sr on sr.id = sri.sales_return_id
    where sri.sales_order_item_id = v_soi.id
      and sri.deleted_at is null
      and sr.deleted_at is null;

    v_line_remaining_gross := greatest(0, v_line_effective - v_line_already_gross);

    if v_qty >= v_returnable - 0.0001 then
      -- last remaining qty on this line → take all remaining value
      v_line_refund_gross := v_line_remaining_gross;
    else
      if v_returnable <= 0 then
        v_line_refund_gross := 0;
      else
        v_line_refund_gross := round(v_line_remaining_gross * (v_qty / v_returnable));
      end if;
    end if;

    if v_line_refund_gross > 0 and v_soi.tax_rate_percent > 0 then
      v_line_net := round(v_line_refund_gross / (1 + v_soi.tax_rate_percent / 100));
      v_line_vat := v_line_refund_gross - v_line_net;
    else
      v_line_net := v_line_refund_gross;
      v_line_vat := 0;
    end if;

    if v_qty > 0 then
      v_unit_gross := round(v_line_refund_gross / v_qty);
    else
      v_unit_gross := 0;
    end if;

    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'sales_order_item_id', v_soi.id,
      'accessory_id', v_soi.accessory_id,
      'item_kind', v_soi.item_kind,
      'name', v_soi.name_snapshot,
      'sku', v_soi.sku_snapshot,
      'unit_shortform', v_soi.unit_shortform,
      'quantity', v_qty,
      'unit_price_gross', v_unit_gross,
      'tax_rate_percent', v_soi.tax_rate_percent,
      'total_net', v_line_net,
      'total_vat', v_line_vat,
      'total_gross', v_line_refund_gross,
      'restock', v_restock
    ));

    v_sub_gross := v_sub_gross + v_line_refund_gross;
    v_sub_net := v_sub_net + v_line_net;
    v_sub_vat := v_sub_vat + v_line_vat;

    if v_qty < v_returnable - 0.0001 then
      v_returning_all_left := false;
    end if;
  end loop;

  if jsonb_array_length(v_prepared) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Válassz legalább egy tételt.');
  end if;

  -- Are we returning everything still returnable?
  v_req_qty := 0;
  for v_row in select * from jsonb_array_elements(v_prepared)
  loop
    v_req_qty := v_req_qty + (v_row ->> 'quantity')::numeric;
  end loop;
  if abs(v_req_qty - v_all_returnable_left) > 0.0001 then
    v_returning_all_left := false;
  end if;

  v_is_full_first := (
    v_refunded_sum = 0
    and v_returning_all_left
    and not exists (
      select 1 from public.sales_returns
      where sales_order_id = v_sale.id and deleted_at is null
    )
  );

  v_refund := v_sub_gross;
  v_cash_round := 0;

  -- Full first return: include original cash rounding (what customer paid)
  if v_is_full_first then
    v_refund := v_sale.total_gross + coalesce(v_sale.cash_rounding_amount, 0);
    v_cash_round := coalesce(v_sale.cash_rounding_amount, 0);
  end if;

  -- Cap by net paid
  if v_refund > v_net_paid then
    v_refund := v_net_paid;
  end if;

  -- Payment method when money moves
  v_pm_id := p_payment_method_id;
  if v_refund > 0 then
    if v_pm_id is null then
      return jsonb_build_object('ok', false, 'message', 'Válaszd ki a visszatérítés módját.');
    end if;
    select name into v_pm_name
    from public.payment_methods
    where id = v_pm_id
      and tenant_id = v_tenant_id
      and deleted_at is null;
    if v_pm_name is null then
      return jsonb_build_object('ok', false, 'message', 'Ismeretlen fizetési mód.');
    end if;
    if lower(v_pm_name) like '%készpénz%'
      or lower(v_pm_name) like '%keszpenz%'
      or lower(v_pm_name) = 'cash' then
      v_has_cash := true;
    end if;

    -- Cash round on this refund (unless full-first already used original due)
    if v_has_cash and not v_is_full_first and v_refund > 0 then
      v_rounded := public.hungarian_cash_round(v_refund);
      v_cash_round := v_rounded - v_refund;
      v_refund := v_rounded;
      if v_refund > v_net_paid then
        v_refund := v_net_paid;
        v_cash_round := 0;
      end if;
    end if;
  else
    v_pm_name := coalesce(
      (select name from public.payment_methods
       where id = v_pm_id and tenant_id = v_tenant_id and deleted_at is null),
      '—'
    );
  end if;

  -- Write return
  v_return_id := gen_random_uuid();
  v_return_number := public.generate_sale_return_number(v_tenant_id);

  insert into public.sales_returns (
    id, tenant_id, sales_order_id, warehouse_id,
    return_number, status, reason, note,
    subtotal_net, total_vat, total_gross, cash_rounding_amount, refund_amount,
    created_by
  ) values (
    v_return_id, v_tenant_id, v_sale.id, v_sale.warehouse_id,
    v_return_number, 'completed',
    nullif(trim(coalesce(p_reason, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    v_sub_net, v_sub_vat, v_sub_gross, v_cash_round, v_refund,
    v_user_id
  );

  for v_row in select * from jsonb_array_elements(v_prepared)
  loop
    v_sort := v_sort + 1;
    insert into public.sales_return_items (
      tenant_id, sales_return_id, sales_order_item_id,
      accessory_id, item_kind, name_snapshot, sku_snapshot, unit_shortform,
      quantity, unit_price_gross, tax_rate_percent,
      total_net, total_vat, total_gross, restock, sort_order
    ) values (
      v_tenant_id, v_return_id, (v_row ->> 'sales_order_item_id')::uuid,
      nullif(v_row ->> 'accessory_id', '')::uuid,
      v_row ->> 'item_kind',
      v_row ->> 'name',
      v_row ->> 'sku',
      coalesce(v_row ->> 'unit_shortform', 'db'),
      (v_row ->> 'quantity')::numeric,
      (v_row ->> 'unit_price_gross')::numeric,
      (v_row ->> 'tax_rate_percent')::numeric,
      (v_row ->> 'total_net')::numeric,
      (v_row ->> 'total_vat')::numeric,
      (v_row ->> 'total_gross')::numeric,
      coalesce((v_row ->> 'restock')::boolean, false),
      v_sort
    );

    -- Stock in
    if coalesce((v_row ->> 'restock')::boolean, false)
      and (v_row ->> 'item_kind') = 'product'
      and nullif(v_row ->> 'accessory_id', '') is not null
    then
      v_sm_number := public.generate_stock_movement_number(v_tenant_id);
      insert into public.stock_movements (
        tenant_id, warehouse_id, product_type, accessory_id,
        quantity, movement_type, source_type, source_id,
        note, stock_movement_number, created_by
      ) values (
        v_tenant_id, v_sale.warehouse_id, 'accessory',
        (v_row ->> 'accessory_id')::uuid,
        (v_row ->> 'quantity')::numeric, 'in', 'sale_return', v_return_id,
        'Visszáru ' || v_return_number, v_sm_number, v_user_id
      );
    end if;
  end loop;

  -- Refund payment
  if v_refund > 0 then
    insert into public.sales_payments (
      tenant_id, sales_order_id, payment_method_id,
      payment_method_name, amount, status, kind, sales_return_id,
      paid_at, created_by
    ) values (
      v_tenant_id, v_sale.id, v_pm_id,
      v_pm_name, v_refund, 'completed', 'refund', v_return_id,
      now(), v_user_id
    );
  end if;

  -- Recompute payment_status
  v_refunded_sum := v_refunded_sum + v_refund;
  if v_paid_sum <= 0 then
    v_pay_status := v_sale.payment_status;
    if v_pay_status not in ('unpaid', 'partial', 'paid', 'partially_refunded', 'refunded') then
      v_pay_status := 'unpaid';
    end if;
  elsif v_refunded_sum >= v_paid_sum - 1 then
    v_pay_status := 'refunded';
  elsif v_refunded_sum > 0 then
    v_pay_status := 'partially_refunded';
  else
    v_pay_status := v_sale.payment_status;
  end if;

  -- Recompute sale status from remaining returnable
  v_any_remaining := false;
  for v_soi in
    select *
    from public.sales_order_items
    where sales_order_id = v_sale.id
      and deleted_at is null
  loop
    select coalesce(sum(sri.quantity), 0)
    into v_already
    from public.sales_return_items sri
    join public.sales_returns sr on sr.id = sri.sales_return_id
    where sri.sales_order_item_id = v_soi.id
      and sri.deleted_at is null
      and sr.deleted_at is null;

    v_rem := v_soi.quantity - v_already;
    if v_rem > 0.0001 then
      v_any_remaining := true;
      exit;
    end if;
  end loop;

  if v_any_remaining then
    v_sale_status := 'partially_returned';
  else
    v_sale_status := 'returned';
  end if;

  update public.sales_orders
  set
    status = v_sale_status,
    payment_status = v_pay_status,
    updated_at = now()
  where id = v_sale.id;

  return jsonb_build_object(
    'ok', true,
    'id', v_return_id,
    'return_number', v_return_number,
    'refund_amount', v_refund,
    'sales_order_id', v_sale.id
  );
end;
$$;

revoke all on function public.create_sale_return(uuid, jsonb, uuid, text, text) from public;
grant execute on function public.create_sale_return(uuid, jsonb, uuid, text, text) to authenticated;
