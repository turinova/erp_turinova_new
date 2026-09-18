-- Termék árajánlat (S7 Q0) — NEM lapszabászat quotes
-- Készletmozgás NINCS; convert → create_sale

-- ---------------------------------------------------------------------------
-- sales_quotes
-- ---------------------------------------------------------------------------
create table if not exists public.sales_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,

  quote_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'lost', 'expired', 'cancelled')),

  customer_name_snapshot text,
  customer_email_snapshot text,
  customer_mobile_snapshot text,

  discount_percentage numeric(5, 2) not null default 0
    check (discount_percentage >= 0 and discount_percentage <= 100),
  discount_amount numeric(12, 0) not null default 0
    check (discount_amount >= 0),

  subtotal_net numeric(12, 0) not null default 0,
  total_vat numeric(12, 0) not null default 0,
  total_gross numeric(12, 0) not null default 0,

  valid_until date,
  note text,
  lost_reason text,

  converted_sale_id uuid references public.sales_orders (id) on delete set null,
  sent_at timestamptz,
  accepted_at timestamptz,
  lost_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_by_label_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists sales_quotes_tenant_number_alive_uidx
  on public.sales_quotes (tenant_id, quote_number)
  where deleted_at is null;

create index if not exists sales_quotes_tenant_created_idx
  on public.sales_quotes (tenant_id, created_at desc)
  where deleted_at is null;

create index if not exists sales_quotes_tenant_status_idx
  on public.sales_quotes (tenant_id, status)
  where deleted_at is null;

alter table public.sales_quotes enable row level security;

drop policy if exists sales_quotes_select_member on public.sales_quotes;
create policy sales_quotes_select_member
  on public.sales_quotes for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sales_quotes_write on public.sales_quotes;
create policy sales_quotes_write
  on public.sales_quotes for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

comment on table public.sales_quotes is
  'Termék árajánlat (Értékesítés). Külön a lapszabászat public.quotes-tól. Nincs stock.';

-- ---------------------------------------------------------------------------
-- sales_quote_items
-- ---------------------------------------------------------------------------
create table if not exists public.sales_quote_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sales_quote_id uuid not null references public.sales_quotes (id) on delete cascade,

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
  tax_rate_percent numeric(5, 2) not null default 27,
  discount_percentage numeric(5, 2) not null default 0,
  discount_amount numeric(12, 0) not null default 0,
  total_net numeric(12, 0) not null default 0,
  total_vat numeric(12, 0) not null default 0,
  total_gross numeric(12, 0) not null default 0,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sales_quote_items_quote_alive_idx
  on public.sales_quote_items (sales_quote_id)
  where deleted_at is null;

alter table public.sales_quote_items enable row level security;

drop policy if exists sales_quote_items_select_member on public.sales_quote_items;
create policy sales_quote_items_select_member
  on public.sales_quote_items for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists sales_quote_items_write on public.sales_quote_items;
create policy sales_quote_items_write
  on public.sales_quote_items for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- number
