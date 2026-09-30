-- POS exact barcode lookup + on_hand egy round-tripben
-- + batch on_hand (typeahead / multi)

create or replace function public.lookup_pos_barcode(
  p_tenant_id uuid,
  p_code text,
  p_warehouse_id uuid
)
returns table (
  id uuid,
  name text,
  sku text,
  price_net numeric,
  barcode text,
  barcode_internal text,
  image_url text,
  tax_rate_percent numeric,
  unit_shortform text,
  on_hand numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with hit as (
    select a.*
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        a.barcode = p_code
        or a.barcode_internal = p_code
        or a.sku = p_code
      )
    order by
      case
        when a.barcode = p_code then 0
        when a.barcode_internal = p_code then 1
        else 2
      end
    limit 1
  )
  select
    h.id,
    h.name,
    h.sku,
    h.price_net,
    h.barcode,
    h.barcode_internal,
    h.image_url,
    coalesce(t.rate_percent, 0)::numeric as tax_rate_percent,
    coalesce(u.shortform, 'db') as unit_shortform,
    public.accessory_on_hand(p_tenant_id, h.id, p_warehouse_id) as on_hand
  from hit h
  left join public.tax_rates t on t.id = h.tax_rate_id
  left join public.units u on u.id = h.unit_id;
$$;

revoke all on function public.lookup_pos_barcode(uuid, text, uuid) from public;
grant execute on function public.lookup_pos_barcode(uuid, text, uuid) to authenticated;

create or replace function public.accessories_on_hand(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_accessory_ids uuid[]
)
returns table (
  accessory_id uuid,
  on_hand numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id as accessory_id,
    coalesce(sum(
      case
        when m.movement_type = 'in' then m.quantity
        when m.movement_type = 'out' then -m.quantity
        else 0
      end
    ), 0) as on_hand
  from unnest(p_accessory_ids) as a(id)
  left join public.stock_movements m
    on m.tenant_id = p_tenant_id
   and m.accessory_id = a.id
   and m.warehouse_id = p_warehouse_id
  group by a.id;
$$;

revoke all on function public.accessories_on_hand(uuid, uuid, uuid[]) from public;
grant execute on function public.accessories_on_hand(uuid, uuid, uuid[]) to authenticated;
