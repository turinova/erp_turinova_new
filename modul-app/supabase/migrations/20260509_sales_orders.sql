-- Értékesítés (sales) — S0/S1 mag
-- Egy kanonikus sales_orders: channel = manual|pos|webshop (POS/webshop UI később)
-- Ledger: stock_movements source_type = 'sale' (már engedélyezett 20260504-ben)

-- ---------------------------------------------------------------------------
-- sales_orders
-- ---------------------------------------------------------------------------
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete set null,

  sale_number text not null,
  channel text not null default 'manual'
    check (channel in ('manual', 'pos', 'webshop')),
  external_ref text,

  status text not null default 'fulfilled'
    check (status in ('draft', 'confirmed', 'fulfilled', 'cancelled', 'returned')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid')),

  customer_name_snapshot text,

  discount_percentage numeric(5, 2) not null default 0
    check (discount_percentage >= 0 and discount_percentage <= 100),
  discount_amount numeric(12, 0) not null default 0
    check (discount_amount >= 0),

  subtotal_net numeric(12, 0) not null default 0,
  total_vat numeric(12, 0) not null default 0,
  total_gross numeric(12, 0) not null default 0,
  cash_rounding_amount numeric(12, 0) not null default 0,

  note text,
  fulfilled_at timestamptz,
  fulfilled_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sales_orders_tenant_alive_idx
  on public.sales_orders (tenant_id)
  where deleted_at is null;

create unique index if not exists sales_orders_tenant_number_alive_uidx
  on public.sales_orders (tenant_id, sale_number)
  where deleted_at is null;

create unique index if not exists sales_orders_tenant_external_ref_uidx
  on public.sales_orders (tenant_id, channel, external_ref)
  where deleted_at is null and external_ref is not null;

create index if not exists sales_orders_tenant_created_idx
  on public.sales_orders (tenant_id, created_at desc)
  where deleted_at is null;

create index if not exists sales_orders_tenant_status_alive_idx
  on public.sales_orders (tenant_id, status)
  where deleted_at is null;

alter table public.sales_orders enable row level security;

drop policy if exists sales_orders_select_member on public.sales_orders;
create policy sales_orders_select_member
  on public.sales_orders for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sales_orders_insert_writer on public.sales_orders;
create policy sales_orders_insert_writer
  on public.sales_orders for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists sales_orders_update_writer on public.sales_orders;
create policy sales_orders_update_writer
  on public.sales_orders for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

comment on table public.sales_orders is
  'Értékesítés — manuális / POS / webshop. S1: azonnali fulfilled + stock out.';

-- ---------------------------------------------------------------------------
-- sales_order_items
-- ---------------------------------------------------------------------------
create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders (id) on delete cascade,

  item_kind text not null default 'product'
    check (item_kind in ('product', 'fee')),
  accessory_id uuid references public.accessories (id) on delete restrict,
  fee_type_id uuid references public.fee_types (id) on delete set null,

  name_snapshot text not null,
  sku_snapshot text,
  unit_shortform text not null default 'db',

  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price_net numeric(12, 0) not null default 0,
  unit_price_gross numeric(12, 0) not null default 0,
  tax_rate_percent numeric(5, 2) not null default 0,

  discount_percentage numeric(5, 2) not null default 0
    check (discount_percentage >= 0 and discount_percentage <= 100),
  discount_amount numeric(12, 0) not null default 0
    check (discount_amount >= 0),

  total_net numeric(12, 0) not null default 0,
  total_vat numeric(12, 0) not null default 0,
  total_gross numeric(12, 0) not null default 0,

  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint sales_order_items_product_has_accessory
    check (
      (item_kind = 'product' and accessory_id is not null)
      or (item_kind = 'fee')
    )
);

create index if not exists sales_order_items_sale_idx
  on public.sales_order_items (sales_order_id)
  where deleted_at is null;

alter table public.sales_order_items enable row level security;

drop policy if exists sales_order_items_select_member on public.sales_order_items;
create policy sales_order_items_select_member
  on public.sales_order_items for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sales_order_items_insert_writer on public.sales_order_items;
create policy sales_order_items_insert_writer
  on public.sales_order_items for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- sales_payments
-- ---------------------------------------------------------------------------
create table if not exists public.sales_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders (id) on delete cascade,
  payment_method_id uuid references public.payment_methods (id) on delete set null,

  payment_method_name text not null,
  amount numeric(12, 0) not null check (amount > 0),
  status text not null default 'completed'
    check (status in ('completed', 'voided')),
  provider_ref text,
  paid_at timestamptz not null default now(),

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sales_payments_sale_idx
  on public.sales_payments (sales_order_id)
  where deleted_at is null;

