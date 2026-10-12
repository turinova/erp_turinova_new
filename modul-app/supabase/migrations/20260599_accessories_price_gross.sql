-- Polcár (bruttó) tárolása: ÁFA round-trip miatt nettóból nem mindig állítható vissza
-- (pl. 4000 Ft @ 27% → nincs olyan egész nettó, amire round(net×1.27)=4000).

alter table public.accessories
  add column if not exists price_gross numeric(12, 0);

comment on column public.accessories.price_gross is
  'Polcár / ügyfél-facing bruttó Ft. Forrásigazság a megjelenítéshez; price_net az ÁFA bázis.';

-- Backfill: meglévő nettóból számolt bruttó (eddigi UI viselkedés)
update public.accessories a
set price_gross = round(a.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))
from public.tax_rates t
where t.id = a.tax_rate_id
  and a.price_gross is null;

update public.accessories
set price_gross = price_net
where price_gross is null;

alter table public.accessories
  alter column price_gross set not null;

alter table public.accessories
  drop constraint if exists accessories_price_gross_nonneg;

alter table public.accessories
  add constraint accessories_price_gross_nonneg check (price_gross >= 0);

-- search_accessories_page: tárolt polcár (return type változatlan)
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
      coalesce(a.price_gross, round(a.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)))::numeric,
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
    coalesce(a.price_gross, round(a.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)))::numeric,
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

