-- Eladás / árajánlat: táblás (m²) + szálas/munkalap (m) tételek.
-- Eladási qty 1 tizedes; készlet tábla db / szál db|fm átváltással.
-- Anyag sorokhoz lapszabaszat entitlement.

alter table public.sales_order_items drop constraint if exists sales_order_items_item_kind_check;
alter table public.sales_order_items drop constraint if exists sales_order_items_product_has_accessory;
alter table public.sales_order_items add column if not exists sheet_material_id uuid references public.sheet_materials (id) on delete restrict;
alter table public.sales_order_items add column if not exists linear_material_id uuid references public.linear_materials (id) on delete restrict;

alter table public.sales_order_items
  add constraint sales_order_items_item_kind_check
  check (item_kind in ('product', 'fee', 'sheet_material', 'linear_material'));

alter table public.sales_order_items
  add constraint sales_order_items_line_fk_check
  check (
    (item_kind = 'product' and accessory_id is not null and sheet_material_id is null and linear_material_id is null)
    or (item_kind = 'fee' and accessory_id is null and sheet_material_id is null and linear_material_id is null)
    or (item_kind = 'sheet_material' and sheet_material_id is not null and accessory_id is null and linear_material_id is null)
    or (item_kind = 'linear_material' and linear_material_id is not null and accessory_id is null and sheet_material_id is null)
  );

alter table public.sales_quote_items drop constraint if exists sales_quote_items_item_kind_check;
alter table public.sales_quote_items add column if not exists sheet_material_id uuid references public.sheet_materials (id) on delete restrict;
alter table public.sales_quote_items add column if not exists linear_material_id uuid references public.linear_materials (id) on delete restrict;

alter table public.sales_quote_items
  add constraint sales_quote_items_item_kind_check
  check (item_kind in ('product', 'fee', 'sheet_material', 'linear_material'));

alter table public.sales_quote_items drop constraint if exists sales_quote_items_line_fk_check;
alter table public.sales_quote_items
  add constraint sales_quote_items_line_fk_check
  check (
    (item_kind = 'product' and accessory_id is not null and sheet_material_id is null and linear_material_id is null)
    or (item_kind = 'fee' and accessory_id is null and sheet_material_id is null and linear_material_id is null)
    or (item_kind = 'sheet_material' and sheet_material_id is not null and accessory_id is null and linear_material_id is null)
    or (item_kind = 'linear_material' and linear_material_id is not null and accessory_id is null and sheet_material_id is null)
  );

-- Készletnapló: sale source
alter table public.sheet_stock_movements
  drop constraint if exists sheet_stock_movements_source_type_check;
alter table public.sheet_stock_movements
  add constraint sheet_stock_movements_source_type_check
  check (source_type in ('purchase_receipt', 'adjustment', 'transfer', 'sale'));

alter table public.linear_stock_movements
  drop constraint if exists linear_stock_movements_source_type_check;
alter table public.linear_stock_movements
  add constraint linear_stock_movements_source_type_check
  check (source_type in ('purchase_receipt', 'adjustment', 'transfer', 'sale'));