alter table public.sales_payments enable row level security;

drop policy if exists sales_payments_select_member on public.sales_payments;
create policy sales_payments_select_member
  on public.sales_payments for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sales_payments_insert_writer on public.sales_payments;
create policy sales_payments_insert_writer
  on public.sales_payments for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Number generator E-YYYY-NNN
-- ---------------------------------------------------------------------------
create or replace function public.generate_sale_number(p_tenant_id uuid)
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
      substring(sale_number from length('E-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.sales_orders
  where tenant_id = p_tenant_id
    and sale_number like 'E-' || current_year::text || '-%';

  return 'E-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_sale_number(uuid) from public;
grant execute on function public.generate_sale_number(uuid) to authenticated;

-- Magyar készpénz kerekítés (Billingo szabály): 0-2→0, 3-4→5, 5-7→5, 8-9→0(+10)
create or replace function public.hungarian_cash_round(p_amount numeric)
returns numeric
language plpgsql
immutable
as $$
declare
  v_floor integer;
  v_last integer;
begin
  if p_amount is null or p_amount <= 0 then
    return 0;
  end if;
  v_floor := floor(p_amount)::integer;
  v_last := v_floor % 10;
  if v_last between 0 and 2 then
    return (v_floor - v_last)::numeric;
  elsif v_last between 3 and 7 then
    return (v_floor - v_last + 5)::numeric;
  else
    return (v_floor - v_last + 10)::numeric;
  end if;
end;
$$;

revoke all on function public.hungarian_cash_round(numeric) from public;
grant execute on function public.hungarian_cash_round(numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- create_sale — azonnali fulfilled + payments + stock out (S1)
-- p_items: [{accessory_id, quantity, unit_price_gross?, discount_percentage?, discount_amount?}]
-- p_fees:  [{name, quantity, unit_price_gross, tax_rate_percent?, fee_type_id?}]
-- p_discount: {percentage?, amount?}
-- p_payments: [{payment_method_id, amount}]
-- ---------------------------------------------------------------------------
create or replace function public.create_sale(
  p_warehouse_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_note text,
  p_items jsonb,
  p_fees jsonb,
  p_discount jsonb,
  p_payments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wh public.warehouses%rowtype;
  v_tenant_id uuid;
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_sale_number text;
  v_channel text;
  v_customer_name text;
  v_item jsonb;
  v_fee jsonb;
  v_pay jsonb;
  v_acc public.accessories%rowtype;
  v_tax_pct numeric(5, 2);
  v_unit_shortform text;
  v_qty numeric(14, 3);
  v_unit_net numeric(12, 0);
  v_unit_gross numeric(12, 0);
  v_line_net numeric(12, 0);
  v_line_vat numeric(12, 0);
  v_line_gross_before numeric(12, 0);
  v_line_gross numeric(12, 0);
  v_item_disc_pct numeric(5, 2);
  v_item_disc_amt numeric(12, 0);
  v_sub_net numeric(12, 0) := 0;
  v_sub_vat numeric(12, 0) := 0;
  v_sub_gross numeric(12, 0) := 0;
  v_glob_disc_pct numeric(5, 2);
  v_glob_disc_amt numeric(12, 0);
  v_total_net numeric(12, 0);
  v_total_vat numeric(12, 0);
  v_total_gross numeric(12, 0);
  v_cash_round numeric(12, 0) := 0;
  v_pay_sum numeric(12, 0) := 0;
  v_due numeric(12, 0);
  v_sort integer := 0;
  v_sm_number text;
  v_pm_name text;
  v_pm_id uuid;
  v_pay_amt numeric(12, 0);
  v_pay_status text;
  v_prepared_items jsonb := '[]'::jsonb;
  v_prepared_fees jsonb := '[]'::jsonb;
  v_row jsonb;
  v_fee_name text;
  v_has_cash boolean := false;
begin
  v_channel := coalesce(nullif(trim(p_channel), ''), 'manual');
  if v_channel not in ('manual', 'pos', 'webshop') then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen csatorna.');
  end if;

  if p_warehouse_id is null then
    return jsonb_build_object('ok', false, 'message', 'Válaszd ki a raktárat.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Adj hozzá legalább egy terméket.');
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Adj meg legalább egy fizetést.');
  end if;

  select * into v_wh
  from public.warehouses
  where id = p_warehouse_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A raktár nem található.');
  end if;

  if not v_wh.is_active then
    return jsonb_build_object('ok', false, 'message', 'A raktár inaktív.');
  end if;

  if not public.can_write_tenant(v_wh.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  v_tenant_id := v_wh.tenant_id;

  if p_customer_id is not null then
    select name into v_customer_name
    from public.customers
    where id = p_customer_id and tenant_id = v_tenant_id and deleted_at is null;
    if v_customer_name is null then
      return jsonb_build_object('ok', false, 'message', 'Az ügyfél nem található.');
    end if;
  end if;

  -- Pass 1: products
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_qty := (v_item ->> 'quantity')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen mennyiség.');
    end;

    if v_qty is null or v_qty <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Minden tételnél legyen pozitív mennyiség.');
    end if;

    select * into v_acc
    from public.accessories
    where id = (v_item ->> 'accessory_id')::uuid
      and tenant_id = v_tenant_id
      and deleted_at is null;

    if not found then
      return jsonb_build_object('ok', false, 'message', 'Ismeretlen termék a listában.');
    end if;

    select coalesce(u.shortform, 'db') into v_unit_shortform
    from public.units u where u.id = v_acc.unit_id;

    select coalesce(t.rate_percent, 0)::numeric into v_tax_pct
    from public.tax_rates t where t.id = v_acc.tax_rate_id;

    if v_item ? 'unit_price_gross' and nullif(v_item ->> 'unit_price_gross', '') is not null then
      v_unit_gross := round((v_item ->> 'unit_price_gross')::numeric);
    else
      v_unit_gross := round(coalesce(v_acc.price_net, 0) * (1 + coalesce(v_tax_pct, 0) / 100.0));
    end if;

    -- net from gross
    if v_tax_pct > 0 then
      v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100));
    else
      v_unit_net := v_unit_gross;
    end if;

    v_line_net := round(v_qty * v_unit_net);
    v_line_vat := round(v_line_net * v_tax_pct / 100);
    v_line_gross_before := v_line_net + v_line_vat;

    v_item_disc_pct := coalesce((v_item ->> 'discount_percentage')::numeric, 0);
    v_item_disc_amt := coalesce((v_item ->> 'discount_amount')::numeric, 0);
    if v_item_disc_amt = 0 and v_item_disc_pct > 0 then
      v_item_disc_amt := round(v_line_gross_before * v_item_disc_pct / 100);
    else
      v_item_disc_amt := round(v_item_disc_amt);
    end if;
    if v_item_disc_amt > v_line_gross_before then
      v_item_disc_amt := v_line_gross_before;
    end if;

    v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
    if v_line_gross_before > 0 and v_line_gross > 0 then
      v_line_vat := round(v_line_vat * (v_line_gross::numeric / v_line_gross_before));
      v_line_net := v_line_gross - v_line_vat;
    else
      v_line_vat := 0;
      v_line_net := 0;
    end if;

    -- Soft allow: 0 / negatív készlet is eladható (UI figyelmeztet).
    -- Az out mozgás így on_hand-ot negatívba viheti.

    v_prepared_items := v_prepared_items || jsonb_build_array(jsonb_build_object(
      'accessory_id', v_acc.id,
      'name', v_acc.name,
      'sku', v_acc.sku,
      'unit_shortform', coalesce(v_unit_shortform, 'db'),
      'quantity', v_qty,
      'unit_price_net', v_unit_net,
      'unit_price_gross', v_unit_gross,
      'tax_rate_percent', v_tax_pct,
      'discount_percentage', v_item_disc_pct,
      'discount_amount', v_item_disc_amt,
      'total_net', v_line_net,
      'total_vat', v_line_vat,
      'total_gross', v_line_gross
    ));

    v_sub_net := v_sub_net + v_line_net;
    v_sub_vat := v_sub_vat + v_line_vat;
    v_sub_gross := v_sub_gross + v_line_gross;
  end loop;

  -- Fees (optional)
  if p_fees is not null and jsonb_typeof(p_fees) = 'array' then
    for v_fee in select * from jsonb_array_elements(p_fees)
    loop
      v_fee_name := nullif(trim(coalesce(v_fee ->> 'name', '')), '');
      if v_fee_name is null then
        return jsonb_build_object('ok', false, 'message', 'A díj neve kötelező.');
      end if;
      begin
        v_qty := coalesce((v_fee ->> 'quantity')::numeric, 1);
        v_unit_gross := round((v_fee ->> 'unit_price_gross')::numeric);
      exception when others then
        return jsonb_build_object('ok', false, 'message', 'Érvénytelen díj összeg.');
      end;
      if v_qty <= 0 or v_unit_gross < 0 then
        return jsonb_build_object('ok', false, 'message', 'Érvénytelen díj.');
      end if;
      v_tax_pct := coalesce((v_fee ->> 'tax_rate_percent')::numeric, 27);
      if v_tax_pct > 0 then
        v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100));
      else
        v_unit_net := v_unit_gross;
      end if;
      v_line_net := round(v_qty * v_unit_net);
      v_line_vat := round(v_line_net * v_tax_pct / 100);
      v_line_gross := v_line_net + v_line_vat;

      v_prepared_fees := v_prepared_fees || jsonb_build_array(jsonb_build_object(
        'fee_type_id', nullif(v_fee ->> 'fee_type_id', '')::uuid,
        'name', v_fee_name,
        'quantity', v_qty,
        'unit_price_net', v_unit_net,
        'unit_price_gross', v_unit_gross,
        'tax_rate_percent', v_tax_pct,
        'total_net', v_line_net,
        'total_vat', v_line_vat,
        'total_gross', v_line_gross
      ));

      v_sub_net := v_sub_net + v_line_net;
      v_sub_vat := v_sub_vat + v_line_vat;
      v_sub_gross := v_sub_gross + v_line_gross;
    end loop;
  end if;

  -- Global discount
  v_glob_disc_pct := coalesce((p_discount ->> 'percentage')::numeric, 0);
  v_glob_disc_amt := coalesce((p_discount ->> 'amount')::numeric, 0);
  if v_glob_disc_amt = 0 and v_glob_disc_pct > 0 then
    v_glob_disc_amt := round(v_sub_gross * v_glob_disc_pct / 100);
  else
    v_glob_disc_amt := round(v_glob_disc_amt);
  end if;
  if v_glob_disc_amt > v_sub_gross then
    v_glob_disc_amt := v_sub_gross;
  end if;

  v_total_gross := greatest(0, round(v_sub_gross - v_glob_disc_amt));
  if v_sub_gross > 0 and v_total_gross > 0 then
    v_total_vat := round(v_sub_vat * (v_total_gross::numeric / v_sub_gross));
    v_total_net := v_total_gross - v_total_vat;
  else
    v_total_vat := 0;
    v_total_net := 0;
  end if;

  -- Detect cash + validate payments (before any write)
  for v_pay in select * from jsonb_array_elements(p_payments)
  loop
    v_pm_id := nullif(v_pay ->> 'payment_method_id', '')::uuid;
    begin
      v_pay_amt := round((v_pay ->> 'amount')::numeric);
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen fizetési összeg.');
    end;
    if v_pay_amt is null or v_pay_amt <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Minden fizetés legyen pozitív összeg.');
    end if;
    if v_pm_id is not null then
      select name into v_pm_name
      from public.payment_methods
      where id = v_pm_id and tenant_id = v_tenant_id and deleted_at is null;
      if v_pm_name is null then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen fizetési mód.');
      end if;
      if lower(v_pm_name) like '%készpénz%'
        or lower(v_pm_name) like '%keszpenz%'
        or lower(v_pm_name) = 'cash' then
        v_has_cash := true;
      end if;
    end if;
    v_pay_sum := v_pay_sum + v_pay_amt;
  end loop;

  v_due := v_total_gross;
  if v_has_cash and jsonb_array_length(p_payments) = 1 then
    v_due := public.hungarian_cash_round(v_total_gross);
    v_cash_round := v_due - v_total_gross;
  end if;

  if v_pay_sum + 1 < v_due then
    return jsonb_build_object(
      'ok', false,
      'message',
        'A fizetések összege kevesebb a végösszegnél (fizetendő: '
        || v_due::text || ' Ft, megadva: ' || v_pay_sum::text || ' Ft).'
    );
  end if;

  if v_pay_sum >= v_due - 1 then
    v_pay_status := 'paid';
  elsif v_pay_sum > 0 then
    v_pay_status := 'partial';
  else
    v_pay_status := 'unpaid';
  end if;

  -- Write
  v_sale_number := public.generate_sale_number(v_tenant_id);
  v_sale_id := gen_random_uuid();

  insert into public.sales_orders (
    id, tenant_id, warehouse_id, customer_id,
    sale_number, channel, status, payment_status,
    customer_name_snapshot,
    discount_percentage, discount_amount,
    subtotal_net, total_vat, total_gross, cash_rounding_amount,
    note, fulfilled_at, fulfilled_by, created_by
  ) values (
    v_sale_id, v_tenant_id, p_warehouse_id, p_customer_id,
    v_sale_number, v_channel, 'fulfilled', v_pay_status,
    v_customer_name,
    v_glob_disc_pct, v_glob_disc_amt,
    v_total_net, v_total_vat, v_total_gross, v_cash_round,
    nullif(trim(coalesce(p_note, '')), ''),
    now(), v_user_id, v_user_id
  );

  for v_row in select * from jsonb_array_elements(v_prepared_items)
  loop
    insert into public.sales_order_items (
      tenant_id, sales_order_id, item_kind, accessory_id,
      name_snapshot, sku_snapshot, unit_shortform, quantity,
      unit_price_net, unit_price_gross, tax_rate_percent,
      discount_percentage, discount_amount,
      total_net, total_vat, total_gross, sort_order
    ) values (
      v_tenant_id, v_sale_id, 'product', (v_row ->> 'accessory_id')::uuid,
      v_row ->> 'name', v_row ->> 'sku', v_row ->> 'unit_shortform',
      (v_row ->> 'quantity')::numeric,
      (v_row ->> 'unit_price_net')::numeric,
      (v_row ->> 'unit_price_gross')::numeric,
      (v_row ->> 'tax_rate_percent')::numeric,
      (v_row ->> 'discount_percentage')::numeric,
      (v_row ->> 'discount_amount')::numeric,
      (v_row ->> 'total_net')::numeric,
      (v_row ->> 'total_vat')::numeric,
      (v_row ->> 'total_gross')::numeric,
      v_sort
    );

    v_sm_number := public.generate_stock_movement_number(v_tenant_id);
    insert into public.stock_movements (
      tenant_id, warehouse_id, product_type, accessory_id,
      quantity, movement_type, source_type, source_id,
      note, stock_movement_number, created_by
    ) values (
      v_tenant_id, p_warehouse_id, 'accessory', (v_row ->> 'accessory_id')::uuid,
      (v_row ->> 'quantity')::numeric, 'out', 'sale', v_sale_id,
      v_row ->> 'name', v_sm_number, v_user_id
    );

    v_sort := v_sort + 1;
  end loop;

  for v_row in select * from jsonb_array_elements(v_prepared_fees)
  loop
    insert into public.sales_order_items (
      tenant_id, sales_order_id, item_kind, fee_type_id,
      name_snapshot, sku_snapshot, unit_shortform, quantity,
      unit_price_net, unit_price_gross, tax_rate_percent,
      discount_percentage, discount_amount,
      total_net, total_vat, total_gross, sort_order
    ) values (
      v_tenant_id, v_sale_id, 'fee',
      nullif(v_row ->> 'fee_type_id', '')::uuid,
      v_row ->> 'name', null, 'db',
      (v_row ->> 'quantity')::numeric,
      (v_row ->> 'unit_price_net')::numeric,
      (v_row ->> 'unit_price_gross')::numeric,
      (v_row ->> 'tax_rate_percent')::numeric,
      0, 0,
      (v_row ->> 'total_net')::numeric,
      (v_row ->> 'total_vat')::numeric,
      (v_row ->> 'total_gross')::numeric,
      v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  for v_pay in select * from jsonb_array_elements(p_payments)
  loop
    v_pm_id := nullif(v_pay ->> 'payment_method_id', '')::uuid;
    v_pay_amt := round((v_pay ->> 'amount')::numeric);
    v_pm_name := coalesce(nullif(trim(v_pay ->> 'payment_method_name'), ''), 'Fizetés');
    if v_pm_id is not null then
      select name into v_pm_name
      from public.payment_methods
      where id = v_pm_id and tenant_id = v_tenant_id and deleted_at is null;
      if v_pm_name is null then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen fizetési mód.');
      end if;
    end if;

    insert into public.sales_payments (
      tenant_id, sales_order_id, payment_method_id,
      payment_method_name, amount, status, created_by
    ) values (
      v_tenant_id, v_sale_id, v_pm_id,
      v_pm_name, v_pay_amt, 'completed', v_user_id
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'id', v_sale_id,
    'sale_number', v_sale_number,
    'total_gross', v_total_gross,
    'payment_status', v_pay_status
  );
end;
$$;

revoke all on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;

comment on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) is
  'Azonnali értékesítés: header + items + payments + stock out. All-or-nothing.';

-- ---------------------------------------------------------------------------
-- Page feature + Alap + backfill
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/ertekesitesek',
  'Értékesítések',
  'Értékesítés',
  '/ertekesitesek',
  35,
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
select p.id, '/ertekesitesek'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/ertekesitesek'
from public.tenants t
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/ertekesitesek', true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
