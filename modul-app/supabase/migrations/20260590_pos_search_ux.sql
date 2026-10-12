-- POS search UX: ANY fallback, frequent products, manufacturer chips, search telemetry.

create extension if not exists pg_trgm;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Telemetry
-- ---------------------------------------------------------------------------
create table if not exists public.pos_search_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  warehouse_id uuid references public.warehouses (id) on delete set null,
  register_id uuid,
  user_id uuid,
  q text not null,
  hit_count int not null default 0,
  picked_accessory_id uuid references public.accessories (id) on delete set null,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index if not exists pos_search_events_tenant_created_idx
  on public.pos_search_events (tenant_id, created_at desc);

create index if not exists pos_search_events_tenant_q_idx
  on public.pos_search_events (tenant_id, q)
  where hit_count = 0;

alter table public.pos_search_events enable row level security;

drop policy if exists pos_search_events_select on public.pos_search_events;
create policy pos_search_events_select
  on public.pos_search_events for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists pos_search_events_insert on public.pos_search_events;
create policy pos_search_events_insert
  on public.pos_search_events for insert to authenticated
  with check (public.is_tenant_member(tenant_id));

grant select, insert on public.pos_search_events to authenticated;

-- ---------------------------------------------------------------------------
-- Frequent POS products (last N days)
-- ---------------------------------------------------------------------------
create or replace function public.pos_frequent_products(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_days int default 7,
  p_limit int default 8
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
  sale_count bigint
)
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 8), 24));
  v_days int := greatest(1, least(coalesce(p_days, 7), 90));
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'not authorized for tenant catalog'
      using errcode = '42501';
  end if;

  return query
  with top as (
    select
      soi.accessory_id as aid,
      count(*)::bigint as cnt
    from public.sales_order_items soi
    join public.sales_orders so
      on so.id = soi.sales_order_id
     and so.tenant_id = soi.tenant_id
    where soi.tenant_id = p_tenant_id
      and soi.accessory_id is not null
      and soi.item_kind = 'product'
      and so.deleted_at is null
      and so.created_at >= (now() - make_interval(days => v_days))
      and (p_warehouse_id is null or so.warehouse_id = p_warehouse_id)
      and so.channel in ('pos', 'manual')
    group by soi.accessory_id
    order by cnt desc
    limit v_limit
  )
  select
    a.id,
    a.name,
    a.sku,
    a.barcode,
    a.barcode_internal,
    a.price_net::numeric,
    coalesce(t.rate_percent, 0)::numeric,
    coalesce(u.shortform, 'db')::text,
    a.image_url,
    public.accessory_on_hand(p_tenant_id, a.id, p_warehouse_id)::numeric,
    top.cnt
  from top
  join public.accessories a on a.id = top.aid
  left join public.tax_rates t on t.id = a.tax_rate_id
  left join public.units u on u.id = a.unit_id
  where a.tenant_id = p_tenant_id
    and a.active = true
    and a.deleted_at is null
    and coalesce(a.sellable_pos, true) = true
  order by top.cnt desc, a.name asc;
end;
$$;

