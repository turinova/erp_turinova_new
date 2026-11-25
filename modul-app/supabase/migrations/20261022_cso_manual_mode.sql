-- CSO kézi mód + átadás / előleg / create_sale fee-only javítások
-- 1) tenant_customer_order_settings (kezi | beszerzes)
-- 2) ordered_at / ordered_by / order_note a tételeken
-- 3) deposit_applied_amount a fejen (részleges átadás)
-- 4) create_sale: díj-only eladás + díj unit_shortform + cso_item_id link
-- 5) bevételezés sync: kézi megrendelt (ordered_at, nincs PO) kihagyása
-- 6) rendelésszám generátor: soft-deleted is beleszámít
-- 7) cso_hand_over RPC (egy tranzakció)
-- 8) revert_cso_items_for_sale (eladás lemondás / teljes visszáru)

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_customer_order_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  mode text not null default 'kezi'
    check (mode in ('kezi', 'beszerzes')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_customer_order_settings is
  'Ügyfélrendelés mód: kezi (telefon/e-mail, PO nélkül) vagy beszerzes (PO + bevételezés).';
comment on column public.tenant_customer_order_settings.mode is
  'kezi = Megrendeltem → Megérkezett → Átadás (díjsor); beszerzes = listára / PO / bevételezés.';

alter table public.tenant_customer_order_settings enable row level security;

drop policy if exists tenant_customer_order_settings_select_member
  on public.tenant_customer_order_settings;
create policy tenant_customer_order_settings_select_member
  on public.tenant_customer_order_settings
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_customer_order_settings_insert_writer
  on public.tenant_customer_order_settings;
create policy tenant_customer_order_settings_insert_writer
  on public.tenant_customer_order_settings
  for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_customer_order_settings_update_writer
  on public.tenant_customer_order_settings;
create policy tenant_customer_order_settings_update_writer
  on public.tenant_customer_order_settings
  for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- Seed: meglévő tenantek (ügyfélrendelés entitlement) → kezi
insert into public.tenant_customer_order_settings (tenant_id, mode)
select distinct e.tenant_id, 'kezi'
from public.tenant_entitlements e
where e.feature_key in ('customer_special_orders', '/ugyfelrendelesek')
on conflict (tenant_id) do nothing;

insert into public.tenant_customer_order_settings (tenant_id, mode)
select t.id, 'kezi'
from public.tenants t
on conflict (tenant_id) do nothing;

-- ---------------------------------------------------------------------------
-- Item + header columns
-- ---------------------------------------------------------------------------
alter table public.customer_special_order_items
  add column if not exists ordered_at timestamptz,
  add column if not exists ordered_by uuid references auth.users (id) on delete set null,
  add column if not exists order_note text;

comment on column public.customer_special_order_items.ordered_at is
  'Kézi „Megrendeltem” időpont (PO nélkül).';
comment on column public.customer_special_order_items.order_note is
  'Opcionális megjegyzés a kézi megrendeléshez (pl. beszállító, dátum).';

alter table public.customer_special_orders
  add column if not exists deposit_applied_amount numeric(12, 2) not null default 0;

comment on column public.customer_special_orders.deposit_applied_amount is
  'Eddig átadásoknál beszámított előleg (Ft). Maradék = deposit_amount − ez.';

-- ---------------------------------------------------------------------------
-- Order number: include soft-deleted (unique constraint covers them)
-- ---------------------------------------------------------------------------
create or replace function public.generate_customer_special_order_number(p_tenant_id uuid)
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

  if not public.can_write_tenant(p_tenant_id) then
    raise exception 'not allowed';
  end if;

  current_year := extract(year from now())::integer;

  select coalesce(max(
    cast(
      substring(order_number from length('UR-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.customer_special_orders
  where tenant_id = p_tenant_id
    and order_number like 'UR-' || current_year::text || '-%';
    -- deleted_at is null szándékosan NINCS — a unique (tenant_id, order_number) a soft-delete-re is érvényes

  return 'UR-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_customer_special_order_number(uuid) from public;
grant execute on function public.generate_customer_special_order_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Bevételezés sync: kézi megrendelt (ordered_at + nincs PO link) ne kapjon auto itt_van-t
-- ---------------------------------------------------------------------------

-- CSO bevételezés sync: ha a lead nem írta a purchase_order_item_id-t,
-- accessory alapján is kössük össze a rendelve tételeket a PO-sorral,
-- majd jelöljük itt_van-ra (részleges fedezet: korábbi tételek elsőbbsége).

drop function if exists public.mark_special_order_items_arrived_for_receipt(uuid);

create function public.mark_special_order_items_arrived_for_receipt(
  p_receipt_id uuid
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_warehouse_id uuid;
  v_po_item record;
  v_item record;
  v_received numeric;
  v_remaining numeric;
  v_orders uuid[] := '{}';
begin
  select gr.tenant_id, gr.warehouse_id
  into v_tenant_id, v_warehouse_id
  from public.goods_receipts gr
  where gr.id = p_receipt_id;

  if v_tenant_id is null then
    return;
  end if;

  if not public.can_write_tenant(v_tenant_id) then
    raise exception 'not allowed';
  end if;

  -- Backfill: rendelve + null link + ugyanaz az accessory, mint a beérkezett PO-sor
  update public.customer_special_order_items csoi
  set
    purchase_order_item_id = poi.id,
    updated_at = now()
  from public.goods_receipt_items gri
  join public.purchase_order_items poi
    on poi.id = gri.purchase_order_item_id
   and poi.deleted_at is null
  where gri.goods_receipt_id = p_receipt_id
    and gri.deleted_at is null
    and gri.quantity_received > 0
    and gri.purchase_order_item_id is not null
    and csoi.tenant_id = v_tenant_id
    and csoi.deleted_at is null
    and csoi.status = 'rendelve'
    and csoi.purchase_order_item_id is null
    and csoi.ordered_at is null  -- kézi Megrendeltem: ne auto-kösd PO-hoz
    and csoi.accessory_id = poi.accessory_id
    -- ne kössünk olyan tételt, amit már más élő PO-sorhoz kapcsoltak
    and not exists (
      select 1
      from public.customer_special_order_items other
      where other.id = csoi.id
        and other.purchase_order_item_id is not null
    );

  for v_po_item in
    select distinct
      gri.purchase_order_item_id as id,
      poi.accessory_id
    from public.goods_receipt_items gri
    join public.purchase_order_items poi
      on poi.id = gri.purchase_order_item_id
     and poi.deleted_at is null
    where gri.goods_receipt_id = p_receipt_id
      and gri.deleted_at is null
      and gri.quantity_received > 0
      and gri.purchase_order_item_id is not null
  loop
    select coalesce(sum(gri.quantity_received), 0)
    into v_received
    from public.goods_receipt_items gri
    join public.goods_receipts gr on gr.id = gri.goods_receipt_id
    where gri.purchase_order_item_id = v_po_item.id
      and gri.deleted_at is null
      and gr.deleted_at is null
      and gr.status = 'received';

    v_remaining := v_received;

    for v_item in
      select csoi.id, csoi.order_id, csoi.qty, csoi.status
      from public.customer_special_order_items csoi
      where csoi.tenant_id = v_tenant_id
        and csoi.deleted_at is null
        and csoi.status in ('rendelve', 'itt_van', 'atadva')
        and (
          csoi.purchase_order_item_id = v_po_item.id
          or (
            csoi.purchase_order_item_id is null
            and csoi.ordered_at is null  -- kézi Megrendeltem kihagyva
            and csoi.accessory_id = v_po_item.accessory_id
            and csoi.status = 'rendelve'
          )
        )
      order by csoi.created_at, csoi.sort_order
    loop
      exit when v_remaining < v_item.qty;
      v_remaining := v_remaining - v_item.qty;

      if v_item.status = 'rendelve' then
        update public.customer_special_order_items
        set
          status = 'itt_van',
          purchase_order_item_id = coalesce(purchase_order_item_id, v_po_item.id),
          reserved_qty = v_item.qty,
          reserved_at = now(),
          warehouse_id = coalesce(warehouse_id, v_warehouse_id),
          updated_at = now()
        where id = v_item.id
          and status = 'rendelve';

        if not (v_item.order_id = any (v_orders)) then
          v_orders := array_append(v_orders, v_item.order_id);
        end if;
      end if;
    end loop;
  end loop;

  return query select unnest(v_orders);
end;
$$;

revoke all on function public.mark_special_order_items_arrived_for_receipt(uuid) from public;
grant execute on function public.mark_special_order_items_arrived_for_receipt(uuid) to authenticated;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- create_sale: fee-only + unit_shortform + cso_item_id
-- ---------------------------------------------------------------------------
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

  -- Termék VAGY díj — ügyfélrendelés kézi mód: csak díjsor is OK.
  if (p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0)
     and (p_fees is null or jsonb_typeof(p_fees) <> 'array' or jsonb_array_length(p_fees) = 0) then
    return jsonb_build_object('ok', false, 'message', 'Adj hozzá legalább egy terméket vagy díjat.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    p_items := '[]'::jsonb;
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
      -- Bruttó első (POS UI: round(qty * unit_gross)), ÁFA belőle — nettó-path eltérés elkerülése
      v_line_gross_before := round(v_qty * v_unit_gross);
      v_item_disc_pct := coalesce((v_item ->> 'discount_percentage')::numeric, 0);
      v_item_disc_amt := coalesce((v_item ->> 'discount_amount')::numeric, 0);
      if v_item_disc_amt = 0 and v_item_disc_pct > 0 then
        v_item_disc_amt := round(v_line_gross_before * v_item_disc_pct / 100);
      else
        v_item_disc_amt := round(v_item_disc_amt);
      end if;
      if v_item_disc_amt > v_line_gross_before then v_item_disc_amt := v_line_gross_before; end if;
      v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
      if v_line_gross > 0 and v_tax_pct > 0 then
        v_line_net := round(v_line_gross / (1 + v_tax_pct / 100));
        v_line_vat := v_line_gross - v_line_net;
      else
        v_line_net := v_line_gross;
        v_line_vat := 0;
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
      -- Bruttó első (POS UI: round(qty * unit_gross)), ÁFA belőle
      v_line_gross_before := round(v_qty * v_unit_gross);
      v_item_disc_pct := coalesce((v_item ->> 'discount_percentage')::numeric, 0);
      v_item_disc_amt := coalesce((v_item ->> 'discount_amount')::numeric, 0);
      if v_item_disc_amt = 0 and v_item_disc_pct > 0 then
        v_item_disc_amt := round(v_line_gross_before * v_item_disc_pct / 100);
      else v_item_disc_amt := round(v_item_disc_amt); end if;
      if v_item_disc_amt > v_line_gross_before then v_item_disc_amt := v_line_gross_before; end if;
      v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
      if v_line_gross > 0 and v_tax_pct > 0 then
        v_line_net := round(v_line_gross / (1 + v_tax_pct / 100));
        v_line_vat := v_line_gross - v_line_net;
      else
        v_line_net := v_line_gross;
        v_line_vat := 0;
      end if;
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
      -- Bruttó első (POS UI: round(qty * unit_gross)), ÁFA belőle
      v_line_gross_before := round(v_qty * v_unit_gross);
      v_item_disc_pct := coalesce((v_item ->> 'discount_percentage')::numeric, 0);
      v_item_disc_amt := coalesce((v_item ->> 'discount_amount')::numeric, 0);
      if v_item_disc_amt = 0 and v_item_disc_pct > 0 then
        v_item_disc_amt := round(v_line_gross_before * v_item_disc_pct / 100);
      else v_item_disc_amt := round(v_item_disc_amt); end if;
      if v_item_disc_amt > v_line_gross_before then v_item_disc_amt := v_line_gross_before; end if;
      v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
      if v_line_gross > 0 and v_tax_pct > 0 then
        v_line_net := round(v_line_gross / (1 + v_tax_pct / 100));
        v_line_vat := v_line_gross - v_line_net;
      else
        v_line_net := v_line_gross;
        v_line_vat := 0;
      end if;
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
      -- Díj: bruttó első (POS UI round(unit_price_gross))
      v_line_gross := round(v_qty * v_unit_gross);
      if v_line_gross > 0 and v_tax_pct > 0 then
        v_line_net := round(v_line_gross / (1 + v_tax_pct / 100));
        v_line_vat := v_line_gross - v_line_net;
      else
        v_line_net := v_line_gross;
        v_line_vat := 0;
      end if;

      v_prepared_fees := v_prepared_fees || jsonb_build_array(jsonb_build_object(
        'fee_type_id', nullif(v_fee ->> 'fee_type_id', '')::uuid,
        'name', v_fee_name,
        'quantity', v_qty,
        'unit_shortform', coalesce(nullif(trim(v_fee ->> 'unit_shortform'), ''), 'db'),
        'unit_price_net', v_unit_net,
        'unit_price_gross', v_unit_gross,
        'tax_rate_percent', v_tax_pct,
        'total_net', v_line_net,
        'total_vat', v_line_vat,
        'total_gross', v_line_gross,
        'cso_item_id', nullif(v_fee ->> 'cso_item_id', '')::uuid
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
        or lower(v_pm_name) like '%cash%'
        or lower(trim(v_pm_name)) in ('kp', 'k.p.', 'k.p') then
        v_has_cash := true;
      end if;
    end if;
    v_pay_sum := v_pay_sum + v_pay_amt;
  end loop;

  v_due := v_total_gross;
  -- Egy KP sor → magyar kerekítés. POS: ha a fizetett = KP-kerekített due, akkor is
  -- (módbeli név-eltérés ne dobja vendég „részfizetés” hibára).
  if jsonb_array_length(p_payments) = 1 then
    if v_has_cash
       or (
         coalesce(p_channel, '') = 'pos'
         and v_pay_sum = public.hungarian_cash_round(v_total_gross)
       )
    then
      v_due := public.hungarian_cash_round(v_total_gross);
      v_cash_round := v_due - v_total_gross;
      v_has_cash := true;
    end if;
  end if;

  -- Üres payments: unpaid. Részfizetés (0 < pay_sum < due): partial. Túlfizetés tiltva.
  if jsonb_array_length(p_payments) > 0 and v_pay_sum > v_due + 1 then
    return jsonb_build_object(
      'ok', false,
      'message',
        'A fizetések összege meghaladja a végösszeget (fizetendő: '
        || v_due::text || ' Ft, megadva: ' || v_pay_sum::text || ' Ft).'
    );
  end if;

  -- Vendég: csak teljes fizetés (hitel / részfizetés csak névre).
  if p_customer_id is null
     and (
       jsonb_array_length(p_payments) = 0
       or v_pay_sum < v_due - 1
     )
  then
    return jsonb_build_object(
      'ok', false,
      'message',
        'Vendégnél csak teljes fizetés engedélyezett. Részfizetéshez vagy hitelhez válassz vevőt.'
        || ' (fizetendő: ' || v_due::text || ' Ft, megadva: ' || v_pay_sum::text || ' Ft)'
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
      total_net, total_vat, total_gross, sort_order,
      customer_special_order_item_id
    ) values (
      v_tenant_id, v_sale_id, 'fee',
      nullif(v_row ->> 'fee_type_id', '')::uuid,
      v_row ->> 'name', null,
      coalesce(nullif(v_row ->> 'unit_shortform', ''), 'db'),
      (v_row ->> 'quantity')::numeric,
      (v_row ->> 'unit_price_net')::numeric,
      (v_row ->> 'unit_price_gross')::numeric,
      (v_row ->> 'tax_rate_percent')::numeric,
      0, 0,
      (v_row ->> 'total_net')::numeric,
      (v_row ->> 'total_vat')::numeric,
      (v_row ->> 'total_gross')::numeric,
      v_sort,
      nullif(v_row ->> 'cso_item_id', '')::uuid
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

    perform set_config('app.payment_event_source', 'create_sale', true);
    perform set_config('app.payment_late_settlement', '0', true);

    insert into public.sales_payments (
      tenant_id, sales_order_id, payment_method_id,
      payment_method_name, amount, status, created_by, provider_ref, created_by_label
    ) values (
      v_tenant_id, v_sale_id, v_pm_id,
      v_pm_name, v_pay_amt, 'completed', v_user_id,
      nullif(trim(v_pay ->> 'provider_ref'), ''),
      public.pos_user_label(v_user_id)
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
  'Eladás: bruttó-első; díj-only OK; díj unit_shortform + cso_item_id; vendég teljes fizetés; payment napló.';


-- ---------------------------------------------------------------------------
-- Revert CSO items when linked sale is cancelled / fully returned
-- ---------------------------------------------------------------------------
create or replace function public.revert_cso_items_for_sale(p_sale_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_count integer := 0;
  v_order_id uuid;
  v_deposit_used numeric(12, 2) := 0;
begin
  select so.tenant_id, coalesce(so.discount_amount, 0)
  into v_tenant_id, v_deposit_used
  from public.sales_orders so
  where so.id = p_sale_id;

  if v_tenant_id is null then
    return 0;
  end if;

  if not public.can_write_tenant(v_tenant_id) then
    raise exception 'not allowed';
  end if;

  update public.customer_special_order_items csoi
  set
    status = 'itt_van',
    reserved_qty = coalesce(csoi.qty, 1),
    reserved_at = coalesce(csoi.reserved_at, now()),
    updated_at = now()
  from public.sales_order_items soi
  where soi.sales_order_id = p_sale_id
    and soi.tenant_id = v_tenant_id
    and soi.deleted_at is null
    and soi.customer_special_order_item_id is not null
    and csoi.id = soi.customer_special_order_item_id
    and csoi.tenant_id = v_tenant_id
    and csoi.deleted_at is null
    and csoi.status = 'atadva';

  get diagnostics v_count = row_count;

  for v_order_id in
    select distinct csl.customer_special_order_id
    from public.cso_sale_links csl
    where csl.sales_order_id = p_sale_id
      and csl.tenant_id = v_tenant_id
  loop
    if v_deposit_used > 0 then
      update public.customer_special_orders
      set
        deposit_applied_amount = greatest(0, deposit_applied_amount - v_deposit_used),
        updated_at = now()
      where id = v_order_id
        and tenant_id = v_tenant_id;
    end if;

    update public.customer_special_orders cso
    set
      sales_order_id = (
        select csl.sales_order_id
        from public.cso_sale_links csl
        join public.sales_orders so on so.id = csl.sales_order_id
        where csl.customer_special_order_id = cso.id
          and csl.sales_order_id <> p_sale_id
          and csl.tenant_id = v_tenant_id
          and so.status not in ('cancelled', 'returned')
        order by csl.created_at desc nulls last
        limit 1
      ),
      updated_at = now()
    where cso.id = v_order_id
      and cso.tenant_id = v_tenant_id
      and cso.sales_order_id = p_sale_id;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.revert_cso_items_for_sale(uuid) from public;
grant execute on function public.revert_cso_items_for_sale(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cso_hand_over — egy tranzakció: claim + create_sale + linkek + előleg
-- ---------------------------------------------------------------------------
create or replace function public.cso_hand_over(
  p_item_ids uuid[],
  p_payment_method_id uuid,
  p_force_fees boolean default false,
  p_price_overrides jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_pm_name text;
  v_deferred boolean := false;
  v_is_cash boolean := false;
  v_default_wh uuid;
  v_order_id uuid;
  v_order_ids uuid[];
  v_customer_id uuid;
  v_customer_name text;
  v_customer_mobile text;
  v_order_number text;
  v_deposit_total numeric(12, 2);
  v_deposit_applied numeric(12, 2);
  v_deposit_left numeric(12, 2);
  v_deposit_use numeric(12, 2);
  v_items_gross numeric(12, 2);
  v_raw_due numeric(12, 2);
  v_due numeric(12, 2);
  v_wh_id uuid;
  v_sale_items jsonb;
  v_sale_fees jsonb;
  v_payments jsonb;
  v_fulfill boolean;
  v_note text;
  v_sale jsonb;
  v_sale_id uuid;
  v_sale_number text;
  v_claimed_ids uuid[];
  v_claimed_count integer;
  v_expected_count integer;
  v_qty numeric;
  v_price numeric;
  v_item record;
  v_existing_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_first_sale_id uuid;
  v_first_sale_number text;
  v_item_count integer := 0;
begin
  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Válassz legalább egy tételt.');
  end if;
  if p_payment_method_id is null then
    return jsonb_build_object('ok', false, 'message', 'Válassz fizetési módot.');
  end if;

  select csoi.tenant_id into v_tenant_id
  from public.customer_special_order_items csoi
  where csoi.id = any (p_item_ids)
    and csoi.deleted_at is null
  limit 1;

  if v_tenant_id is null then
    return jsonb_build_object('ok', false, 'message', 'A tételek nem találhatók.');
  end if;
  if not public.can_write_tenant(v_tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  select pm.name into v_pm_name
  from public.payment_methods pm
  where pm.id = p_payment_method_id
    and pm.tenant_id = v_tenant_id
    and pm.active = true
    and pm.deleted_at is null;
  if v_pm_name is null then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen fizetési mód.');
  end if;

  v_deferred := (
    lower(v_pm_name) like '%utalás%' or lower(v_pm_name) like '%utalas%'
    or lower(v_pm_name) like '%átutalás%' or lower(v_pm_name) like '%atutalas%'
    or lower(v_pm_name) like '%átutalas%'
    or lower(v_pm_name) like '%transfer%' or lower(v_pm_name) like '%wire%'
    or lower(v_pm_name) like '%banki%' or lower(trim(v_pm_name)) = 'bank'
  );
  v_is_cash := (
    lower(v_pm_name) like '%készpénz%' or lower(v_pm_name) like '%keszpenz%'
    or lower(v_pm_name) like '%cash%'
    or lower(trim(v_pm_name)) in ('kp', 'k.p.', 'k.p')
  );

  if p_price_overrides is not null and jsonb_typeof(p_price_overrides) = 'array' then
    update public.customer_special_order_items csoi
    set
      unit_price_gross = round(ov.price),
      updated_at = now()
    from (
      select
        nullif(x ->> 'item_id', '')::uuid as item_id,
        (x ->> 'unit_price_gross')::numeric as price
      from jsonb_array_elements(p_price_overrides) x
    ) ov
    where csoi.id = ov.item_id
      and csoi.tenant_id = v_tenant_id
      and csoi.id = any (p_item_ids)
      and ov.item_id is not null
      and ov.price is not null
      and ov.price >= 0;
  end if;

  select w.id into v_default_wh
  from public.warehouses w
  where w.tenant_id = v_tenant_id
    and w.deleted_at is null
    and coalesce(w.is_active, true) = true
  order by coalesce(w.is_default, false) desc, w.created_at
  limit 1;
  if v_default_wh is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs aktív raktár.');
  end if;

  select array_agg(distinct csoi.order_id)
  into v_order_ids
  from public.customer_special_order_items csoi
  where csoi.id = any (p_item_ids)
    and csoi.tenant_id = v_tenant_id
    and csoi.deleted_at is null;

  foreach v_order_id in array v_order_ids
  loop
    select
      cso.customer_id, cso.customer_name, cso.customer_mobile, cso.order_number,
      coalesce(cso.deposit_amount, 0), coalesce(cso.deposit_applied_amount, 0)
    into
      v_customer_id, v_customer_name, v_customer_mobile, v_order_number,
      v_deposit_total, v_deposit_applied
    from public.customer_special_orders cso
    where cso.id = v_order_id
      and cso.tenant_id = v_tenant_id
      and cso.deleted_at is null;

    if not found then
      return jsonb_build_object('ok', false, 'message', 'A rendelés nem található.');
    end if;

    v_deposit_left := greatest(0, v_deposit_total - v_deposit_applied);
    v_wh_id := null;
    v_items_gross := 0;
    v_sale_items := '[]'::jsonb;
    v_sale_fees := '[]'::jsonb;
    v_expected_count := 0;

    for v_item in
      select
        csoi.id, csoi.name, csoi.qty, csoi.unit_shortform, csoi.unit_price_gross,
        csoi.accessory_id, csoi.material_id, csoi.linear_material_id,
        csoi.warehouse_id, csoi.reserved_qty, csoi.status
      from public.customer_special_order_items csoi
      where csoi.order_id = v_order_id
        and csoi.id = any (p_item_ids)
        and csoi.tenant_id = v_tenant_id
        and csoi.deleted_at is null
      order by csoi.sort_order, csoi.created_at
    loop
      v_expected_count := v_expected_count + 1;
      if v_item.status <> 'itt_van' then
        return jsonb_build_object('ok', false, 'message', 'Csak „Átvehető” tételt lehet átadni.');
      end if;
      if v_item.unit_price_gross is null then
        return jsonb_build_object(
          'ok', false,
          'message', 'Minden átadandó tételnek legyen ára — szerkeszd a hiányzó árakat.'
        );
      end if;
      if v_item.warehouse_id is not null then
        if v_wh_id is not null and v_wh_id <> v_item.warehouse_id then
          return jsonb_build_object(
            'ok', false,
            'message', 'Egy átadáson belül csak egy raktár tételei lehetnek.'
          );
        end if;
        v_wh_id := v_item.warehouse_id;
      end if;

      v_qty := abs(coalesce(v_item.reserved_qty, v_item.qty));
      v_price := round(v_item.unit_price_gross);
      v_items_gross := v_items_gross + round(v_qty * v_price);

      if p_force_fees
         or (v_item.accessory_id is null
             and v_item.material_id is null
             and v_item.linear_material_id is null)
      then
        v_sale_fees := v_sale_fees || jsonb_build_array(jsonb_build_object(
          'name', v_item.name,
          'quantity', v_qty,
          'unit_shortform', coalesce(nullif(v_item.unit_shortform, ''), 'db'),
          'unit_price_gross', v_price,
          'tax_rate_percent', 27,
          'cso_item_id', v_item.id
        ));
      elsif v_item.accessory_id is not null then
        v_sale_items := v_sale_items || jsonb_build_array(jsonb_build_object(
          'line_kind', 'product',
          'accessory_id', v_item.accessory_id,
          'quantity', v_qty,
          'unit_price_gross', v_price,
          'discount_percentage', 0,
          'discount_amount', 0
        ));
      elsif v_item.material_id is not null then
        v_sale_items := v_sale_items || jsonb_build_array(jsonb_build_object(
          'line_kind', 'sheet_material',
          'sheet_material_id', v_item.material_id,
          'quantity', v_qty,
          'unit_price_gross', v_price,
          'discount_percentage', 0,
          'discount_amount', 0
        ));
      else
        v_sale_items := v_sale_items || jsonb_build_array(jsonb_build_object(
          'line_kind', 'linear_material',
          'linear_material_id', v_item.linear_material_id,
          'quantity', v_qty,
          'unit_price_gross', v_price,
          'discount_percentage', 0,
          'discount_amount', 0
        ));
      end if;
    end loop;

    if v_expected_count = 0 then
      continue;
    end if;

    v_wh_id := coalesce(v_wh_id, v_default_wh);
    v_deposit_use := least(v_deposit_left, v_items_gross);
    v_raw_due := greatest(0, v_items_gross - v_deposit_use);
    v_due := case
      when (not v_deferred) and v_is_cash and v_raw_due > 0
        then public.hungarian_cash_round(v_raw_due)
      else v_raw_due
    end;

    -- Claim (atomikus)
    with upd as (
      update public.customer_special_order_items
      set status = 'atadva', reserved_qty = null, updated_at = now()
      where order_id = v_order_id
        and id = any (p_item_ids)
        and tenant_id = v_tenant_id
        and status = 'itt_van'
        and deleted_at is null
      returning id
    )
    select coalesce(array_agg(id), '{}'), count(*)::int
    into v_claimed_ids, v_claimed_count
    from upd;

    if v_claimed_count = 0 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Közben valaki módosította a tételt — frissítsd az oldalt.'
      );
    end if;
    if v_claimed_count <> v_expected_count then
      update public.customer_special_order_items csoi
      set
        status = 'itt_van',
        reserved_qty = csoi.qty,
        updated_at = now()
      where csoi.id = any (v_claimed_ids)
        and csoi.tenant_id = v_tenant_id;
      return jsonb_build_object(
        'ok', false,
        'message', 'Közben változott egy tétel — frissítsd az oldalt, és próbáld újra.'
      );
    end if;

    -- Ügyfél biztosítása (due=0 / deferred)
    if v_customer_id is null and (v_deferred or v_due <= 0) then
      if nullif(trim(v_customer_name), '') is null then
        update public.customer_special_order_items
        set status = 'itt_van', reserved_qty = qty, updated_at = now()
        where id = any (v_claimed_ids) and tenant_id = v_tenant_id;
        return jsonb_build_object(
          'ok', false,
          'message', 'Az átadáshoz kell ügyfélnév a rendelésen.'
        );
      end if;

      -- Mobil alapján, majd név
      if nullif(trim(v_customer_mobile), '') is not null then
        select c.id into v_existing_id
        from public.customers c
        where c.tenant_id = v_tenant_id
          and c.deleted_at is null
          and c.mobile = trim(v_customer_mobile)
        limit 1;
      end if;
      if v_existing_id is null then
        select c.id into v_existing_id
        from public.customers c
        where c.tenant_id = v_tenant_id
          and c.deleted_at is null
          and lower(c.name) = lower(trim(v_customer_name))
        limit 1;
      end if;

      if v_existing_id is not null then
        v_customer_id := v_existing_id;
      else
        insert into public.customers (tenant_id, name, mobile, sms_notification)
        values (v_tenant_id, trim(v_customer_name), nullif(trim(v_customer_mobile), ''), true)
        returning id into v_customer_id;
      end if;

      update public.customer_special_orders
      set customer_id = v_customer_id, updated_at = now()
      where id = v_order_id and tenant_id = v_tenant_id;
    end if;

    if v_deferred or v_due <= 0 then
      v_payments := '[]'::jsonb;
      v_fulfill := true;
    else
      v_payments := jsonb_build_array(jsonb_build_object(
        'payment_method_id', p_payment_method_id,
        'amount', v_due
      ));
      v_fulfill := false;
    end if;

    v_note := format(
      'Ügyfélrendelés %s átadás%s%s',
      v_order_number,
      case when nullif(trim(v_customer_name), '') is not null
        then ' · ' || trim(v_customer_name) else '' end,
      case when v_deposit_use > 0
        then ' · előleg beszámítva: ' || v_deposit_use::text || ' Ft' else '' end
    );

    v_sale := public.create_sale(
      v_wh_id,
      v_customer_id,
      'manual',
      v_note,
      v_sale_items,
      v_sale_fees,
      jsonb_build_object('percentage', 0, 'amount', v_deposit_use),
      v_payments,
      null,
      v_fulfill
    );

    if coalesce((v_sale ->> 'ok')::boolean, false) is not true or (v_sale ->> 'id') is null then
      update public.customer_special_order_items
      set status = 'itt_van', reserved_qty = qty, updated_at = now()
      where id = any (v_claimed_ids) and tenant_id = v_tenant_id;
      return jsonb_build_object(
        'ok', false,
        'message', coalesce(v_sale ->> 'message', 'Nem sikerült az értékesítést rögzíteni.')
      );
    end if;

    v_sale_id := (v_sale ->> 'id')::uuid;
    v_sale_number := v_sale ->> 'sale_number';

    update public.sales_orders
    set customer_special_order_id = v_order_id, updated_at = now()
    where id = v_sale_id and tenant_id = v_tenant_id;

    insert into public.cso_sale_links (
      tenant_id, customer_special_order_id, sales_order_id, created_by
    ) values (
      v_tenant_id, v_order_id, v_sale_id, auth.uid()
    );

    update public.customer_special_orders
    set
      sales_order_id = v_sale_id,
      deposit_applied_amount = deposit_applied_amount + v_deposit_use,
      updated_at = now()
    where id = v_order_id and tenant_id = v_tenant_id;

    -- Termék sorok CSO link (díjakat a create_sale már kötötte cso_item_id-vel)
    update public.sales_order_items soi
    set customer_special_order_item_id = csoi.id
    from public.customer_special_order_items csoi
    where soi.sales_order_id = v_sale_id
      and soi.tenant_id = v_tenant_id
      and soi.deleted_at is null
      and soi.customer_special_order_item_id is null
      and soi.item_kind <> 'fee'
      and csoi.id = any (v_claimed_ids)
      and csoi.tenant_id = v_tenant_id
      and (
        (soi.item_kind = 'product' and soi.accessory_id = csoi.accessory_id)
        or (soi.item_kind = 'sheet_material' and soi.sheet_material_id = csoi.material_id)
        or (soi.item_kind = 'linear_material' and soi.linear_material_id = csoi.linear_material_id)
      )
      and abs(soi.quantity) = abs(coalesce(csoi.qty, 0))
      and round(soi.unit_price_gross) = round(coalesce(csoi.unit_price_gross, 0));

    v_item_count := v_item_count + v_claimed_count;
    if v_first_sale_id is null then
      v_first_sale_id := v_sale_id;
      v_first_sale_number := v_sale_number;
    end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'order_id', v_order_id,
      'sale_id', v_sale_id,
      'sale_number', v_sale_number
    ));
  end loop;

  if v_item_count = 0 then
    return jsonb_build_object('ok', false, 'message', 'Nincs átadható tétel.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', (v_results -> 0 ->> 'order_id'),
    'sale_id', v_first_sale_id,
    'sale_number', v_first_sale_number,
    'item_count', v_item_count,
    'sales', v_results,
    'message', v_item_count::text || ' tétel átadva.'
      || case when v_first_sale_number is not null
           then ' Eladás: ' || v_first_sale_number || '.' else '' end
  );
end;
$$;

revoke all on function public.cso_hand_over(uuid[], uuid, boolean, jsonb) from public;
grant execute on function public.cso_hand_over(uuid[], uuid, boolean, jsonb) to authenticated;

comment on function public.cso_hand_over(uuid[], uuid, boolean, jsonb) is
  'Ügyfélrendelés átadás: claim + create_sale + linkek + részleges előleg, egy tranzakció.';

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Page feature + entitlement (ügyfélrendelés beállítások)
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beallitasok/ugyfelrendeles',
  'Ügyfélrendelés beállítások',
  'Beállítások',
  '/beallitasok/ugyfelrendeles',
  173,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.tenant_entitlements (tenant_id, feature_key)
select e.tenant_id, '/beallitasok/ugyfelrendeles'
from public.tenant_entitlements e
where e.feature_key in ('customer_special_orders', '/ugyfelrendelesek')
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select a.tenant_id, a.membership_id, '/beallitasok/ugyfelrendeles', true
from public.tenant_membership_page_access a
where a.page_key = '/ugyfelrendelesek'
  and a.can_access = true
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
