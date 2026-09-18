-- Q1: árajánlat számlázási snapshot (doksi-adat, nem törzs)
-- + cloned_from_id (revízió / másolat link)
-- create_sales_quote: opcionális p_billing felülírás
-- update_sales_quote_draft: draft header + billing szerkesztés

-- ---------------------------------------------------------------------------
-- columns
-- ---------------------------------------------------------------------------
alter table public.sales_quotes
  add column if not exists billing_name_snapshot text,
  add column if not exists billing_country_snapshot text,
  add column if not exists billing_city_snapshot text,
  add column if not exists billing_postal_code_snapshot text,
  add column if not exists billing_street_snapshot text,
  add column if not exists billing_house_number_snapshot text,
  add column if not exists billing_tax_number_snapshot text,
  add column if not exists cloned_from_id uuid references public.sales_quotes (id) on delete set null;

comment on column public.sales_quotes.billing_name_snapshot is
  'Számlázási név az ajánlaton (snapshot). Nem élő ügyféltörzs.';
comment on column public.sales_quotes.cloned_from_id is
  'Másolat / revízió forrás ajánlat.';

create index if not exists sales_quotes_cloned_from_idx
  on public.sales_quotes (cloned_from_id)
  where cloned_from_id is not null and deleted_at is null;

-- meglévő ajánlatok: törzs → snapshot backfill
update public.sales_quotes q
set
  billing_name_snapshot = coalesce(q.billing_name_snapshot, c.billing_name),
  billing_country_snapshot = coalesce(
    q.billing_country_snapshot,
    nullif(trim(c.billing_country), ''),
    'Magyarország'
  ),
  billing_city_snapshot = coalesce(q.billing_city_snapshot, c.billing_city),
  billing_postal_code_snapshot = coalesce(
    q.billing_postal_code_snapshot,
    c.billing_postal_code
  ),
  billing_street_snapshot = coalesce(q.billing_street_snapshot, c.billing_street),
  billing_house_number_snapshot = coalesce(
    q.billing_house_number_snapshot,
    c.billing_house_number
  ),
  billing_tax_number_snapshot = coalesce(
    q.billing_tax_number_snapshot,
    c.billing_tax_number
  )
from public.customers c
where c.id = q.customer_id
  and c.tenant_id = q.tenant_id
  and q.deleted_at is null
  and q.billing_name_snapshot is null
  and q.billing_city_snapshot is null
  and q.billing_street_snapshot is null
  and q.billing_tax_number_snapshot is null;

-- ---------------------------------------------------------------------------
-- create_sales_quote — új aláírás (p_billing, p_cloned_from_id)
-- ---------------------------------------------------------------------------
drop function if exists public.create_sales_quote(uuid, uuid, text, date, jsonb, jsonb, jsonb);

create or replace function public.create_sales_quote(
  p_warehouse_id uuid,
  p_customer_id uuid,
  p_note text default null,
  p_valid_until date default null,
  p_items jsonb default '[]'::jsonb,
  p_fees jsonb default '[]'::jsonb,
  p_discount jsonb default '{}'::jsonb,
  p_billing jsonb default null,
  p_cloned_from_id uuid default null
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
  v_billing_name text;
  v_billing_country text;
  v_billing_city text;
  v_billing_postal_code text;
  v_billing_street text;
  v_billing_house_number text;
  v_billing_tax_number text;
  v_clone public.sales_quotes%rowtype;
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

  select
    c.id, c.name, c.email, c.mobile,
    c.billing_name,
    coalesce(nullif(trim(c.billing_country), ''), 'Magyarország') as billing_country,
    c.billing_city,
    c.billing_postal_code,
    c.billing_street,
    c.billing_house_number,
    c.billing_tax_number
  into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.tenant_id = v_tenant_id
    and c.deleted_at is null;

  if v_customer.id is null then
    return jsonb_build_object('ok', false, 'message', 'Ügyfél nem található.');
  end if;

  if p_cloned_from_id is not null then
    select * into v_clone
    from public.sales_quotes
    where id = p_cloned_from_id
      and tenant_id = v_tenant_id
      and deleted_at is null;
    if not found then
      return jsonb_build_object('ok', false, 'message', 'A forrás ajánlat nem található.');
    end if;
  end if;

  -- Billing: doksi felülírás, különben ügyfél default
  if p_billing is not null and jsonb_typeof(p_billing) = 'object' then
    v_billing_name := nullif(trim(coalesce(p_billing ->> 'billing_name', '')), '');
    v_billing_country := coalesce(
      nullif(trim(coalesce(p_billing ->> 'billing_country', '')), ''),
      'Magyarország'
    );
    v_billing_city := nullif(trim(coalesce(p_billing ->> 'billing_city', '')), '');
    v_billing_postal_code := nullif(trim(coalesce(p_billing ->> 'billing_postal_code', '')), '');
    v_billing_street := nullif(trim(coalesce(p_billing ->> 'billing_street', '')), '');
    v_billing_house_number := nullif(trim(coalesce(p_billing ->> 'billing_house_number', '')), '');
    v_billing_tax_number := nullif(trim(coalesce(p_billing ->> 'billing_tax_number', '')), '');
  else
    v_billing_name := v_customer.billing_name;
    v_billing_country := v_customer.billing_country;
    v_billing_city := v_customer.billing_city;
    v_billing_postal_code := v_customer.billing_postal_code;
    v_billing_street := v_customer.billing_street;
    v_billing_house_number := v_customer.billing_house_number;
    v_billing_tax_number := v_customer.billing_tax_number;
  end if;

  select coalesce(
    (select email from auth.users where id = v_user_id),
    v_user_id::text
  ) into v_seller_label;
  v_quote_number := public.generate_sales_quote_number(v_tenant_id);
  v_quote_id := gen_random_uuid();

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
    billing_name_snapshot, billing_country_snapshot, billing_city_snapshot,
    billing_postal_code_snapshot, billing_street_snapshot,
    billing_house_number_snapshot, billing_tax_number_snapshot,
    discount_percentage, discount_amount,
    subtotal_net, total_vat, total_gross,
    valid_until, note, cloned_from_id,
    created_by, created_by_label_snapshot
  ) values (
    v_quote_id, v_tenant_id, p_warehouse_id, p_customer_id,
    v_quote_number, 'draft',
    v_customer.name, v_customer.email, v_customer.mobile,
    v_billing_name, v_billing_country, v_billing_city,
    v_billing_postal_code, v_billing_street,
    v_billing_house_number, v_billing_tax_number,
    v_disc_pct, v_global_disc,
    0, 0, v_total_gross,
    p_valid_until, nullif(trim(coalesce(p_note, '')), ''), p_cloned_from_id,
    v_user_id, v_seller_label
  );

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

