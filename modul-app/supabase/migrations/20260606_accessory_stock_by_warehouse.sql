-- Fast per-warehouse on_hand for product detail (avoids unbounded stock_movements scan in JS).

create or replace function public.accessory_stock_by_warehouse(
  p_tenant_id uuid,
  p_accessory_id uuid
)
returns table (
  warehouse_id uuid,
  warehouse_name text,
  warehouse_code text,
  on_hand numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.warehouse_id,
    coalesce(w.name, '—')::text as warehouse_name,
    coalesce(w.code, '')::text as warehouse_code,
    coalesce(sum(
      case
        when m.movement_type = 'in' then m.quantity
        when m.movement_type = 'out' then -m.quantity
        else 0
      end
    ), 0)::numeric as on_hand
  from public.stock_movements m
  left join public.warehouses w
    on w.id = m.warehouse_id
   and w.tenant_id = p_tenant_id
  where m.tenant_id = p_tenant_id
    and m.accessory_id = p_accessory_id
  group by m.warehouse_id, w.name, w.code
  having abs(coalesce(sum(
    case
      when m.movement_type = 'in' then m.quantity
      when m.movement_type = 'out' then -m.quantity
      else 0
    end
  ), 0)) > 0.0001
  order by coalesce(w.name, '—');
$$;

revoke all on function public.accessory_stock_by_warehouse(uuid, uuid) from public;
grant execute on function public.accessory_stock_by_warehouse(uuid, uuid) to authenticated;
