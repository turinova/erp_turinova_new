-- Fast POS barcode lookup: equality (btree) + client/DB UPPER hygiene.
-- Replaces 20260604 lower()/ilike path which skipped (tenant_id, barcode) unique indexes.
-- SKU keeps lower() — accessories_tenant_sku_alive_uidx is on lower(sku).

-- 1) Data hygiene: UPPER barcodes where no unique conflict
update public.accessories a
set
  barcode = upper(a.barcode),
  updated_at = now()
where a.deleted_at is null
  and a.barcode is not null
  and length(trim(a.barcode)) > 0
  and a.barcode <> upper(a.barcode)
  and not exists (
    select 1
    from public.accessories b
    where b.tenant_id = a.tenant_id
      and b.deleted_at is null
      and b.id <> a.id
      and b.barcode is not null
      and b.barcode = upper(a.barcode)
  );

update public.accessories a
set
  barcode_internal = upper(a.barcode_internal),
  updated_at = now()
where a.deleted_at is null
  and a.barcode_internal is not null
  and length(trim(a.barcode_internal)) > 0
  and a.barcode_internal <> upper(a.barcode_internal)
  and not exists (
    select 1
    from public.accessories b
    where b.tenant_id = a.tenant_id
      and b.deleted_at is null
      and b.id <> a.id
      and b.barcode_internal is not null
      and b.barcode_internal = upper(a.barcode_internal)
  );

-- 2) RPC: equality on barcode fields (index), lower(sku) for SKU
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
        a.barcode = p_code
        or a.barcode_internal = p_code
        or lower(a.sku) = lower(p_code)
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