revoke all on function public.create_sales_quote(
  uuid, uuid, text, date, jsonb, jsonb, jsonb, jsonb, uuid
) from public;
grant execute on function public.create_sales_quote(
  uuid, uuid, text, date, jsonb, jsonb, jsonb, jsonb, uuid
) to authenticated;

-- ---------------------------------------------------------------------------
-- update_sales_quote_draft — csak draft: note, valid_until, billing
-- ---------------------------------------------------------------------------
create or replace function public.update_sales_quote_draft(
  p_quote_id uuid,
  p_note text default null,
  p_valid_until date default null,
  p_billing jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_q public.sales_quotes%rowtype;
  v_billing_name text;
  v_billing_country text;
  v_billing_city text;
  v_billing_postal_code text;
  v_billing_street text;
  v_billing_house_number text;
  v_billing_tax_number text;
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
  if v_q.status <> 'draft' then
    return jsonb_build_object(
      'ok', false,
      'message', 'Csak piszkozat szerkeszthető. Kiküldöttnél használj Másolatot.'
    );
  end if;

  if p_billing is not null and jsonb_typeof(p_billing) = 'object' then
    v_billing_name := nullif(trim(coalesce(p_billing ->> 'billing_name', '')), '');
    v_billing_country := coalesce(
      nullif(trim(coalesce(p_billing ->> 'billing_country', '')), ''),
      'Magyarország'
    );
    v_billing_city := nullif(trim(coalesce(p_billing ->> 'billing_city', '')), '');
    v_billing_postal_code := nullif(trim(coalesce(p_billing ->> 'billing_postal_code', '')), '');
    v_billing_street := nullif(trim(coalesce(p_billing ->> 'billing_street', '')), '');
    v_billing_house_number := nullif(trim(coalesce(p_billing ->> 'billing_house_number', '')), '');
    v_billing_tax_number := nullif(trim(coalesce(p_billing ->> 'billing_tax_number', '')), '');
  else
    v_billing_name := v_q.billing_name_snapshot;
    v_billing_country := coalesce(v_q.billing_country_snapshot, 'Magyarország');
    v_billing_city := v_q.billing_city_snapshot;
    v_billing_postal_code := v_q.billing_postal_code_snapshot;
    v_billing_street := v_q.billing_street_snapshot;
    v_billing_house_number := v_q.billing_house_number_snapshot;
    v_billing_tax_number := v_q.billing_tax_number_snapshot;
  end if;

  update public.sales_quotes
  set
    note = nullif(trim(coalesce(p_note, '')), ''),
    valid_until = p_valid_until,
    billing_name_snapshot = v_billing_name,
    billing_country_snapshot = v_billing_country,
    billing_city_snapshot = v_billing_city,
    billing_postal_code_snapshot = v_billing_postal_code,
    billing_street_snapshot = v_billing_street,
    billing_house_number_snapshot = v_billing_house_number,
    billing_tax_number_snapshot = v_billing_tax_number,
    updated_at = now()
  where id = p_quote_id;

  return jsonb_build_object('ok', true, 'id', p_quote_id);
end;
$$;

revoke all on function public.update_sales_quote_draft(uuid, text, date, jsonb) from public;
grant execute on function public.update_sales_quote_draft(uuid, text, date, jsonb) to authenticated;

comment on function public.update_sales_quote_draft(uuid, text, date, jsonb) is
  'Draft árajánlat: megjegyzés, érvényesség, számlázási snapshot. Törzset nem ír.';