-- search_pos_products: return type bővül → DROP + CREATE
drop function if exists public.search_pos_products(uuid, uuid, text, int, boolean);

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
  price_gross numeric,
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
  v_compact text;
  v_toks text[];
  v_limit int := greatest(1, least(coalesce(p_limit, 15), 30));
  v_fetch int;
  v_q_len int;
  v_hit_count int := 0;
  v_tok_count int;
  v_pat text;
  v_pat1 text;
  v_prefix text;
  v_prefix_len int;
  v_barcode_only boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_tenant_member(p_tenant_id) then
    raise exception 'not authorized for tenant catalog'
      using errcode = '42501';
  end if;

  if v_raw = '' or p_warehouse_id is null then
    return;
  end if;

  select coalesce(s.search_barcode_only, false)
    into v_barcode_only
  from public.tenant_pos_settings s
  where s.tenant_id = p_tenant_id;
  v_barcode_only := coalesce(v_barcode_only, false);

  v_norm := regexp_replace(lower(unaccent(v_raw)), '[%_\\]', '', 'g');
  v_norm := regexp_replace(v_norm, '(\d),(\d)', '\1.\2', 'g');
  v_norm := regexp_replace(v_norm, '(\d)([a-z])', '\1 \2', 'g');
  v_norm := regexp_replace(v_norm, '[^a-z0-9.]+', ' ', 'g');
  v_norm := trim(both from v_norm);
  v_compact := public.pos_search_compact(v_norm);
  v_q_len := char_length(v_compact);

  if v_norm = '' or v_compact = '' then
    return;
  end if;

  v_toks := array_remove(regexp_split_to_array(v_norm, '\s+'), '');
  if v_toks is null or cardinality(v_toks) = 0 then
    return;
  end if;
  v_tok_count := cardinality(v_toks);
  v_fetch := least(v_limit * 3, 60);

  v_pat := '%' || replace(v_norm, ' ', '%') || '%';
  v_pat1 := '%' || v_toks[1] || '%';
  -- Long compound (egybeírás): short prefix still hits spaced names ("korpusz…")
  v_prefix_len := case
    when v_q_len >= 10 then 7
    when v_q_len >= 8 then 6
    when v_q_len >= 5 then 5
    else v_q_len
  end;
  v_prefix := left(v_compact, v_prefix_len);

  -- Pass 1: ILIKE / prefix / trgm gather → token-ALL OR compact contains → rank
  return query
  with ids as (
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
      and a.name ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
      and a.sku ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
      and a.barcode is not null
      and a.barcode ilike v_pat1
    union
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
      and a.barcode_internal is not null
      and a.barcode_internal ilike v_pat1
    union
    -- Compound prefix gather (korpuszösszehúzó → %korpusz%)
    select a.id
    from public.accessories a
    where v_tok_count = 1
      and v_q_len >= 5
      and char_length(v_prefix) >= 5
      and a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
      and a.name ilike ('%' || v_prefix || '%')
    union
    select a.id
    from public.accessories a
    where v_q_len >= 4
      and a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
      and a.name % v_raw
    union
    select w.accessory_id
    from public.accessory_web w
    where w.tenant_id = p_tenant_id
      and (
        w.web_mpn ilike v_pat1
        or w.web_brand ilike v_pat1
        or (v_tok_count = 1 and v_q_len >= 5 and w.web_mpn ilike ('%' || v_prefix || '%'))
        or exists (
          select 1
          from unnest(coalesce(w.web_search_aliases, '{}'::text[])) al
          where al ilike v_pat1
             or (v_tok_count = 1 and v_q_len >= 5 and al ilike ('%' || v_prefix || '%'))
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
     and (
       not v_barcode_only
       or nullif(btrim(coalesce(a.barcode, '')), '') is not null
       or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
     )
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
      a.price_gross as aprice_gross,
      a.image_url as aimage_url,
      a.tax_rate_id,
      a.unit_id,
      nullif(btrim(w.web_mpn), '') as awmpn,
      lower(unaccent(concat_ws(' ',
        a.name, a.sku, a.barcode, a.barcode_internal,
        w.web_mpn, w.web_brand, m.name,
        array_to_string(w.web_search_aliases, ' ')
      ))) as doc,
      public.pos_search_compact(lower(unaccent(concat_ws(' ',
        a.name, a.sku, a.barcode, a.barcode_internal,
        w.web_mpn, w.web_brand, m.name,
        array_to_string(w.web_search_aliases, ' ')
      )))) as doc_c,
      lower(unaccent(a.name)) as name_n,
      public.pos_search_compact(lower(unaccent(a.name))) as name_c,
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
      and (
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
  ),
  token_hits as (
    select c.*
    from cand c
    where
      -- Spaced: every token appears in doc
      not exists (
        select 1 from unnest(v_toks) t where position(t in c.doc) = 0
      )
      -- OR compact: compound query inside compact doc (korpuszösszehúzó ⊂ korpuszossszehuzo…)
      or position(v_compact in c.doc_c) > 0
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
            or th.name_c = v_compact
            then 1000
          when th.name_n = v_norm then 900
          when position(v_compact in th.name_c) > 0 and v_q_len >= 5 then 850
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
          else 200 + least(50, coalesce(similarity(th.name_c, v_compact), 0) * 50)
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
    coalesce(s.aprice_gross, round(s.aprice_net * (1 + coalesce(t.rate_percent, 0) / 100.0)))::numeric,
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

  -- Pass 2: softer — ANY token OR compact contains; also single-token compounds
  return query
  with ids as (
    select a.id
    from public.accessories a
    where a.tenant_id = p_tenant_id
      and a.active = true
      and a.deleted_at is null
      and coalesce(a.sellable_pos, true) = true
      and (
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
      and (
        a.name ilike v_pat1
        or a.sku ilike v_pat1
        or (a.barcode is not null and a.barcode ilike v_pat1)
        or (a.barcode_internal is not null and a.barcode_internal ilike v_pat1)
        or (v_q_len >= 5 and a.name ilike ('%' || v_prefix || '%'))
        or (v_q_len >= 4 and a.name % v_raw)
      )
    union
    select w.accessory_id
    from public.accessory_web w
    where w.tenant_id = p_tenant_id
      and (
        w.web_mpn ilike v_pat1
        or w.web_brand ilike v_pat1
        or (v_q_len >= 5 and w.web_mpn ilike ('%' || v_prefix || '%'))
        or exists (
          select 1
          from unnest(coalesce(w.web_search_aliases, '{}'::text[])) al
          where al ilike v_pat1
             or (v_q_len >= 5 and al ilike ('%' || v_prefix || '%'))
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
     and (
       not v_barcode_only
       or nullif(btrim(coalesce(a.barcode, '')), '') is not null
       or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
     )
    where m.tenant_id = p_tenant_id
      and m.deleted_at is null
      and m.name ilike v_pat1
  ),
  docs as (
    select
      a.id as aid,
      a.name as aname,
      a.sku as asku,
      a.barcode as abarcode,
      a.barcode_internal as abarcode_internal,
      a.price_net as aprice_net,
      a.price_gross as aprice_gross,
      a.image_url as aimage_url,
      a.tax_rate_id,
      a.unit_id,
      nullif(btrim(w.web_mpn), '') as awmpn,
      lower(unaccent(concat_ws(' ',
        a.name, a.sku, a.barcode, a.barcode_internal,
        w.web_mpn, w.web_brand, m.name,
        array_to_string(w.web_search_aliases, ' ')
      ))) as doc,
      public.pos_search_compact(lower(unaccent(concat_ws(' ',
        a.name, a.sku, a.barcode, a.barcode_internal,
        w.web_mpn, w.web_brand, m.name,
        array_to_string(w.web_search_aliases, ' ')
      )))) as doc_c,
      lower(unaccent(a.name)) as name_n,
      public.pos_search_compact(lower(unaccent(a.name))) as name_c
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
      and (
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
  ),
  scored as (
    select
      d.*,
      (
        select count(*)::numeric
        from unnest(v_toks) tok
        where position(tok in d.doc) > 0
      ) as tok_hits,
      case when position(v_compact in d.doc_c) > 0 then 1 else 0 end as compact_hit
    from docs d
  ),
  limited as (
    select
      s.*,
      (
        150
        + s.tok_hits * 40
        + s.compact_hit * 80
        + least(40, coalesce(similarity(s.name_c, v_compact), 0) * 40)
      )::numeric as score
    from scored s
    where s.tok_hits > 0 or s.compact_hit = 1
    order by s.tok_hits desc, s.compact_hit desc, s.aname asc
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
    coalesce(s.aprice_gross, round(s.aprice_net * (1 + coalesce(t.rate_percent, 0) / 100.0)))::numeric,
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

  -- Pass 3: typo / fuzzy on compact + raw
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
      a.price_gross as aprice_gross,
      a.image_url as aimage_url,
      a.tax_rate_id,
      a.unit_id,
      nullif(btrim(w.web_mpn), '') as awmpn,
      greatest(
        similarity(a.name, v_raw),
        similarity(public.pos_search_compact(lower(unaccent(a.name))), v_compact),
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
        not v_barcode_only
        or nullif(btrim(coalesce(a.barcode, '')), '') is not null
        or nullif(btrim(coalesce(a.barcode_internal, '')), '') is not null
      )
      and (
        a.name % v_raw
        or a.sku % v_raw
        or public.pos_search_compact(lower(unaccent(a.name))) % v_compact
        or (
          w.web_mpn is not null
          and btrim(w.web_mpn) <> ''
          and w.web_mpn % v_raw
        )
      )
      and greatest(
        similarity(a.name, v_raw),
        similarity(public.pos_search_compact(lower(unaccent(a.name))), v_compact),
        similarity(a.sku, v_raw),
        similarity(coalesce(w.web_mpn, ''), v_raw)
      ) >= 0.28
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
    coalesce(f.aprice_gross, round(f.aprice_net * (1 + coalesce(t.rate_percent, 0) / 100.0)))::numeric,
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
  'POS typeahead: compact match; optional search_barcode_only from tenant_pos_settings.';

revoke all on function public.search_pos_products(uuid, uuid, text, int, boolean) from public;
grant execute on function public.search_pos_products(uuid, uuid, text, int, boolean) to authenticated;
grant execute on function public.search_pos_products(uuid, uuid, text, int, boolean) to service_role;

-- pos_frequent_products
drop function if exists public.pos_frequent_products(uuid, uuid, int, int);

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
  price_gross numeric,
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
    coalesce(a.price_gross, round(a.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)))::numeric,
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

-- lookup_pos_barcode
drop function if exists public.lookup_pos_barcode(uuid, text, uuid);

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
