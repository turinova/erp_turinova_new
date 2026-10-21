-- Terméklista kereső: több szó = token-AND a név+SKU+barcode+gyártó doc-on.
-- Pl. "strong csavar" → Strong gyártó + csavar a névben. Phrase ILIKE továbbra is OK.

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
  v_pat1 text;
  v_toks text[];
  v_tok_count int;
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 50));
  v_offset int := greatest(0, coalesce(p_offset, 0));
begin
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

  -- %/_ strip → GIN trgm; whitespace → tokenek
  v_q := regexp_replace(v_q, '[%_\\]', '', 'g');
  v_q := trim(both from regexp_replace(v_q, '\s+', ' ', 'g'));
  if v_q = '' then
    return;
  end if;

  v_toks := array_remove(regexp_split_to_array(lower(v_q), '\s+'), '');
  if v_toks is null or cardinality(v_toks) = 0 then
    return;
  end if;
  v_tok_count := cardinality(v_toks);
  v_pat1 := '%' || v_toks[1] || '%';

  return query
  with mfr as (
    select mf.id
    from public.manufacturers mf
    where mf.tenant_id = p_tenant_id
      and mf.deleted_at is null
      and mf.name ilike v_pat1
    limit 80
  ),
  gathered as materialized (
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.name ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.sku ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.barcode is not null
      and a.barcode ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.barcode_internal is not null
      and a.barcode_internal ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.deleted_at is null
      and a.manufacturer_id in (select mfr.id from mfr)
  ),
  matched as materialized (
    select g.id
    from gathered g
    join public.accessories a on a.id = g.id
    left join public.manufacturers m
      on m.id = a.manufacturer_id and m.deleted_at is null
    where v_tok_count = 1
       or not exists (
         select 1
         from unnest(v_toks) tok
         where position(
           tok
           in lower(concat_ws(
             ' ',
             a.name,
             a.sku,
             coalesce(a.barcode, ''),
             coalesce(a.barcode_internal, ''),
             coalesce(m.name, '')
           ))
         ) = 0
       )
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

comment on function public.search_accessories_page is
  'Termék lista/kereső: 1 token ILIKE; több token = AND a név+SKU+barcode+gyártó doc-on.';
