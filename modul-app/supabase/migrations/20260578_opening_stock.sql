-- Nyitó készlet (PDA): commit_opening_stock → adjustment IN mozgások
-- p_items: [{ "kind":"product"|"sheet_material"|"linear_material", "id":"uuid", "quantity":12 }, ...]

create or replace function public.commit_opening_stock(
  p_warehouse_id uuid,
  p_items jsonb
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
  v_item jsonb;
  v_kind text;
  v_id uuid;
  v_qty numeric(14, 3);
  v_name text;
  v_sm_number text;
  v_prepared jsonb := '[]'::jsonb;
  v_row jsonb;
  v_seen text[] := '{}';
  v_key text;
  v_line_count integer := 0;
  v_acc public.accessories%rowtype;
  v_sheet public.sheet_materials%rowtype;
  v_linear public.linear_materials%rowtype;
begin
  if p_warehouse_id is null then
    return jsonb_build_object('ok', false, 'message', 'Válaszd ki a raktárat.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Adj hozzá legalább egy tételt.');
  end if;

  select * into v_wh
  from public.warehouses
  where id = p_warehouse_id
    and deleted_at is null
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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_kind := coalesce(nullif(trim(v_item ->> 'kind'), ''), 'product');
    if v_kind not in ('product', 'sheet_material', 'linear_material') then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen tétel típus.');
    end if;

    begin
      v_id := (v_item ->> 'id')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen tétel azonosító.');
    end;

    begin
      v_qty := (v_item ->> 'quantity')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen mennyiség.');
    end;

    if v_id is null or v_qty is null or v_qty <= 0 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Minden tételnél legyen azonosító és pozitív mennyiség.'
      );
    end if;

    v_key := v_kind || ':' || v_id::text;
    if v_key = any (v_seen) then
      return jsonb_build_object(
        'ok', false,
        'message', 'Ugyanaz a tétel többször szerepel — egyesítsd a mennyiségeket.'
      );
    end if;
    v_seen := array_append(v_seen, v_key);

    if v_kind = 'product' then
      select * into v_acc
      from public.accessories
      where id = v_id
        and tenant_id = v_tenant_id
        and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen termék a listában.');
      end if;
      v_name := v_acc.name;
    elsif v_kind = 'sheet_material' then
      select * into v_sheet
      from public.sheet_materials
      where id = v_id
        and tenant_id = v_tenant_id
        and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen táblás anyag a listában.');
      end if;
      v_name := v_sheet.name;
    else
      select * into v_linear
      from public.linear_materials
      where id = v_id
        and tenant_id = v_tenant_id
        and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen szálas anyag a listában.');
      end if;
      v_name := v_linear.name;
    end if;

    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'kind', v_kind,
      'id', v_id,
      'quantity', v_qty,
      'name', v_name
    ));
  end loop;

  if jsonb_array_length(v_prepared) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Adj hozzá legalább egy tételt.');
  end if;

  for v_row in select * from jsonb_array_elements(v_prepared)
  loop
    v_kind := v_row ->> 'kind';
    v_id := (v_row ->> 'id')::uuid;
    v_qty := (v_row ->> 'quantity')::numeric;
    v_name := v_row ->> 'name';

    if v_kind = 'product' then
      v_sm_number := public.generate_stock_movement_number(v_tenant_id);
      insert into public.stock_movements (
        tenant_id, warehouse_id, product_type, accessory_id,
        quantity, movement_type, source_type, source_id,
        note, stock_movement_number, created_by
      ) values (
        v_tenant_id, p_warehouse_id, 'accessory', v_id,
        v_qty, 'in', 'adjustment', null,
        'Nyitó készlet · ' || v_name, v_sm_number, v_user_id
      );
    elsif v_kind = 'sheet_material' then
      v_sm_number := public.generate_sheet_stock_movement_number(v_tenant_id);
      insert into public.sheet_stock_movements (
        tenant_id, warehouse_id, sheet_material_id,
        quantity, movement_type, source_type, source_id,
        note, stock_movement_number, created_by
      ) values (
        v_tenant_id, p_warehouse_id, v_id,
        v_qty, 'in', 'adjustment', null,
        'Nyitó készlet · ' || v_name, v_sm_number, v_user_id
      );
    else
      v_sm_number := public.generate_linear_stock_movement_number(v_tenant_id);
      insert into public.linear_stock_movements (
        tenant_id, warehouse_id, linear_material_id,
        quantity, movement_type, source_type, source_id,
        note, stock_movement_number, created_by
      ) values (
        v_tenant_id, p_warehouse_id, v_id,
        v_qty, 'in', 'adjustment', null,
        'Nyitó készlet · ' || v_name, v_sm_number, v_user_id
      );
    end if;

    v_line_count := v_line_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'message', 'Nyitó készlet rögzítve.',
    'line_count', v_line_count
  );
end;
$$;

revoke all on function public.commit_opening_stock(uuid, jsonb) from public;
grant execute on function public.commit_opening_stock(uuid, jsonb) to authenticated;

comment on function public.commit_opening_stock(uuid, jsonb) is
  'Nyitó készlet: termék/tábla/szálas adjustment IN. Soft stock (nem tilt meglévő qty-nél).';

-- ---------------------------------------------------------------------------
-- Page feature + Alap + backfill
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/keszlet/nyito',
  'Nyitó készlet',
  'Beszerzés',
  '/keszlet/nyito',
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
select p.id, '/keszlet/nyito'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/keszlet/nyito'
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
  '/keszlet/nyito',
  true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
