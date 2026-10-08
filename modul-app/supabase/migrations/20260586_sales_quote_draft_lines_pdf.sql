-- Termék árajánlat P0/P1: draft tételcsere + lejárat auto-flag
-- replace_sales_quote_draft_lines: csak draft, items+fees+discount
-- expire_sales_quotes_past_due: valid_until < today → expired (draft/sent)

-- ---------------------------------------------------------------------------
-- expire_sales_quotes_past_due
-- ---------------------------------------------------------------------------
create or replace function public.expire_sales_quotes_past_due(p_tenant_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant uuid;
  v_n int := 0;
begin
  if v_user_id is null then
    return 0;
  end if;

  if p_tenant_id is not null then
    if not public.can_write_tenant(p_tenant_id) then
      return 0;
    end if;
    v_tenant := p_tenant_id;
  else
    select m.tenant_id into v_tenant
    from public.tenant_memberships m
    where m.user_id = v_user_id
      and m.role in ('owner', 'admin', 'member')
    limit 1;
    if v_tenant is null then
      return 0;
    end if;
  end if;

  update public.sales_quotes
  set status = 'expired', updated_at = now()
  where tenant_id = v_tenant
    and deleted_at is null
    and status in ('draft', 'sent')
    and converted_sale_id is null
    and valid_until is not null
    and valid_until < current_date;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.expire_sales_quotes_past_due(uuid) from public;
grant execute on function public.expire_sales_quotes_past_due(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- replace_sales_quote_draft_lines
-- ---------------------------------------------------------------------------
create or replace function public.replace_sales_quote_draft_lines(
  p_quote_id uuid,
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
  v_q public.sales_quotes%rowtype;
  v_tenant_id uuid;
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
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 then
    return jsonb_build_object('ok', false, 'message', 'Adj hozzá legalább egy terméket.');
  end if;
  if v_disc_pct < 0 or v_disc_pct > 100 then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen kedvezmény.');
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
      'message', 'Csak piszkozat tételei szerkeszthetők. Kiküldöttnél használj Másolatot.'
    );
  end if;
  if v_q.converted_sale_id is not null then
    return jsonb_build_object('ok', false, 'message', 'Konvertált ajánlat nem szerkeszthető.');
  end if;

  v_tenant_id := v_q.tenant_id;

  -- Pass 1: validate + sum
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

  -- Soft-delete old lines, then insert
  update public.sales_quote_items
  set deleted_at = now()
  where sales_quote_id = p_quote_id
    and deleted_at is null;

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
      v_tenant_id, p_quote_id, v_line_kind,
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
        v_tenant_id, p_quote_id, 'fee',
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
  set
    discount_percentage = v_disc_pct,
    discount_amount = v_global_disc,
    subtotal_net = v_total_net,
    total_vat = v_total_vat,
    total_gross = v_total_gross,
    updated_at = now()
  where id = p_quote_id;

  return jsonb_build_object(
    'ok', true,
    'id', p_quote_id,
    'total_gross', v_total_gross
  );
end;
$$;

revoke all on function public.replace_sales_quote_draft_lines(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.replace_sales_quote_draft_lines(uuid, jsonb, jsonb, jsonb) to authenticated;

comment on function public.replace_sales_quote_draft_lines(uuid, jsonb, jsonb, jsonb) is
  'Draft árajánlat tételek cseréje (product/sheet/linear + díjak + kedvezmény).';
