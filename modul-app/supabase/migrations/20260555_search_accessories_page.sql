-- Terméklista / kereső: egy roundtrip RPC + barcode_internal trgm.
-- Kerüli a PostgREST ORDER BY name + ILIKE filter scan timeoutot ~30k+ soron.

create extension if not exists pg_trgm;

create index if not exists accessories_barcode_internal_trgm_idx
  on public.accessories using gin (barcode_internal gin_trgm_ops)
  where deleted_at is null and barcode_internal is not null;

create or replace function public.search_accessories_page(
  p_tenant_id uuid,
  p_q text default '',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  name text,
  sku text,
  barcode text,
  barcode_internal text,
  manufacturer_id uuid,
  manufacturer_name text,
  tax_rate_id uuid,
  tax_rate_name text,
  tax_rate_percent numeric,
  unit_id uuid,
  unit_name text,
  unit_shortform text,
  price_net numeric,
  price_gross numeric,
  purchase_price_net numeric,
  margin_factor numeric,
  image_url text,
  active boolean,
  sellable_pos boolean,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_q text := trim(both from coalesce(p_q, ''));
  v_pattern text;
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 50));
  v_offset int := greatest(0, coalesce(p_offset, 0));
begin
  -- DEFINER: RLS ne fusson 30k+ soron; AuthZ egy check az elején.
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'not authorized for tenant catalog'
      using errcode = '42501';
  end if;

  if v_q = '' then
    return query
    with total as (
      select count(*)::bigint as c
      from public.accessories a
      where a.tenant_id = p_tenant_id
        and a.deleted_at is null
    )
    select
      a.id,
      a.name,
      a.sku,
      a.barcode,
      a.barcode_internal,
      a.manufacturer_id,
      coalesce(m.name, '—')::text,
      a.tax_rate_id,
      coalesce(t.name, '—')::text,
      coalesce(t.rate_percent, 0)::numeric,
      a.unit_id,
      coalesce(u.name, '—')::text,
      coalesce(u.shortform, 'db')::text,
      a.price_net::numeric,
      round(a.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))::numeric,
      a.purchase_price_net::numeric,
      a.margin_factor::numeric,
      a.image_url,
      a.active,
      a.sellable_pos,
      a.created_at,
      a.updated_at,
      total.c
    from public.accessories a
    cross join total
    left join public.manufacturers m on m.id = a.manufacturer_id
    left join public.tax_rates t on t.id = a.tax_rate_id
    left join public.units u on u.id = a.unit_id
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
    order by a.name asc, a.id asc
    limit v_limit
    offset v_offset;
    return;
  end if;

  -- %/_ strip → GIN trgm használható (ESCAPE nélkül)
  v_q := regexp_replace(v_q, '[%_\\]', '', 'g');
  if v_q = '' then
    return;
  end if;
  v_pattern := '%' || v_q || '%';

  return query
  with mfr as (
    select mf.id
    from public.manufacturers mf
    where mf.tenant_id = p_tenant_id
      and mf.deleted_at is null
      and mf.name ilike v_pattern
    limit 50
  ),
  matched as materialized (
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.name ilike v_pattern
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.sku ilike v_pattern
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.barcode is not null
      and a.barcode ilike v_pattern
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.barcode_internal is not null
      and a.barcode_internal ilike v_pattern
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.manufacturer_id in (select mfr.id from mfr)
  ),
  total as (
    select count(*)::bigint as c from matched
  )
  select
    a.id,
    a.name,
    a.sku,
    a.barcode,
    a.barcode_internal,
    a.manufacturer_id,
    coalesce(m.name, '—')::text,
    a.tax_rate_id,
    coalesce(t.name, '—')::text,
    coalesce(t.rate_percent, 0)::numeric,
    a.unit_id,
    coalesce(u.name, '—')::text,
    coalesce(u.shortform, 'db')::text,
    a.price_net::numeric,
    round(a.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))::numeric,
    a.purchase_price_net::numeric,
    a.margin_factor::numeric,
    a.image_url,
    a.active,
    a.sellable_pos,
    a.created_at,
    a.updated_at,
    total.c
  from matched mt
  join public.accessories a on a.id = mt.id
  cross join total
  left join public.manufacturers m on m.id = a.manufacturer_id
  left join public.tax_rates t on t.id = a.tax_rate_id
  left join public.units u on u.id = a.unit_id
  order by a.name asc, a.id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_accessories_page(uuid, text, int, int) from public;
grant execute on function public.search_accessories_page(uuid, text, int, int) to authenticated;
grant execute on function public.search_accessories_page(uuid, text, int, int) to service_role;

comment on function public.search_accessories_page is
  'Termék lista/kereső egy roundtrip — elkerüli a PostgREST ILIKE+ORDER BY name timeoutot.';