drop function if exists public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid, boolean);
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
  v_line_kind text;
  v_sheet public.sheet_materials%rowtype;
  v_linear public.linear_materials%rowtype;
  v_area_m2 numeric(14, 6);
  v_piece_m numeric(14, 6);
  v_stock_qty numeric(14, 6);
  v_sku_snap text;
  v_has_lapszab boolean;
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

  -- Pass 1: products + materials (sheet m2 / linear m)
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

    v_line_kind := coalesce(
      nullif(trim(v_item ->> 'line_kind'), ''),
      case
        when nullif(v_item ->> 'sheet_material_id', '') is not null then 'sheet_material'
        when nullif(v_item ->> 'linear_material_id', '') is not null then 'linear_material'
        else 'product'
      end
    );

    if v_line_kind in ('sheet_material', 'linear_material') then
      v_qty := round(v_qty::numeric, 1);
      if v_qty <= 0 then
        return jsonb_build_object('ok', false, 'message', 'Anyag mennyiség legyen legalább 0,1.');
      end if;

      select exists(
        select 1 from public.tenant_entitlements te
        where te.tenant_id = v_tenant_id and te.feature_key = 'lapszabaszat'
      ) into v_has_lapszab;
      if not coalesce(v_has_lapszab, false) then
        return jsonb_build_object('ok', false, 'message', 'Anyag eladáshoz Lapszabászat add-on kell.');
      end if;
    end if;

    if v_line_kind = 'product' then
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
      v_sku_snap := v_acc.sku;
      v_stock_qty := v_qty;
      if v_tax_pct > 0 then v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100)); else v_unit_net := v_unit_gross; end if;
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
      if v_item_disc_amt > v_line_gross_before then v_item_disc_amt := v_line_gross_before; end if;
      v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
      if v_line_gross_before > 0 and v_line_gross > 0 then
        v_line_vat := round(v_line_vat * (v_line_gross::numeric / v_line_gross_before));
        v_line_net := v_line_gross - v_line_vat;
      else
        v_line_vat := 0; v_line_net := 0;
      end if;
      v_prepared_items := v_prepared_items || jsonb_build_array(jsonb_build_object(
        'item_kind', 'product', 'accessory_id', v_acc.id,
        'sheet_material_id', null, 'linear_material_id', null,
        'name', v_acc.name, 'sku', v_sku_snap,
        'unit_shortform', coalesce(v_unit_shortform, 'db'),
        'quantity', v_qty, 'stock_qty', v_stock_qty,
        'unit_price_net', v_unit_net, 'unit_price_gross', v_unit_gross,
        'tax_rate_percent', v_tax_pct,
        'discount_percentage', v_item_disc_pct, 'discount_amount', v_item_disc_amt,
        'total_net', v_line_net, 'total_vat', v_line_vat, 'total_gross', v_line_gross
      ));

    elsif v_line_kind = 'sheet_material' then
      select * into v_sheet from public.sheet_materials
      where id = (v_item ->> 'sheet_material_id')::uuid and tenant_id = v_tenant_id and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen táblás anyag a listában.');
      end if;
      if not v_sheet.active then
        return jsonb_build_object('ok', false, 'message', 'Inaktív táblás anyag nem adható el.');
      end if;
      v_area_m2 := (v_sheet.length_mm::numeric * v_sheet.width_mm::numeric) / 1000000.0;
      if v_area_m2 <= 0 then
        return jsonb_build_object('ok', false, 'message', 'Érvénytelen tábla méret.');
      end if;
      select coalesce(t.rate_percent, 0)::numeric into v_tax_pct from public.tax_rates t where t.id = v_sheet.tax_rate_id;
      if v_item ? 'unit_price_gross' and nullif(v_item ->> 'unit_price_gross', '') is not null then
        v_unit_gross := round((v_item ->> 'unit_price_gross')::numeric);
      else
        v_unit_gross := round(coalesce(v_sheet.price_net, 0) * (1 + coalesce(v_tax_pct, 0) / 100.0));
      end if;
      v_unit_shortform := 'm2';
      v_sku_snap := v_sheet.length_mm::text || '×' || v_sheet.width_mm::text || '×' || trim(to_char(v_sheet.thickness_mm, 'FM999990.99'));
      v_stock_qty := round(v_qty / v_area_m2, 6);
      if v_tax_pct > 0 then v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100)); else v_unit_net := v_unit_gross; end if;
      v_line_net := round(v_qty * v_unit_net);
      v_line_vat := round(v_line_net * v_tax_pct / 100);
      v_line_gross_before := v_line_net + v_line_vat;
      v_item_disc_pct := coalesce((v_item ->> 'discount_percentage')::numeric, 0);
      v_item_disc_amt := coalesce((v_item ->> 'discount_amount')::numeric, 0);
      if v_item_disc_amt = 0 and v_item_disc_pct > 0 then
        v_item_disc_amt := round(v_line_gross_before * v_item_disc_pct / 100);
      else v_item_disc_amt := round(v_item_disc_amt); end if;
      if v_item_disc_amt > v_line_gross_before then v_item_disc_amt := v_line_gross_before; end if;
      v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
      if v_line_gross_before > 0 and v_line_gross > 0 then
        v_line_vat := round(v_line_vat * (v_line_gross::numeric / v_line_gross_before));
        v_line_net := v_line_gross - v_line_vat;
      else v_line_vat := 0; v_line_net := 0; end if;
      v_prepared_items := v_prepared_items || jsonb_build_array(jsonb_build_object(
        'item_kind', 'sheet_material', 'accessory_id', null,
        'sheet_material_id', v_sheet.id, 'linear_material_id', null,
        'name', v_sheet.name, 'sku', v_sku_snap, 'unit_shortform', v_unit_shortform,
        'quantity', v_qty, 'stock_qty', v_stock_qty,
        'unit_price_net', v_unit_net, 'unit_price_gross', v_unit_gross,
        'tax_rate_percent', v_tax_pct,
        'discount_percentage', v_item_disc_pct, 'discount_amount', v_item_disc_amt,
        'total_net', v_line_net, 'total_vat', v_line_vat, 'total_gross', v_line_gross
      ));

    elsif v_line_kind = 'linear_material' then
      select * into v_linear from public.linear_materials
      where id = (v_item ->> 'linear_material_id')::uuid and tenant_id = v_tenant_id and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen szálas anyag a listában.');
      end if;
      if not v_linear.active then
        return jsonb_build_object('ok', false, 'message', 'Inaktív szálas anyag nem adható el.');
      end if;
      select coalesce(t.rate_percent, 0)::numeric into v_tax_pct from public.tax_rates t where t.id = v_linear.tax_rate_id;
      if v_item ? 'unit_price_gross' and nullif(v_item ->> 'unit_price_gross', '') is not null then
        v_unit_gross := round((v_item ->> 'unit_price_gross')::numeric);
      else
        v_unit_gross := round(coalesce(v_linear.price_net, 0) * (1 + coalesce(v_tax_pct, 0) / 100.0));
      end if;
      v_unit_shortform := 'm';
      v_sku_snap := v_linear.material_type || ' · ' || v_linear.length_mm::text || ' mm';
      v_piece_m := v_linear.length_mm::numeric / 1000.0;
      if coalesce(v_linear.stock_unit, 'db') = 'fm' then
        v_stock_qty := v_qty;
      else
        if v_piece_m <= 0 then
          return jsonb_build_object('ok', false, 'message', 'Érvénytelen szál hossz.');
        end if;
        v_stock_qty := round(v_qty / v_piece_m, 6);
      end if;
      if v_tax_pct > 0 then v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100)); else v_unit_net := v_unit_gross; end if;
      v_line_net := round(v_qty * v_unit_net);
      v_line_vat := round(v_line_net * v_tax_pct / 100);
      v_line_gross_before := v_line_net + v_line_vat;
      v_item_disc_pct := coalesce((v_item ->> 'discount_percentage')::numeric, 0);
      v_item_disc_amt := coalesce((v_item ->> 'discount_amount')::numeric, 0);
      if v_item_disc_amt = 0 and v_item_disc_pct > 0 then
        v_item_disc_amt := round(v_line_gross_before * v_item_disc_pct / 100);
      else v_item_disc_amt := round(v_item_disc_amt); end if;
      if v_item_disc_amt > v_line_gross_before then v_item_disc_amt := v_line_gross_before; end if;
      v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
      if v_line_gross_before > 0 and v_line_gross > 0 then
        v_line_vat := round(v_line_vat * (v_line_gross::numeric / v_line_gross_before));
        v_line_net := v_line_gross - v_line_vat;
      else v_line_vat := 0; v_line_net := 0; end if;
      v_prepared_items := v_prepared_items || jsonb_build_array(jsonb_build_object(
        'item_kind', 'linear_material', 'accessory_id', null,
        'sheet_material_id', null, 'linear_material_id', v_linear.id,
        'name', v_linear.name, 'sku', v_sku_snap, 'unit_shortform', v_unit_shortform,
        'quantity', v_qty, 'stock_qty', v_stock_qty,
        'unit_price_net', v_unit_net, 'unit_price_gross', v_unit_gross,
        'tax_rate_percent', v_tax_pct,
        'discount_percentage', v_item_disc_pct, 'discount_amount', v_item_disc_amt,
        'total_net', v_line_net, 'total_vat', v_line_vat, 'total_gross', v_line_gross
      ));
    else
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen tétel típus.');
    end if;

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
    v_line_kind := coalesce(v_row ->> 'item_kind', 'product');
    insert into public.sales_order_items (
      tenant_id, sales_order_id, item_kind,
      accessory_id, sheet_material_id, linear_material_id,
      name_snapshot, sku_snapshot, unit_shortform, quantity,
      unit_price_net, unit_price_gross, tax_rate_percent,
      discount_percentage, discount_amount,
      total_net, total_vat, total_gross, sort_order
    ) values (
      v_tenant_id, v_sale_id, v_line_kind,
      nullif(v_row ->> 'accessory_id', '')::uuid,
      nullif(v_row ->> 'sheet_material_id', '')::uuid,
      nullif(v_row ->> 'linear_material_id', '')::uuid,
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
      v_stock_qty := coalesce((v_row ->> 'stock_qty')::numeric, (v_row ->> 'quantity')::numeric);
      if v_line_kind = 'product' then
        v_sm_number := public.generate_stock_movement_number(v_tenant_id);
        insert into public.stock_movements (
          tenant_id, warehouse_id, product_type, accessory_id,
          quantity, movement_type, source_type, source_id,
          note, stock_movement_number, created_by
        ) values (
          v_tenant_id, p_warehouse_id, 'accessory', (v_row ->> 'accessory_id')::uuid,
          v_stock_qty, 'out', 'sale', v_sale_id,
          v_row ->> 'name', v_sm_number, v_user_id
        );
      elsif v_line_kind = 'sheet_material' then
        v_sm_number := public.generate_sheet_stock_movement_number(v_tenant_id);
        insert into public.sheet_stock_movements (
          tenant_id, warehouse_id, sheet_material_id,
          quantity, movement_type, source_type, source_id,
          note, stock_movement_number, created_by
        ) values (
          v_tenant_id, p_warehouse_id, (v_row ->> 'sheet_material_id')::uuid,
          v_stock_qty, 'out', 'sale', v_sale_id,
          v_row ->> 'name', v_sm_number, v_user_id
        );
      elsif v_line_kind = 'linear_material' then
        v_sm_number := public.generate_linear_stock_movement_number(v_tenant_id);
        insert into public.linear_stock_movements (
          tenant_id, warehouse_id, linear_material_id,
          quantity, movement_type, source_type, source_id,
          note, stock_movement_number, created_by
        ) values (
          v_tenant_id, p_warehouse_id, (v_row ->> 'linear_material_id')::uuid,
          v_stock_qty, 'out', 'sale', v_sale_id,
          v_row ->> 'name', v_sm_number, v_user_id
        );
      end if;
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
  'Eladás: termék + tábla (m2) + szálas (m); paid→fulfilled+stock; unpaid±fulfill_now.';


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
    select
      soi.id,
      soi.item_kind,
      soi.accessory_id,
      soi.sheet_material_id,
      soi.linear_material_id,
      soi.name_snapshot,
      soi.quantity,
      case
        when soi.item_kind = 'sheet_material' then
          round(
            soi.quantity / nullif((sm.length_mm::numeric * sm.width_mm::numeric) / 1000000.0, 0),
            6
          )
        when soi.item_kind = 'linear_material' and coalesce(lm.stock_unit, 'db') = 'fm' then
          soi.quantity
        when soi.item_kind = 'linear_material' then
          round(soi.quantity / nullif(lm.length_mm::numeric / 1000.0, 0), 6)
        else soi.quantity
      end as stock_qty
    from public.sales_order_items soi
    left join public.sheet_materials sm on sm.id = soi.sheet_material_id
    left join public.linear_materials lm on lm.id = soi.linear_material_id
    where soi.sales_order_id = v_sale.id
      and soi.deleted_at is null
      and soi.item_kind in ('product', 'sheet_material', 'linear_material')
    order by soi.sort_order, soi.created_at
  loop
    if v_item.item_kind = 'product' and v_item.accessory_id is not null then
      v_sm_number := public.generate_stock_movement_number(v_sale.tenant_id);
      insert into public.stock_movements (
        tenant_id, warehouse_id, product_type, accessory_id,
        quantity, movement_type, source_type, source_id,
        note, stock_movement_number, created_by
      ) values (
        v_sale.tenant_id, v_sale.warehouse_id, 'accessory', v_item.accessory_id,
        coalesce(v_item.stock_qty, v_item.quantity), 'out', 'sale', v_sale.id,
        v_item.name_snapshot, v_sm_number, v_user_id
      );
    elsif v_item.item_kind = 'sheet_material' and v_item.sheet_material_id is not null then
      v_sm_number := public.generate_sheet_stock_movement_number(v_sale.tenant_id);
      insert into public.sheet_stock_movements (
        tenant_id, warehouse_id, sheet_material_id,
        quantity, movement_type, source_type, source_id,
        note, stock_movement_number, created_by
      ) values (
        v_sale.tenant_id, v_sale.warehouse_id, v_item.sheet_material_id,
        coalesce(v_item.stock_qty, v_item.quantity), 'out', 'sale', v_sale.id,
        v_item.name_snapshot, v_sm_number, v_user_id
      );
    elsif v_item.item_kind = 'linear_material' and v_item.linear_material_id is not null then
      v_sm_number := public.generate_linear_stock_movement_number(v_sale.tenant_id);
      insert into public.linear_stock_movements (
        tenant_id, warehouse_id, linear_material_id,
        quantity, movement_type, source_type, source_id,
        note, stock_movement_number, created_by
      ) values (
        v_sale.tenant_id, v_sale.warehouse_id, v_item.linear_material_id,
        coalesce(v_item.stock_qty, v_item.quantity), 'out', 'sale', v_sale.id,
        v_item.name_snapshot, v_sm_number, v_user_id
      );
    end if;
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

-- ---------------------------------------------------------------------------
-- create_sales_quote: termék + tábla (m2) + szálas (m)
-- ---------------------------------------------------------------------------
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
  v_line_kind text;
  v_sheet public.sheet_materials%rowtype;
  v_linear public.linear_materials%rowtype;
  v_sku_snap text;
  v_unit_sf text;
  v_name_snap text;
  v_has_lapszab boolean;
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
    v_line_kind := coalesce(
      nullif(trim(v_row ->> 'line_kind'), ''),
      case
        when nullif(v_row ->> 'sheet_material_id', '') is not null then 'sheet_material'
        when nullif(v_row ->> 'linear_material_id', '') is not null then 'linear_material'
        else 'product'
      end
    );

    v_qty := (v_row ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen mennyiség.');
    end if;

    if v_line_kind in ('sheet_material', 'linear_material') then
      v_qty := round(v_qty::numeric, 1);
      if v_qty <= 0 then
        return jsonb_build_object('ok', false, 'message', 'Anyag mennyiség legyen legalább 0,1.');
      end if;
      select exists(
        select 1 from public.tenant_entitlements te
        where te.tenant_id = v_tenant_id and te.feature_key = 'lapszabaszat'
      ) into v_has_lapszab;
      if not coalesce(v_has_lapszab, false) then
        return jsonb_build_object('ok', false, 'message', 'Anyag ajánlathoz Lapszabászat add-on kell.');
      end if;
    end if;

    if v_line_kind = 'product' then
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
      v_tax := coalesce((v_row ->> 'tax_rate_percent')::numeric, v_acc.tax_pct);
      v_unit_gross := coalesce(
        (v_row ->> 'unit_price_gross')::numeric,
        round(v_acc.price_net * (1 + v_tax / 100))
      );
    elsif v_line_kind = 'sheet_material' then
      select * into v_sheet from public.sheet_materials
      where id = (v_row ->> 'sheet_material_id')::uuid and tenant_id = v_tenant_id and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen táblás anyag.');
      end if;
      select coalesce(t.rate_percent, 27)::numeric into v_tax from public.tax_rates t where t.id = v_sheet.tax_rate_id;
      v_tax := coalesce((v_row ->> 'tax_rate_percent')::numeric, v_tax);
      v_unit_gross := coalesce(
        (v_row ->> 'unit_price_gross')::numeric,
        round(coalesce(v_sheet.price_net, 0) * (1 + v_tax / 100))
      );
    elsif v_line_kind = 'linear_material' then
      select * into v_linear from public.linear_materials
      where id = (v_row ->> 'linear_material_id')::uuid and tenant_id = v_tenant_id and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen szálas anyag.');
      end if;
      select coalesce(t.rate_percent, 27)::numeric into v_tax from public.tax_rates t where t.id = v_linear.tax_rate_id;
      v_tax := coalesce((v_row ->> 'tax_rate_percent')::numeric, v_tax);
      v_unit_gross := coalesce(
        (v_row ->> 'unit_price_gross')::numeric,
        round(coalesce(v_linear.price_net, 0) * (1 + v_tax / 100))
      );
    else
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen tétel típus.');
    end if;

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
    v_line_kind := coalesce(
      nullif(trim(v_row ->> 'line_kind'), ''),
      case
        when nullif(v_row ->> 'sheet_material_id', '') is not null then 'sheet_material'
        when nullif(v_row ->> 'linear_material_id', '') is not null then 'linear_material'
        else 'product'
      end
    );
    v_qty := (v_row ->> 'quantity')::numeric;
    if v_line_kind in ('sheet_material', 'linear_material') then
      v_qty := round(v_qty::numeric, 1);
    end if;

    if v_line_kind = 'product' then
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
      v_tax := coalesce((v_row ->> 'tax_rate_percent')::numeric, v_acc.tax_pct);
      v_unit_gross := coalesce(
        (v_row ->> 'unit_price_gross')::numeric,
        round(v_acc.price_net * (1 + v_tax / 100))
      );
      v_name_snap := v_acc.name;
      v_sku_snap := v_acc.sku;
      v_unit_sf := v_acc.unit_sf;
    elsif v_line_kind = 'sheet_material' then
      select * into v_sheet from public.sheet_materials
      where id = (v_row ->> 'sheet_material_id')::uuid and tenant_id = v_tenant_id and deleted_at is null;
      select coalesce(t.rate_percent, 27)::numeric into v_tax from public.tax_rates t where t.id = v_sheet.tax_rate_id;
      v_tax := coalesce((v_row ->> 'tax_rate_percent')::numeric, v_tax);
      v_unit_gross := coalesce(
        (v_row ->> 'unit_price_gross')::numeric,
        round(coalesce(v_sheet.price_net, 0) * (1 + v_tax / 100))
      );
      v_name_snap := v_sheet.name;
      v_sku_snap := v_sheet.length_mm::text || '×' || v_sheet.width_mm::text || '×' || trim(to_char(v_sheet.thickness_mm, 'FM999990.99'));
      v_unit_sf := 'm2';
    else
      select * into v_linear from public.linear_materials
      where id = (v_row ->> 'linear_material_id')::uuid and tenant_id = v_tenant_id and deleted_at is null;
      select coalesce(t.rate_percent, 27)::numeric into v_tax from public.tax_rates t where t.id = v_linear.tax_rate_id;
      v_tax := coalesce((v_row ->> 'tax_rate_percent')::numeric, v_tax);
      v_unit_gross := coalesce(
        (v_row ->> 'unit_price_gross')::numeric,
        round(coalesce(v_linear.price_net, 0) * (1 + v_tax / 100))
      );
      v_name_snap := v_linear.name;
      v_sku_snap := v_linear.length_mm::text || '×' || v_linear.width_mm::text || '×' || trim(to_char(v_linear.thickness_mm, 'FM999990.99'));
      v_unit_sf := 'm';
    end if;

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
      tenant_id, sales_quote_id, item_kind,
      accessory_id, sheet_material_id, linear_material_id,
      name_snapshot, sku_snapshot, unit_shortform, quantity,
      unit_price_net, unit_price_gross, tax_rate_percent,
      discount_percentage, discount_amount,
      total_net, total_vat, total_gross, sort_order
    ) values (
      v_tenant_id, v_quote_id, v_line_kind,
      case when v_line_kind = 'product' then v_acc.id else null end,
      case when v_line_kind = 'sheet_material' then v_sheet.id else null end,
      case when v_line_kind = 'linear_material' then v_linear.id else null end,
      v_name_snap, v_sku_snap, v_unit_sf, v_qty,
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

revoke all on function public.create_sales_quote(uuid, uuid, text, date, jsonb, jsonb, jsonb, jsonb, uuid) from public;
grant execute on function public.create_sales_quote(uuid, uuid, text, date, jsonb, jsonb, jsonb, jsonb, uuid) to authenticated;

comment on function public.create_sales_quote(uuid, uuid, text, date, jsonb, jsonb, jsonb, jsonb, uuid) is
  'Termék árajánlat: termék + tábla (m2) + szálas (m); lapszab gate anyaghoz.';
