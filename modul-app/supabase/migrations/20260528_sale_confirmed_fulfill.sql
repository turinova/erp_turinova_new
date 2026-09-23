-- S1.5: unpaid utalás → confirmed (nincs stock); p_fulfill_now = áru átadva most.
-- fulfill_sale: confirmed → fulfilled + stock out.
-- create_sale: 20260527 body + status/stock branch.


drop function if exists public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid);

create or replace function public.create_sale(
  p_warehouse_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_note text,
  p_items jsonb,
  p_fees jsonb,
  p_discount jsonb,
  p_payments jsonb,
  p_pos_register_id uuid default null,
  p_fulfill_now boolean default false
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
  v_seller_label text;
  v_pos_register_id uuid;
  v_pos_shift_id uuid;
  v_sale_id uuid;
  v_sale_number text;
  v_channel text;
  v_customer_name text;
  v_customer_email text;
  v_customer_mobile text;
  v_billing_name text;
  v_billing_country text;
  v_billing_city text;
  v_billing_postal_code text;
  v_billing_street text;
  v_billing_house_number text;
  v_billing_tax_number text;
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
  v_do_fulfill boolean := false;
  v_sale_status text;
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

  -- Üres tömb = unpaid (utalás / későbbi settlement). Null / nem tömb = hiba.
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen fizetés lista.');
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

  select coalesce(u.email, u.id::text) into v_seller_label
  from auth.users u where u.id = v_user_id;

  v_pos_register_id := null;
  v_pos_shift_id := null;
  if v_channel = 'pos' then
    if p_pos_register_id is null then
      return jsonb_build_object('ok', false, 'message', 'Válaszd ki a pénztárat.');
    end if;
    select r.id into v_pos_register_id
    from public.pos_registers r
    where r.id = p_pos_register_id
      and r.tenant_id = v_tenant_id
      and r.warehouse_id = p_warehouse_id
      and r.is_active = true
      and r.deleted_at is null;
    if v_pos_register_id is null then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen vagy inaktív pénztár.');
    end if;
    select s.id into v_pos_shift_id
    from public.pos_shifts s
    where s.pos_register_id = v_pos_register_id
      and s.tenant_id = v_tenant_id
      and s.status = 'open'
    for update;
    if v_pos_shift_id is null then
      return jsonb_build_object('ok', false, 'message', 'Előbb nyisd meg a műszakot.');
    end if;
  end if;

  if p_customer_id is not null then
    select
      c.name,
      c.email,
      c.mobile,
      c.billing_name,
      coalesce(nullif(trim(c.billing_country), ''), 'Magyarország'),
      c.billing_city,
      c.billing_postal_code,
      c.billing_street,
      c.billing_house_number,
      c.billing_tax_number
    into
      v_customer_name,
      v_customer_email,
      v_customer_mobile,
      v_billing_name,
      v_billing_country,
      v_billing_city,
      v_billing_postal_code,
      v_billing_street,
      v_billing_house_number,
      v_billing_tax_number
    from public.customers c
    where c.id = p_customer_id and c.tenant_id = v_tenant_id and c.deleted_at is null;
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

  -- Üres payments: unpaid, nincs összegellenőrzés. Részfizetés: pay_sum < due → partial.
  if jsonb_array_length(p_payments) > 0 and v_pay_sum + 1 < v_due then
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

  -- Paid/partial: mindig teljesít (stock out). Unpaid: csak ha p_fulfill_now.
  v_do_fulfill := jsonb_array_length(p_payments) > 0 or coalesce(p_fulfill_now, false);
  v_sale_status := case when v_do_fulfill then 'fulfilled' else 'confirmed' end;

  -- Write
  v_sale_number := public.generate_sale_number(v_tenant_id);
  v_sale_id := gen_random_uuid();

  insert into public.sales_orders (
    id, tenant_id, warehouse_id, customer_id,
    sale_number, channel, status, payment_status,
    customer_name_snapshot,
    customer_email_snapshot,
    customer_mobile_snapshot,
    billing_name_snapshot,
    billing_country_snapshot,
    billing_city_snapshot,
    billing_postal_code_snapshot,
    billing_street_snapshot,
    billing_house_number_snapshot,
    billing_tax_number_snapshot,
    discount_percentage, discount_amount,
    subtotal_net, total_vat, total_gross, cash_rounding_amount,
    note, fulfilled_at, fulfilled_by, created_by,
    created_by_label_snapshot, pos_shift_id, pos_register_id
  ) values (
    v_sale_id, v_tenant_id, p_warehouse_id, p_customer_id,
    v_sale_number, v_channel, v_sale_status, v_pay_status,
    v_customer_name,
    v_customer_email,
    v_customer_mobile,
    v_billing_name,
    v_billing_country,
    v_billing_city,
    v_billing_postal_code,
    v_billing_street,
    v_billing_house_number,
    v_billing_tax_number,
    v_glob_disc_pct, v_glob_disc_amt,
    v_total_net, v_total_vat, v_total_gross, v_cash_round,
    nullif(trim(coalesce(p_note, '')), ''),
    case when v_do_fulfill then now() else null end,
    case when v_do_fulfill then v_user_id else null end,
    v_user_id,
    v_seller_label, v_pos_shift_id, v_pos_register_id
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

    if v_do_fulfill then
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
    end if;

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
    'payment_status', v_pay_status,
    'status', v_sale_status
  );
end;
$$;


revoke all on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid, boolean) from public;
grant execute on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid, boolean) to authenticated;

