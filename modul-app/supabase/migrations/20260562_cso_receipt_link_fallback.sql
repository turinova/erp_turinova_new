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
