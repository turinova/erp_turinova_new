-- POS barcode lookup: case-insensitive exact match
-- (USB wedge e.code → lowercase Key*; DB / címke tipikusan UPPER, pl. DT-CZ00035251)

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
  price_gross numeric,
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
        lower(a.barcode) = lower(p_code)
        or lower(a.barcode_internal) = lower(p_code)
        or lower(a.sku) = lower(p_code)
      )
    order by
      case
        when lower(a.barcode) = lower(p_code) then 0
        when lower(a.barcode_internal) = lower(p_code) then 1
        else 2
      end
    limit 1
  )
  select
    h.id,
    h.name,
    h.sku,
    h.price_net,
    coalesce(h.price_gross, round(h.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)))::numeric,
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