revoke all on function public.pos_frequent_products(uuid, uuid, int, int) from public;
grant execute on function public.pos_frequent_products(uuid, uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Manufacturer chips for POS
-- ---------------------------------------------------------------------------
create or replace function public.pos_search_manufacturer_chips(
  p_tenant_id uuid,
  p_limit int default 6
)
returns table (
  id uuid,
  name text,
  product_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.name,
    count(a.id)::bigint as product_count
  from public.manufacturers m
  join public.accessories a
    on a.manufacturer_id = m.id
   and a.tenant_id = m.tenant_id
   and a.active = true
   and a.deleted_at is null
   and coalesce(a.sellable_pos, true) = true
  where m.tenant_id = p_tenant_id
    and m.deleted_at is null
    and public.is_tenant_member(p_tenant_id)
  group by m.id, m.name
  having count(a.id) > 0
  order by count(a.id) desc, m.name asc
  limit greatest(1, least(coalesce(p_limit, 6), 12));
$$;

revoke all on function public.pos_search_manufacturer_chips(uuid, int) from public;
grant execute on function public.pos_search_manufacturer_chips(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- search_pos_products: ALL → ANY (≥2 token) → typo (≥4 char)
-- ---------------------------------------------------------------------------
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
  v_tok_count int;
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
  v_tok_count := cardinality(v_toks);

  -- Pass 1: token ALL
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
        c.aname, c.asku, c.abarcode, c.abarcode_internal,
        c.awmpn, c.web_brand, c.mfr_name,
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
          else 200 + least(50, coalesce(similarity(th.name_n, v_norm), 0) * 50)
        end
      )::numeric as score,
      public.accessory_on_hand(p_tenant_id, th.aid, p_warehouse_id)::numeric as qty
    from token_hits th
  )
  select
    s.aid, s.aname, s.asku, s.abarcode, s.abarcode_internal,
    s.aprice_net::numeric,
    coalesce(t.rate_percent, 0)::numeric,
    coalesce(u.shortform, 'db')::text,
    s.aimage_url, s.qty, s.awmpn, s.score
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

  -- Pass 2: Match ANY (2+ tokens) — rank by token hit count
  if v_tok_count >= 2 then
    return query
    with docs as (
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
        lower(unaccent(concat_ws(' ',
          a.name, a.sku, a.barcode, a.barcode_internal,
          w.web_mpn, w.web_brand, m.name,
          array_to_string(w.web_search_aliases, ' ')
        ))) as doc,
        lower(unaccent(a.name)) as name_n
      from public.accessories a
      left join public.accessory_web w
        on w.accessory_id = a.id and w.tenant_id = a.tenant_id
      left join public.manufacturers m
        on m.id = a.manufacturer_id and m.deleted_at is null
      where a.tenant_id = p_tenant_id
        and a.active = true
        and a.deleted_at is null
        and coalesce(a.sellable_pos, true) = true
        and exists (
          select 1 from unnest(v_toks) t where position(t in
            lower(unaccent(concat_ws(' ',
              a.name, a.sku, a.barcode, a.barcode_internal,
              w.web_mpn, w.web_brand, m.name,
              array_to_string(w.web_search_aliases, ' ')
            )))
          ) > 0
        )
    ),
    scored as (
      select
        d.*,
        (
          select count(*)::numeric
          from unnest(v_toks) t
          where position(t in d.doc) > 0
        ) as tok_hits,
        public.accessory_on_hand(p_tenant_id, d.aid, p_warehouse_id)::numeric as qty
      from docs d
    )
    select
      s.aid, s.aname, s.asku, s.abarcode, s.abarcode_internal,
      s.aprice_net::numeric,
      coalesce(t.rate_percent, 0)::numeric,
      coalesce(u.shortform, 'db')::text,
      s.aimage_url, s.qty, s.awmpn,
      (150 + s.tok_hits * 40 + least(30, coalesce(similarity(s.name_n, v_norm), 0) * 30))::numeric
    from scored s
    left join public.tax_rates t on t.id = s.tax_rate_id
    left join public.units u on u.id = s.unit_id
    where s.tok_hits > 0
    order by
      s.tok_hits desc,
      case when p_stock_first then (case when s.qty > 0 then 0 else 1 end) else 0 end,
      s.aname asc
    limit v_limit;

    get diagnostics v_hit_count = row_count;
    if v_hit_count > 0 then
      return;
    end if;
  end if;

  -- Pass 3: typo fallback
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
    f.aid, f.aname, f.asku, f.abarcode, f.abarcode_internal,
    f.aprice_net::numeric,
    coalesce(t.rate_percent, 0)::numeric,
    coalesce(u.shortform, 'db')::text,
    f.aimage_url, f.qty, f.awmpn,
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

comment on function public.search_pos_products is
  'POS typeahead: token-ALL → token-ANY (≥2) → typo trgm; alias/MPN/brand; on_hand.';
