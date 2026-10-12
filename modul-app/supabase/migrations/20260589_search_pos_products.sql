-- POS typeahead: token + unaccent + alias + ranking + on_hand egy round-tripben.
-- Typo fallback (pg_trgm) ha token-ALL 0 találat és q hossz >= 4.
-- Minták: storefront_search (token/unaccent), lookup_pos_barcode (on_hand), search_accessories_page (auth).

create extension if not exists pg_trgm;
create extension if not exists unaccent with schema extensions;

create index if not exists accessories_name_trgm_idx
  on public.accessories using gin (name gin_trgm_ops)
  where deleted_at is null;

create index if not exists accessories_sku_trgm_idx
  on public.accessories using gin (sku gin_trgm_ops)
  where deleted_at is null;

create index if not exists accessories_barcode_trgm_idx
  on public.accessories using gin (barcode gin_trgm_ops)
  where deleted_at is null and barcode is not null;

create index if not exists accessory_web_mpn_trgm_idx
  on public.accessory_web using gin (web_mpn gin_trgm_ops)
  where web_mpn is not null and btrim(web_mpn) <> '';

create or replace function public.search_pos_products(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_q text,
  p_limit int default 15,
  p_stock_first boolean default true
)
returns table (
  id uuid,
  name text,
  sku text,
  barcode text,
  barcode_internal text,
  price_net numeric,
  tax_rate_percent numeric,
  unit_shortform text,
  image_url text,
  on_hand numeric,
  web_mpn text,
  match_score numeric
)
language plpgsql
stable
security definer
set search_path = public, extensions
set statement_timeout = '8s'
as $$
declare
  v_raw text := trim(both from coalesce(p_q, ''));
  v_norm text;
  v_toks text[];
  v_limit int := greatest(1, least(coalesce(p_limit, 15), 30));
  v_q_len int;
  v_hit_count int := 0;
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'not authorized for tenant catalog'
      using errcode = '42501';
  end if;

  if v_raw = '' or p_warehouse_id is null then
    return;
  end if;

  v_norm := regexp_replace(lower(unaccent(v_raw)), '[%_\\]', '', 'g');
  v_norm := regexp_replace(v_norm, '(\d),(\d)', '\1.\2', 'g');
  v_norm := regexp_replace(v_norm, '(\d)([a-z])', '\1 \2', 'g');
  v_norm := regexp_replace(v_norm, '[^a-z0-9.]+', ' ', 'g');
  v_norm := trim(both from v_norm);
  v_q_len := char_length(replace(v_norm, ' ', ''));

  if v_norm = '' then
    return;
  end if;

  v_toks := array_remove(regexp_split_to_array(v_norm, '\s+'), '');
  if v_toks is null or cardinality(v_toks) = 0 then
    return;
  end if;

  return query
  with cand as (
    select
      a.id as aid,
      a.name as aname,
      a.sku as asku,
      a.barcode as abarcode,
      a.barcode_internal as abarcode_internal,
      a.price_net as aprice_net,
      a.image_url as aimage_url,
      a.tax_rate_id,
      a.unit_id,
      nullif(btrim(w.web_mpn), '') as awmpn,
      w.web_brand,
      w.web_search_aliases,
      m.name as mfr_name
    from public.accessories a
    left join public.accessory_web w
      on w.accessory_id = a.id and w.tenant_id = a.tenant_id
    left join public.manufacturers m
      on m.id = a.manufacturer_id and m.deleted_at is null
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        -- első token: unaccent mezőkön (ékezet nélküli gépelés)
        position(v_toks[1] in lower(unaccent(a.name))) > 0
        or position(v_toks[1] in lower(unaccent(a.sku))) > 0
        or position(v_toks[1] in lower(unaccent(coalesce(a.barcode, '')))) > 0
        or position(v_toks[1] in lower(unaccent(coalesce(a.barcode_internal, '')))) > 0
        or position(v_toks[1] in lower(unaccent(coalesce(w.web_mpn, '')))) > 0
        or position(v_toks[1] in lower(unaccent(coalesce(w.web_brand, '')))) > 0
        or position(v_toks[1] in lower(unaccent(coalesce(m.name, '')))) > 0
        or position(
          v_toks[1]
          in lower(unaccent(coalesce(array_to_string(w.web_search_aliases, ' '), '')))
        ) > 0
      )
  ),
  docs as (
    select
      c.*,
      lower(unaccent(concat_ws(' ',
        c.aname,
        c.asku,
        c.abarcode,
        c.abarcode_internal,
        c.awmpn,
        c.web_brand,
        c.mfr_name,
        array_to_string(c.web_search_aliases, ' ')
      ))) as doc,
      lower(unaccent(c.aname)) as name_n,
      lower(unaccent(c.asku)) as sku_n,
      lower(unaccent(coalesce(c.abarcode, ''))) as barcode_n,
      lower(unaccent(coalesce(c.abarcode_internal, ''))) as barcode_int_n,
      lower(unaccent(coalesce(c.awmpn, ''))) as mpn_n
    from cand c
  ),
  token_hits as (
    select d.*
    from docs d
    where not exists (
      select 1 from unnest(v_toks) t where position(t in d.doc) = 0
    )
  ),
  scored as (
    select
      th.*,
      (
        case
          when th.sku_n = v_norm
            or th.barcode_n = v_norm
            or th.barcode_int_n = v_norm
            or th.mpn_n = v_norm
            then 1000
          when th.name_n = v_norm then 900
          when th.sku_n like v_norm || '%'
            or th.barcode_n like v_norm || '%'
            or th.barcode_int_n like v_norm || '%'
            or th.mpn_n like v_norm || '%'
            then 700
          when th.name_n like v_norm || '%'
            or th.name_n like v_toks[1] || '%'
            then 600
          when th.sku_n like '%' || v_norm || '%'
            or th.mpn_n like '%' || v_norm || '%'
            then 400
          when th.barcode_n like '%' || v_norm || '%'
            or th.barcode_int_n like '%' || v_norm || '%'
            then 350
          else 200 + least(
            50,
            coalesce(similarity(th.name_n, v_norm), 0) * 50
          )
        end
      )::numeric as score,
      public.accessory_on_hand(p_tenant_id, th.aid, p_warehouse_id)::numeric as qty
    from token_hits th
  )
  select
    s.aid,
    s.aname,
    s.asku,
    s.abarcode,
    s.abarcode_internal,
    s.aprice_net::numeric,
    coalesce(t.rate_percent, 0)::numeric,
    coalesce(u.shortform, 'db')::text,
    s.aimage_url,
    s.qty,
    s.awmpn,
    s.score
  from scored s
  left join public.tax_rates t on t.id = s.tax_rate_id
  left join public.units u on u.id = s.unit_id
  order by
    s.score desc,
    case when p_stock_first then (case when s.qty > 0 then 0 else 1 end) else 0 end,
    case when p_stock_first then s.qty else 0 end desc,
    s.aname asc
  limit v_limit;

  get diagnostics v_hit_count = row_count;

  if v_hit_count > 0 then
    return;
  end if;

  -- Phase 3: typo fallback
  if v_q_len < 4 then
    return;
  end if;

  return query
  with fuzzy as (
    select
      a.id as aid,
      a.name as aname,
      a.sku as asku,
      a.barcode as abarcode,
      a.barcode_internal as abarcode_internal,
      a.price_net as aprice_net,
      a.image_url as aimage_url,
      a.tax_rate_id,
      a.unit_id,
      nullif(btrim(w.web_mpn), '') as awmpn,
      greatest(
        similarity(lower(unaccent(a.name)), v_norm),
        similarity(lower(unaccent(a.sku)), v_norm),
        similarity(lower(unaccent(coalesce(w.web_mpn, ''))), v_norm)
      ) as sim,
      public.accessory_on_hand(p_tenant_id, a.id, p_warehouse_id)::numeric as qty
    from public.accessories a
    left join public.accessory_web w
      on w.accessory_id = a.id and w.tenant_id = a.tenant_id
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        lower(unaccent(a.name)) % v_norm
        or lower(unaccent(a.sku)) % v_norm
        or (
          w.web_mpn is not null
          and btrim(w.web_mpn) <> ''
          and lower(unaccent(w.web_mpn)) % v_norm
        )
      )
      and greatest(
        similarity(lower(unaccent(a.name)), v_norm),
        similarity(lower(unaccent(a.sku)), v_norm),
        similarity(lower(unaccent(coalesce(w.web_mpn, ''))), v_norm)
      ) >= 0.28
  )
  select
    f.aid,
    f.aname,
    f.asku,
    f.abarcode,
    f.abarcode_internal,
    f.aprice_net::numeric,
    coalesce(t.rate_percent, 0)::numeric,
    coalesce(u.shortform, 'db')::text,
    f.aimage_url,
    f.qty,
    f.awmpn,
    (100 + f.sim * 80)::numeric
  from fuzzy f
  left join public.tax_rates t on t.id = f.tax_rate_id
  left join public.units u on u.id = f.unit_id
  order by
    (100 + f.sim * 80) desc,
    case when p_stock_first then (case when f.qty > 0 then 0 else 1 end) else 0 end,
    f.aname asc
  limit v_limit;
end;
$$;

revoke all on function public.search_pos_products(uuid, uuid, text, int, boolean) from public;
grant execute on function public.search_pos_products(uuid, uuid, text, int, boolean) to authenticated;
grant execute on function public.search_pos_products(uuid, uuid, text, int, boolean) to service_role;

comment on function public.search_pos_products is
  'POS typeahead: unaccent token-ALL + alias/MPN/brand, ranking, on_hand; typo trgm fallback ha 0 találat.';
