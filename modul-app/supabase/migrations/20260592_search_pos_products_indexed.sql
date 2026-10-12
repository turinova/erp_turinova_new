-- POS search: use GIN trgm (ILIKE / %) for candidate gather, then token/unaccent
-- ranking on the small set. Batch on_hand kept from 20260591.

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
  v_fetch int;
  v_q_len int;
  v_hit_count int := 0;
  v_tok_count int;
  v_pat text;
  v_pat1 text;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_tenant_member(p_tenant_id) then
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
  v_fetch := least(v_limit * 3, 45);
  -- ILIKE patterns (GIN trgm) — strip %/_ already in v_norm/toks
  v_pat := '%' || replace(v_norm, ' ', '%') || '%';
  v_pat1 := '%' || v_toks[1] || '%';

  -- Pass 1: indexable ILIKE gather → token-ALL on unaccent doc → rank → batch qty
  return query
  with ids as (
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and a.name ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and a.sku ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and a.barcode is not null
      and a.barcode ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and a.barcode_internal is not null
      and a.barcode_internal ilike v_pat1
    union
    select w.accessory_id
    from public.accessory_web w
    where w.tenant_id = p_tenant_id
      and (
        w.web_mpn ilike v_pat1
        or w.web_brand ilike v_pat1
        or exists (
          select 1
          from unnest(coalesce(w.web_search_aliases, '{}'::text[])) al
          where al ilike v_pat1
        )
      )
    union
    select a.id
    from public.manufacturers m
    join public.accessories a
      on a.manufacturer_id = m.id
     and a.tenant_id = p_tenant_id
     and a.active = true
     and a.deleted_at is null
     and coalesce(a.sellable_pos, true) = true
    where m.tenant_id = p_tenant_id
      and m.deleted_at is null
      and m.name ilike v_pat1
  ),
  cand as (
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
      lower(unaccent(a.name)) as name_n,
      lower(unaccent(a.sku)) as sku_n,
      lower(unaccent(coalesce(a.barcode, ''))) as barcode_n,
      lower(unaccent(coalesce(a.barcode_internal, ''))) as barcode_int_n,
      lower(unaccent(coalesce(w.web_mpn, ''))) as mpn_n
    from ids i
    join public.accessories a on a.id = i.id
    left join public.accessory_web w
      on w.accessory_id = a.id and w.tenant_id = a.tenant_id
    left join public.manufacturers m
      on m.id = a.manufacturer_id and m.deleted_at is null
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
  ),
  token_hits as (
    select c.*
    from cand c
    where not exists (
      select 1 from unnest(v_toks) t where position(t in c.doc) = 0
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
      )::numeric as score
    from token_hits th
  ),
  limited as (
    select s.*
    from scored s
    order by s.score desc, s.aname asc
    limit v_fetch
  ),
  qtys as (
    select oh.accessory_id, oh.on_hand
    from public.accessories_on_hand(
      p_tenant_id,
      p_warehouse_id,
      coalesce((select array_agg(l.aid) from limited l), '{}'::uuid[])
    ) oh
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
    coalesce(q.on_hand, 0)::numeric,
    s.awmpn,
    s.score
  from limited s
  left join qtys q on q.accessory_id = s.aid
  left join public.tax_rates t on t.id = s.tax_rate_id
  left join public.units u on u.id = s.unit_id
  order by
    s.score desc,
    case when p_stock_first then (case when coalesce(q.on_hand, 0) > 0 then 0 else 1 end) else 0 end,
    case when p_stock_first then coalesce(q.on_hand, 0) else 0 end desc,
    s.aname asc
  limit v_limit;

  get diagnostics v_hit_count = row_count;
  if v_hit_count > 0 then
    return;
  end if;

  -- Pass 2: Match ANY (multi-token only) — same ILIKE gather, softer token filter
  if v_tok_count >= 2 then
    return query
    with ids as (
      select a.id
      from public.accessories a
      where a.tenant_id = p_tenant_id
        and a.active = true
        and a.deleted_at is null
        and coalesce(a.sellable_pos, true) = true
        and (
          a.name ilike v_pat1
          or a.sku ilike v_pat1
          or (a.barcode is not null and a.barcode ilike v_pat1)
          or (a.barcode_internal is not null and a.barcode_internal ilike v_pat1)
        )
      union
      select w.accessory_id
      from public.accessory_web w
      where w.tenant_id = p_tenant_id
        and (w.web_mpn ilike v_pat1 or w.web_brand ilike v_pat1)
    ),
    docs as (
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
      from ids i
      join public.accessories a on a.id = i.id
      left join public.accessory_web w
        on w.accessory_id = a.id and w.tenant_id = a.tenant_id
      left join public.manufacturers m
        on m.id = a.manufacturer_id and m.deleted_at is null
      where a.tenant_id = p_tenant_id
        and a.active = true
        and a.deleted_at is null
    ),
    scored as (
      select
        d.*,
        (
          select count(*)::numeric
          from unnest(v_toks) tok
          where position(tok in d.doc) > 0
        ) as tok_hits
      from docs d
    ),
    limited as (
      select
        s.*,
        (150 + s.tok_hits * 40 + least(30, coalesce(similarity(s.name_n, v_norm), 0) * 30))::numeric as score
      from scored s
      where s.tok_hits > 0
      order by s.tok_hits desc, s.aname asc
      limit v_fetch
    ),
    qtys as (
      select oh.accessory_id, oh.on_hand
      from public.accessories_on_hand(
        p_tenant_id,
        p_warehouse_id,
        coalesce((select array_agg(l.aid) from limited l), '{}'::uuid[])
      ) oh
    )
    select
      s.aid, s.aname, s.asku, s.abarcode, s.abarcode_internal,
      s.aprice_net::numeric,
      coalesce(t.rate_percent, 0)::numeric,
      coalesce(u.shortform, 'db')::text,
      s.aimage_url,
      coalesce(q.on_hand, 0)::numeric,
      s.awmpn,
      s.score
    from limited s
    left join qtys q on q.accessory_id = s.aid
    left join public.tax_rates t on t.id = s.tax_rate_id
    left join public.units u on u.id = s.unit_id
    order by
      s.score desc,
      case when p_stock_first then (case when coalesce(q.on_hand, 0) > 0 then 0 else 1 end) else 0 end,
      s.aname asc
    limit v_limit;

    get diagnostics v_hit_count = row_count;
    if v_hit_count > 0 then
      return;
    end if;
  end if;

  -- Pass 3: typo — only ≥4 chars; use indexed name/sku % operator
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
        similarity(a.name, v_raw),
        similarity(a.sku, v_raw),
        similarity(coalesce(w.web_mpn, ''), v_raw)
      ) as sim
    from public.accessories a
    left join public.accessory_web w
      on w.accessory_id = a.id and w.tenant_id = a.tenant_id
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        a.name % v_raw
        or a.sku % v_raw
        or (
          w.web_mpn is not null
          and btrim(w.web_mpn) <> ''
          and w.web_mpn % v_raw
        )
      )
      and greatest(
        similarity(a.name, v_raw),
        similarity(a.sku, v_raw),
        similarity(coalesce(w.web_mpn, ''), v_raw)
      ) >= 0.35
    order by sim desc, a.name asc
    limit v_fetch
  ),
  qtys as (
    select oh.accessory_id, oh.on_hand
    from public.accessories_on_hand(
      p_tenant_id,
      p_warehouse_id,
      coalesce((select array_agg(f.aid) from fuzzy f), '{}'::uuid[])
    ) oh
  )
  select
    f.aid, f.aname, f.asku, f.abarcode, f.abarcode_internal,
    f.aprice_net::numeric,
    coalesce(t.rate_percent, 0)::numeric,
    coalesce(u.shortform, 'db')::text,
    f.aimage_url,
    coalesce(q.on_hand, 0)::numeric,
    f.awmpn,
    (100 + f.sim * 80)::numeric
  from fuzzy f
  left join qtys q on q.accessory_id = f.aid
  left join public.tax_rates t on t.id = f.tax_rate_id
  left join public.units u on u.id = f.unit_id
  order by
    (100 + f.sim * 80) desc,
    case when p_stock_first then (case when coalesce(q.on_hand, 0) > 0 then 0 else 1 end) else 0 end,
    f.aname asc
  limit v_limit;
end;
$$;

comment on function public.search_pos_products is
  'POS typeahead: GIN ILIKE gather → token rank → batch on_hand; typo via indexed %.';

revoke all on function public.search_pos_products(uuid, uuid, text, int, boolean) from public;
grant execute on function public.search_pos_products(uuid, uuid, text, int, boolean) to authenticated;
grant execute on function public.search_pos_products(uuid, uuid, text, int, boolean) to service_role;