comment on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid, boolean) is
  'Eladás: paid→fulfilled+stock; unpaid+fulfill_now→fulfilled+stock unpaid; unpaid default→confirmed no stock.';

-- ---------------------------------------------------------------------------
-- fulfill_sale — confirmed → fulfilled + stock out (áru átadása)
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_sale(p_sales_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales_orders%rowtype;
  v_user_id uuid := auth.uid();
  v_item record;
  v_sm_number text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs bejelentkezés.');
  end if;

  select * into v_sale
  from public.sales_orders
  where id = p_sales_order_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Az eladás nem található.');
  end if;

  if not public.can_write_tenant(v_sale.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  if v_sale.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'message', 'Törölt eladás nem teljesíthető.');
  end if;

  if v_sale.status = 'fulfilled' or v_sale.status = 'partially_returned' or v_sale.status = 'returned' then
    return jsonb_build_object('ok', false, 'message', 'Az eladás már teljesítve van.');
  end if;

  if v_sale.status <> 'confirmed' then
    return jsonb_build_object('ok', false, 'message', 'Csak függőben lévő (confirmed) eladás teljesíthető.');
  end if;

  for v_item in
    select id, accessory_id, name_snapshot, quantity
    from public.sales_order_items
    where sales_order_id = v_sale.id
      and deleted_at is null
      and item_kind = 'product'
      and accessory_id is not null
    order by sort_order, created_at
  loop
    v_sm_number := public.generate_stock_movement_number(v_sale.tenant_id);
    insert into public.stock_movements (
      tenant_id, warehouse_id, product_type, accessory_id,
      quantity, movement_type, source_type, source_id,
      note, stock_movement_number, created_by
    ) values (
      v_sale.tenant_id, v_sale.warehouse_id, 'accessory', v_item.accessory_id,
      v_item.quantity, 'out', 'sale', v_sale.id,
      v_item.name_snapshot, v_sm_number, v_user_id
    );
  end loop;

  update public.sales_orders
  set status = 'fulfilled',
      fulfilled_at = now(),
      fulfilled_by = v_user_id,
      updated_at = now()
  where id = v_sale.id;

  return jsonb_build_object(
    'ok', true,
    'id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'status', 'fulfilled'
  );
end;
$$;

revoke all on function public.fulfill_sale(uuid) from public;
grant execute on function public.fulfill_sale(uuid) to authenticated;

comment on function public.fulfill_sale(uuid) is
  'Confirmed eladás áruátadása: stock out + status=fulfilled.';
