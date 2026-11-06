-- Bolt katalógus lista/kereső — accessory_web tagok, nem teljes ERP.
-- Mintázat: search_accessories_page (token-AND + statement_timeout).

create or replace function public.search_shop_catalog_page(
  p_tenant_id uuid,
  p_q text default '',
  p_filter text default 'live',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  name text,
  sku text,
  barcode text,
  image_url text,
  price_net numeric,
  price_gross numeric,
  active boolean,
  manufacturer_name text,
  sellable_web boolean,
  web_slug text,
  web_title text,
  web_description_short text,
  web_description_long text,
  web_brand text,
  web_gtin text,
  web_mpn text,
  web_product_type text,
  web_google_category text,
  web_category_id uuid,
  category_name text,
  web_identifier_exists boolean,
  shipping_weight_kg numeric,
  web_color text,
  web_size text,
  web_material text,
  web_search_aliases text[],
  web_use_cases text[],
  web_gallery text[],
  agent_top boolean,
  total_count bigint,
  count_live bigint,
  count_draft bigint,
  count_incomplete bigint,
  count_agent_ok bigint,
  count_all bigint
)
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
#variable_conflict use_column
declare
  v_q text := trim(both from coalesce(p_q, ''));
  v_filter text := lower(trim(both from coalesce(p_filter, 'live')));
  v_pat1 text;
  v_toks text[];
  v_tok_count int;
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'not authorized for tenant catalog'
      using errcode = '42501';
  end if;

  if v_filter in ('in_shop') then
    v_filter := 'live';
  elsif v_filter in ('not_in_shop') then
    v_filter := 'draft';
  elsif v_filter not in ('live', 'draft', 'all', 'incomplete', 'agent_ok', 'no_category', 'no_description', 'no_image') then
    v_filter := 'live';
  end if;

  if v_q <> '' then
    v_q := regexp_replace(v_q, '[%_\\]', '', 'g');
    v_q := trim(both from regexp_replace(v_q, '\s+', ' ', 'g'));
  end if;

  if v_q <> '' then
    v_toks := array_remove(regexp_split_to_array(lower(v_q), '\s+'), '');
    if v_toks is null or cardinality(v_toks) = 0 then
      return;
    end if;
    v_tok_count := cardinality(v_toks);
    v_pat1 := '%' || v_toks[1] || '%';
  else
    v_tok_count := 0;
    v_pat1 := null;
  end if;

  return query
  with base as materialized (
    select
      a.id,
      a.name,
      a.sku,
      a.barcode,
      a.image_url,
      a.price_net,
      round(a.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))::numeric as price_gross,
      a.active,
      coalesce(m.name, '')::text as manufacturer_name,
      w.sellable_web,
      w.web_slug,
      w.web_title,
      w.web_description_short,
      w.web_description_long,
      w.web_brand,
      w.web_gtin,
      w.web_mpn,
      w.web_product_type,
      w.web_google_category,
      w.web_category_id,
      c.name::text as category_name,
      coalesce(w.web_identifier_exists, true) as web_identifier_exists,
      w.shipping_weight_kg,
      w.web_color,
      w.web_size,
      w.web_material,
      coalesce(w.web_search_aliases, '{}'::text[]) as web_search_aliases,
      coalesce(w.web_use_cases, '{}'::text[]) as web_use_cases,
      -- accessories.web_gallery = jsonb; RPC text[]-ként adja vissza
      coalesce(
        (
          select array_agg(elem)
          from jsonb_array_elements_text(coalesce(a.web_gallery, '[]'::jsonb)) as t(elem)
        ),
        '{}'::text[]
      ) as web_gallery,
      (
        w.sellable_web
        and nullif(trim(coalesce(w.web_slug, '')), '') is not null
        and nullif(trim(coalesce(w.web_title, a.name, '')), '') is not null
        and nullif(trim(coalesce(a.image_url, '')), '') is not null
        and a.price_net > 0
        and a.active
        and greatest(
          length(trim(coalesce(w.web_description_long, ''))),
          length(trim(coalesce(w.web_description_short, '')))
        ) >= 80
        and nullif(trim(coalesce(w.web_brand, m.name, '')), '') is not null
      ) as agent_top
    from public.accessory_web w
    join public.accessories a
      on a.id = w.accessory_id
     and a.tenant_id = w.tenant_id
     and a.deleted_at is null
    left join public.manufacturers m
      on m.id = a.manufacturer_id and m.deleted_at is null
    left join public.tax_rates t on t.id = a.tax_rate_id
    left join public.web_categories c
      on c.id = w.web_category_id and c.deleted_at is null
    where w.tenant_id = p_tenant_id
  ),
  matched as materialized (
    select b.*
    from base b
    where
      case
        when v_tok_count = 0 then true
        when v_tok_count = 1 then (
          b.name ilike v_pat1
          or b.sku ilike v_pat1
          or (b.barcode is not null and b.barcode ilike v_pat1)
          or b.manufacturer_name ilike v_pat1
        )
        else not exists (
          select 1
          from unnest(v_toks) tok
          where position(
            tok
            in lower(concat_ws(
              ' ',
              b.name,
              b.sku,
              coalesce(b.barcode, ''),
              b.manufacturer_name
            ))
          ) = 0
        )
      end
  ),
  filtered as materialized (
    select m.*
    from matched m
    where
      case v_filter
        when 'live' then m.sellable_web
        when 'draft' then not m.sellable_web
        when 'incomplete' then m.sellable_web and not m.agent_top
        when 'agent_ok' then m.sellable_web and m.agent_top
        when 'no_category' then coalesce(nullif(trim(m.web_product_type), ''), nullif(m.web_category_id::text, '')) is null
        when 'no_description' then length(trim(coalesce(m.web_description_long, ''))) = 0
        when 'no_image' then nullif(trim(coalesce(m.image_url, '')), '') is null
        else true -- all
      end
  ),
  counts as (
    select
      count(*) filter (where m.sellable_web)::bigint as count_live,
      count(*) filter (where not m.sellable_web)::bigint as count_draft,
      count(*) filter (where m.sellable_web and not m.agent_top)::bigint as count_incomplete,
      count(*) filter (where m.sellable_web and m.agent_top)::bigint as count_agent_ok,
      count(*)::bigint as count_all
    from matched m
  ),
  total as (
    select count(*)::bigint as c from filtered
  ),
  page_rows as (
    select f.*
    from filtered f
    order by f.name asc, f.id asc
    limit v_limit
    offset v_offset
  )
  select
    p.id,
    p.name,
    p.sku,
    p.barcode,
    p.image_url,
    p.price_net::numeric,
    p.price_gross,
    p.active,
    nullif(p.manufacturer_name, '')::text,
    p.sellable_web,
    p.web_slug,
    p.web_title,
    p.web_description_short,
    p.web_description_long,
    p.web_brand,
    p.web_gtin,
    p.web_mpn,
    p.web_product_type,
    p.web_google_category,
    p.web_category_id,
    p.category_name,
    p.web_identifier_exists,
    p.shipping_weight_kg,
    p.web_color,
    p.web_size,
    p.web_material,
    p.web_search_aliases,
    p.web_use_cases,
    p.web_gallery,
    p.agent_top,
    total.c,
    counts.count_live,
    counts.count_draft,
    counts.count_incomplete,
    counts.count_agent_ok,
    counts.count_all
  from page_rows p
  cross join total
  cross join counts
  union all
  -- Üres találatnál is kell a chip count (1 sentinel sor, id null).
  select
    null::uuid,
    null::text,
    null::text,
    null::text,
    null::text,
    null::numeric,
    null::numeric,
    null::boolean,
    null::text,
    null::boolean,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::uuid,
    null::text,
    null::boolean,
    null::numeric,
    null::text,
    null::text,
    null::text,
    null::text[],
    null::text[],
    null::text[],
    null::boolean,
    total.c,
    counts.count_live,
    counts.count_draft,
    counts.count_incomplete,
    counts.count_agent_ok,
    counts.count_all
  from total
  cross join counts
  where not exists (select 1 from page_rows);
end;
$$;

revoke all on function public.search_shop_catalog_page(uuid, text, text, int, int) from public;
grant execute on function public.search_shop_catalog_page(uuid, text, text, int, int) to authenticated;
grant execute on function public.search_shop_catalog_page(uuid, text, text, int, int) to service_role;

comment on function public.search_shop_catalog_page is
  'Bolt katalógus: accessory_web tagok, Live/Készül/Agent szűrő, token kereső. Max 8s.';