-- ---------------------------------------------------------------------------
create or replace function public.generate_sales_quote_number(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year int := extract(year from now())::int;
  v_max int;
begin
  select coalesce(max(
    nullif(
      substring(quote_number from length('A-' || current_year::text || '-') + 1),
      ''
    )::int
  ), 0)
  into v_max
  from public.sales_quotes
  where tenant_id = p_tenant_id
    and deleted_at is null
    and quote_number like 'A-' || current_year::text || '-%';

  return 'A-' || current_year::text || '-' || lpad((v_max + 1)::text, 3, '0');
end;
$$;

revoke all on function public.generate_sales_quote_number(uuid) from public;
grant execute on function public.generate_sales_quote_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_sales_quote
-- ---------------------------------------------------------------------------
create or replace function public.create_sales_quote(
  p_warehouse_id uuid,
  p_customer_id uuid,
  p_note text default null,
  p_valid_until date default null,
  p_items jsonb default '[]'::jsonb,
  p_fees jsonb default '[]'::jsonb,
  p_discount jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_wh record;
  v_customer record;
  v_quote_id uuid;
  v_quote_number text;
  v_seller_label text;
  v_disc_pct numeric := coalesce((p_discount ->> 'percentage')::numeric, 0);
  v_row jsonb;
  v_acc record;
  v_tax numeric;
  v_qty numeric;
  v_unit_gross numeric;
  v_line_gross numeric;
  v_line_disc numeric;
  v_line_after numeric;
  v_net numeric;
  v_vat numeric;
  v_items_gross numeric := 0;
  v_fees_gross numeric := 0;
  v_subtotal_gross numeric;
  v_global_disc numeric;
  v_total_gross numeric;
  v_total_net numeric := 0;
  v_total_vat numeric := 0;
  v_sort int := 0;
  v_fee_name text;
  v_fee_tax numeric;
  v_fee_gross numeric;
  v_fee_qty numeric;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs bejelentkezés.');
  end if;
  if p_warehouse_id is null or p_customer_id is null then
    return jsonb_build_object('ok', false, 'message', 'Raktár és ügyfél kötelező.');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 then
    return jsonb_build_object('ok', false, 'message', 'Adj hozzá legalább egy terméket.');
  end if;
  if v_disc_pct < 0 or v_disc_pct > 100 then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen kedvezmény.');
  end if;

  select w.id, w.tenant_id into v_wh
  from public.warehouses w
  where w.id = p_warehouse_id and w.deleted_at is null and w.is_active = true;

  if v_wh.id is null then
    return jsonb_build_object('ok', false, 'message', 'Raktár nem található.');
  end if;
  v_tenant_id := v_wh.tenant_id;

  if not public.can_write_tenant(v_tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jog.');
  end if;

  select c.id, c.name, c.email, c.mobile
  into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.tenant_id = v_tenant_id
    and c.deleted_at is null;

  if v_customer.id is null then
    return jsonb_build_object('ok', false, 'message', 'Ügyfél nem található.');
  end if;

  select coalesce(
    (select email from auth.users where id = v_user_id),
    v_user_id::text
  ) into v_seller_label;
  v_quote_number := public.generate_sales_quote_number(v_tenant_id);
  v_quote_id := gen_random_uuid();

  -- First pass: compute line grosses
  for v_row in select * from jsonb_array_elements(p_items)
  loop
    select a.id, a.name, a.sku, coalesce(u.shortform, 'db') as unit_sf,
           coalesce(a.price_net, 0) as price_net,
           coalesce(tr.rate_percent, 27) as tax_pct
    into v_acc
    from public.accessories a
    left join public.units u on u.id = a.unit_id
    left join public.tax_rates tr on tr.id = a.tax_rate_id
    where a.id = (v_row ->> 'accessory_id')::uuid
      and a.tenant_id = v_tenant_id
      and a.deleted_at is null;

    if v_acc.id is null then
      return jsonb_build_object('ok', false, 'message', 'Ismeretlen termék.');
    end if;

    v_qty := (v_row ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen mennyiség.');
    end if;

    v_tax := coalesce((v_row ->> 'tax_rate_percent')::numeric, v_acc.tax_pct);
    v_unit_gross := coalesce(
      (v_row ->> 'unit_price_gross')::numeric,
      round(v_acc.price_net * (1 + v_tax / 100))
    );
    v_line_gross := round(v_qty * v_unit_gross);
    v_line_disc := round(v_line_gross * coalesce((v_row ->> 'discount_percentage')::numeric, 0) / 100);
    v_line_after := greatest(0, v_line_gross - v_line_disc);
    v_items_gross := v_items_gross + v_line_after;
  end loop;

  if p_fees is not null and jsonb_typeof(p_fees) = 'array' then
    for v_row in select * from jsonb_array_elements(p_fees)
    loop
      v_fee_gross := round(coalesce((v_row ->> 'unit_price_gross')::numeric, 0)
        * coalesce((v_row ->> 'quantity')::numeric, 1));
      v_fees_gross := v_fees_gross + greatest(0, v_fee_gross);
    end loop;
  end if;

  v_subtotal_gross := v_items_gross + v_fees_gross;
  v_global_disc := round(v_subtotal_gross * v_disc_pct / 100);
  v_total_gross := greatest(0, v_subtotal_gross - v_global_disc);

  insert into public.sales_quotes (
    id, tenant_id, warehouse_id, customer_id,
    quote_number, status,
    customer_name_snapshot, customer_email_snapshot, customer_mobile_snapshot,
    discount_percentage, discount_amount,
    subtotal_net, total_vat, total_gross,
    valid_until, note,
    created_by, created_by_label_snapshot
  ) values (
    v_quote_id, v_tenant_id, p_warehouse_id, p_customer_id,
    v_quote_number, 'draft',
    v_customer.name, v_customer.email, v_customer.mobile,
    v_disc_pct, v_global_disc,
    0, 0, v_total_gross,
    p_valid_until, nullif(trim(coalesce(p_note, '')), ''),
    v_user_id, v_seller_label
  );

  -- Insert product lines with proportional net/vat after global disc
  for v_row in select * from jsonb_array_elements(p_items)
  loop
    select a.id, a.name, a.sku, coalesce(u.shortform, 'db') as unit_sf,
           coalesce(a.price_net, 0) as price_net,
           coalesce(tr.rate_percent, 27) as tax_pct
    into v_acc
    from public.accessories a
    left join public.units u on u.id = a.unit_id
    left join public.tax_rates tr on tr.id = a.tax_rate_id
    where a.id = (v_row ->> 'accessory_id')::uuid
      and a.tenant_id = v_tenant_id
      and a.deleted_at is null;

    v_qty := (v_row ->> 'quantity')::numeric;
    v_tax := coalesce((v_row ->> 'tax_rate_percent')::numeric, v_acc.tax_pct);
    v_unit_gross := coalesce(
      (v_row ->> 'unit_price_gross')::numeric,
      round(v_acc.price_net * (1 + v_tax / 100))
    );
    v_line_gross := round(v_qty * v_unit_gross);
    v_line_disc := round(v_line_gross * coalesce((v_row ->> 'discount_percentage')::numeric, 0) / 100);
    v_line_after := greatest(0, v_line_gross - v_line_disc);

    if v_subtotal_gross > 0 then
      v_line_after := round(v_line_after * (v_total_gross::numeric / v_subtotal_gross));
    end if;

    if v_tax > 0 then
      v_net := round(v_line_after / (1 + v_tax / 100));
    else
      v_net := v_line_after;
    end if;
    v_vat := v_line_after - v_net;
    v_total_net := v_total_net + v_net;
    v_total_vat := v_total_vat + v_vat;

    insert into public.sales_quote_items (
      tenant_id, sales_quote_id, item_kind, accessory_id,
      name_snapshot, sku_snapshot, unit_shortform, quantity,
      unit_price_net, unit_price_gross, tax_rate_percent,
      discount_percentage, discount_amount,
      total_net, total_vat, total_gross, sort_order
    ) values (
      v_tenant_id, v_quote_id, 'product', v_acc.id,
      v_acc.name, v_acc.sku, v_acc.unit_sf, v_qty,
      round(v_unit_gross / (1 + v_tax / 100.0)), v_unit_gross, v_tax,
      coalesce((v_row ->> 'discount_percentage')::numeric, 0), v_line_disc,
      v_net, v_vat, v_line_after, v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  if p_fees is not null and jsonb_typeof(p_fees) = 'array' then
    for v_row in select * from jsonb_array_elements(p_fees)
    loop
      v_fee_name := coalesce(nullif(trim(v_row ->> 'name'), ''), 'Díj');
      v_fee_tax := coalesce((v_row ->> 'tax_rate_percent')::numeric, 27);
      v_fee_qty := coalesce((v_row ->> 'quantity')::numeric, 1);
      v_fee_gross := round(coalesce((v_row ->> 'unit_price_gross')::numeric, 0) * v_fee_qty);
      v_line_after := greatest(0, v_fee_gross);
      if v_subtotal_gross > 0 then
        v_line_after := round(v_line_after * (v_total_gross::numeric / v_subtotal_gross));
      end if;
      if v_fee_tax > 0 then
        v_net := round(v_line_after / (1 + v_fee_tax / 100));
      else
        v_net := v_line_after;
      end if;
      v_vat := v_line_after - v_net;
      v_total_net := v_total_net + v_net;
      v_total_vat := v_total_vat + v_vat;

      insert into public.sales_quote_items (
        tenant_id, sales_quote_id, item_kind, fee_type_id,
        name_snapshot, unit_shortform, quantity,
        unit_price_net, unit_price_gross, tax_rate_percent,
        discount_percentage, discount_amount,
        total_net, total_vat, total_gross, sort_order
      ) values (
        v_tenant_id, v_quote_id, 'fee',
        nullif(v_row ->> 'fee_type_id', '')::uuid,
        v_fee_name, 'db', v_fee_qty,
        round(coalesce((v_row ->> 'unit_price_gross')::numeric, 0) / (1 + v_fee_tax / 100.0)),
        coalesce((v_row ->> 'unit_price_gross')::numeric, 0),
        v_fee_tax, 0, 0,
        v_net, v_vat, v_line_after, v_sort
      );
      v_sort := v_sort + 1;
    end loop;
  end if;

  update public.sales_quotes
  set subtotal_net = v_total_net,
      total_vat = v_total_vat,
      total_gross = v_total_gross,
      updated_at = now()
  where id = v_quote_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_quote_id,
    'quote_number', v_quote_number
  );
end;
$$;

revoke all on function public.create_sales_quote(uuid, uuid, text, date, jsonb, jsonb, jsonb) from public;
grant execute on function public.create_sales_quote(uuid, uuid, text, date, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- set_sales_quote_status
-- ---------------------------------------------------------------------------
create or replace function public.set_sales_quote_status(
  p_quote_id uuid,
  p_status text,
  p_lost_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_q public.sales_quotes%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs bejelentkezés.');
  end if;

  select * into v_q
  from public.sales_quotes
  where id = p_quote_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Ajánlat nem található.');
  end if;
  if not public.can_write_tenant(v_q.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jog.');
  end if;
  if v_q.converted_sale_id is not null or v_q.status = 'accepted' then
    return jsonb_build_object('ok', false, 'message', 'Az ajánlatból már készült eladás.');
  end if;
  if v_q.status in ('cancelled', 'lost', 'expired') then
    return jsonb_build_object('ok', false, 'message', 'Lezárt ajánlatot nem módosíthatsz.');
  end if;

  if p_status = 'sent' then
    if v_q.status not in ('draft', 'sent') then
      return jsonb_build_object('ok', false, 'message', 'Csak piszkozatból jelölhető kiküldve.');
    end if;
    update public.sales_quotes
    set status = 'sent', sent_at = coalesce(sent_at, now()), updated_at = now()
    where id = p_quote_id;
  elsif p_status = 'lost' then
    if length(trim(coalesce(p_lost_reason, ''))) < 2 then
      return jsonb_build_object('ok', false, 'message', 'Add meg az elvesztés okát.');
    end if;
    if v_q.status not in ('draft', 'sent') then
      return jsonb_build_object('ok', false, 'message', 'Ebből az állapotból nem jelölhető elveszettnek.');
    end if;
    update public.sales_quotes
    set status = 'lost',
        lost_reason = trim(p_lost_reason),
        lost_at = now(),
        updated_at = now()
    where id = p_quote_id;
  elsif p_status = 'cancelled' then
    if v_q.status not in ('draft', 'sent') then
      return jsonb_build_object('ok', false, 'message', 'Ebből az állapotból nem törölhető.');
    end if;
    update public.sales_quotes
    set status = 'cancelled', updated_at = now()
    where id = p_quote_id;
  elsif p_status = 'expired' then
    if v_q.status not in ('draft', 'sent') then
      return jsonb_build_object('ok', false, 'message', 'Ebből az állapotból nem járatható le.');
    end if;
    update public.sales_quotes
    set status = 'expired', updated_at = now()
    where id = p_quote_id;
  else
    return jsonb_build_object('ok', false, 'message', 'Ismeretlen státusz.');
  end if;

  return jsonb_build_object('ok', true, 'id', p_quote_id, 'status', p_status);
end;
$$;

revoke all on function public.set_sales_quote_status(uuid, text, text) from public;
grant execute on function public.set_sales_quote_status(uuid, text, text) to authenticated;

-- Mark converted after successful create_sale (called from app)
create or replace function public.mark_sales_quote_converted(
  p_quote_id uuid,
  p_sale_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_q public.sales_quotes%rowtype;
  v_sale record;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs bejelentkezés.');
  end if;

  select * into v_q
  from public.sales_quotes
  where id = p_quote_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Ajánlat nem található.');
  end if;
  if not public.can_write_tenant(v_q.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jog.');
  end if;
  if v_q.converted_sale_id is not null then
    return jsonb_build_object('ok', false, 'message', 'Már konvertálva.');
  end if;
  if v_q.status not in ('draft', 'sent') then
    return jsonb_build_object('ok', false, 'message', 'Ebből az állapotból nem készíthető eladás.');
  end if;
  if v_q.valid_until is not null and v_q.valid_until < current_date then
    return jsonb_build_object('ok', false, 'message', 'Az ajánlat lejárt.');
  end if;

  select id, tenant_id into v_sale
  from public.sales_orders
  where id = p_sale_id and deleted_at is null;

  if v_sale.id is null or v_sale.tenant_id is distinct from v_q.tenant_id then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen eladás.');
  end if;

  update public.sales_quotes
  set status = 'accepted',
      converted_sale_id = p_sale_id,
      accepted_at = now(),
      updated_at = now()
  where id = p_quote_id;

  return jsonb_build_object('ok', true, 'id', p_quote_id, 'sale_id', p_sale_id);
end;
$$;

revoke all on function public.mark_sales_quote_converted(uuid, uuid) from public;
grant execute on function public.mark_sales_quote_converted(uuid, uuid) to authenticated;
