-- Bevételezés P2: PO-n kívüli tétel + hiányos lezárás + receive RPC frissítés

-- ---------------------------------------------------------------------------
-- goods_receipt_items: extra (PO-n kívüli) sorok
-- ---------------------------------------------------------------------------
alter table public.goods_receipt_items
  alter column purchase_order_item_id drop not null;

alter table public.goods_receipt_items
  add column if not exists is_extra boolean not null default false;

comment on column public.goods_receipt_items.is_extra is
  'True = nem volt a PO-n; stock nő, PO státusz számításból kimarad.';

drop index if exists public.goods_receipt_items_receipt_po_item_alive_uidx;

create unique index if not exists goods_receipt_items_receipt_po_item_alive_uidx
  on public.goods_receipt_items (goods_receipt_id, purchase_order_item_id)
  where deleted_at is null and purchase_order_item_id is not null;

create unique index if not exists goods_receipt_items_receipt_extra_accessory_alive_uidx
  on public.goods_receipt_items (goods_receipt_id, accessory_id)
  where deleted_at is null and is_extra = true;

-- ---------------------------------------------------------------------------
-- purchase_orders: hiányos lezárás audit
-- ---------------------------------------------------------------------------
alter table public.purchase_orders
  add column if not exists closed_incomplete_at timestamptz;

alter table public.purchase_orders
  add column if not exists closed_incomplete_by uuid references auth.users (id) on delete set null;

comment on column public.purchase_orders.closed_incomplete_at is
  'Hiányos lezárás ideje (többet nem várunk) — status = received.';

-- ---------------------------------------------------------------------------
-- receive_goods_receipt — extra sorok is (LEFT JOIN / is_extra)
-- ---------------------------------------------------------------------------
create or replace function public.receive_goods_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.goods_receipts%rowtype;
  v_po public.purchase_orders%rowtype;
  v_item record;
  v_received_count integer;
  v_all_received boolean := true;
  v_po_item record;
  v_received_qty numeric(12, 3);
  v_ordered_qty numeric(12, 3);
  v_sm_number text;
  v_user_id uuid := auth.uid();
  v_unit_cost numeric(12, 0);
begin
  if p_receipt_id is null then
    return jsonb_build_object('ok', false, 'message', 'Hiányzó beérkezés azonosító.');
  end if;

  select * into v_receipt
  from public.goods_receipts
  where id = p_receipt_id
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A beérkezés nem található.');
  end if;

  if not public.can_write_tenant(v_receipt.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  if v_receipt.status = 'received' then
    select * into v_po
    from public.purchase_orders
    where id = v_receipt.purchase_order_id;
    return jsonb_build_object(
      'ok', true,
      'already_received', true,
      'receipt_id', v_receipt.id,
      'po_id', v_receipt.purchase_order_id,
      'po_status', coalesce(v_po.status, 'received')
    );
  end if;

  if v_receipt.status <> 'checking' then
    return jsonb_build_object(
      'ok', false,
      'message', 'Csak ellenőrzés alatt lévő beérkezést lehet bevételezni.'
    );
  end if;

  select * into v_po
  from public.purchase_orders
  where id = v_receipt.purchase_order_id
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A rendelés nem található.');
  end if;

  if v_po.status not in ('ordered', 'partial') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Ehhez a rendeléshez nem lehet bevételezni (státusz: ' || v_po.status || ').'
    );
  end if;

  select count(*) into v_received_count
  from public.goods_receipt_items
  where goods_receipt_id = p_receipt_id
    and deleted_at is null
    and quantity_received > 0;

  if v_received_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'message', 'Legalább egy tételnél meg kell adni a kapott mennyiséget.'
    );
  end if;

  for v_item in
    select
      gri.id,
      gri.accessory_id,
      gri.quantity_received,
      gri.name_snapshot,
      gri.is_extra,
      gri.purchase_order_item_id,
      poi.net_price as po_net_price,
      acc.purchase_price_net as acc_purchase_price,
      acc.price_net as acc_price_net
    from public.goods_receipt_items gri
    left join public.purchase_order_items poi
      on poi.id = gri.purchase_order_item_id
    left join public.accessories acc
      on acc.id = gri.accessory_id
    where gri.goods_receipt_id = p_receipt_id
      and gri.deleted_at is null
      and gri.quantity_received > 0
  loop
    v_unit_cost := coalesce(
      v_item.po_net_price,
      case
        when v_item.acc_purchase_price is not null and v_item.acc_purchase_price > 0
          then round(v_item.acc_purchase_price)
        else round(coalesce(v_item.acc_price_net, 0))
      end
    );

    v_sm_number := public.generate_stock_movement_number(v_receipt.tenant_id);

    insert into public.stock_movements (
      tenant_id,
      warehouse_id,
      product_type,
      accessory_id,
      quantity,
      movement_type,
      source_type,
      source_id,
      unit_cost_net,
      note,
      stock_movement_number,
      created_by
    ) values (
      v_receipt.tenant_id,
      v_receipt.warehouse_id,
      'accessory',
      v_item.accessory_id,
      v_item.quantity_received,
      'in',
      'purchase_receipt',
      p_receipt_id,
      v_unit_cost,
      case
        when v_item.is_extra then 'PO-n kívüli: ' || v_item.name_snapshot
        else v_item.name_snapshot
      end,
      v_sm_number,
      v_user_id
    );
  end loop;

  update public.goods_receipts
  set
    status = 'received',
    received_at = now(),
    received_by = v_user_id,
    updated_at = now()
  where id = p_receipt_id;

  -- PO státusz: csak nem-extra PO tételek
  for v_po_item in
    select poi.id, poi.quantity as ordered_qty
    from public.purchase_order_items poi
    where poi.purchase_order_id = v_po.id
      and poi.deleted_at is null
  loop
    select coalesce(sum(gri.quantity_received), 0) into v_received_qty
    from public.goods_receipt_items gri
    inner join public.goods_receipts gr on gr.id = gri.goods_receipt_id
    where gri.purchase_order_item_id = v_po_item.id
      and gri.deleted_at is null
      and gr.deleted_at is null
      and gr.status = 'received';

    v_ordered_qty := v_po_item.ordered_qty;

    if v_received_qty < v_ordered_qty then
      v_all_received := false;
      exit;
    end if;
  end loop;

  if v_all_received then
    update public.purchase_orders
    set status = 'received', updated_at = now()
    where id = v_po.id;
  else
    update public.purchase_orders
    set status = 'partial', updated_at = now()
    where id = v_po.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'po_id', v_po.id,
    'po_status', case when v_all_received then 'received' else 'partial' end,
    'items_received', v_received_count
  );
end;
$$;

comment on function public.receive_goods_receipt(uuid) is
  'Bevételezés: stock (PO + extra) + receipt received + PO partial/received.';
