-- Polcár megjelenítés: kereső + storefront a tárolt accessories.price_gross-t használja
-- (ne mindig round(net×ÁFA) — off-by-1 polcár esetén eltérés, pl. 2579 vs 2580).

-- ---------------------------------------------------------------------------
-- storefront_products: price_gross oszlop (20260599 után)
-- ---------------------------------------------------------------------------
drop view if exists public.storefront_products;

create view public.storefront_products
with (security_invoker = true)
as
select
  a.id,
  a.tenant_id,
  a.name,
  a.sku,
  a.barcode,
  a.image_url,
  a.web_gallery,
  a.price_net,
  a.price_gross,
  a.active,
  a.deleted_at,
  a.created_at,
  greatest(a.updated_at, w.updated_at) as updated_at,
  a.manufacturer_id,
  a.tax_rate_id,
  w.sellable_web,
  w.web_category_id,
  w.web_slug,
  w.web_title,
  w.web_description_short,
  w.web_description_long,
  w.web_brand,
  w.web_gtin,
  w.web_mpn,
  w.web_product_type,
  w.web_google_category,
  w.web_tags,
  w.web_search_aliases,
  w.web_color,
  w.web_size,
  w.web_material,
  w.web_attributes,
  w.web_specs,
  w.web_faq,
  w.web_use_cases,
  w.web_compatibility,
  w.web_compare_at_price,
  w.shipping_weight_kg,
  w.shipping_length_cm,
  w.shipping_width_cm,
  w.shipping_height_cm,
  w.product_weight_kg,
  w.product_length_cm,
  w.product_width_cm,
  w.product_height_cm,
  w.web_group_id,
  w.web_box_contents,
  w.web_dimension_image_url,
  w.web_safety_info,
  w.web_identifier_exists,
  w.web_image_alts,
  w.web_price_tiers,
  w.web_net_quantity,
  w.web_net_unit,
  w.web_ingredients,
  w.web_usage,
  w.web_video_url,
  w.web_country_of_origin,
  w.web_multipack,
  w.web_is_bundle
from public.accessories a
join public.accessory_web w on w.accessory_id = a.id;

comment on view public.storefront_products is
  'Olvasó nézet: alap termék + webshop adat. Írni az accessories / accessory_web táblát kell.';

grant select on public.storefront_products to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- search_materials_catalog: accessory price_gross_piece ← coalesce(price_gross, …)
-- ---------------------------------------------------------------------------
create or replace function public.search_materials_catalog(
  p_tenant_id uuid,
  p_q text,
  p_kinds text[] default array['sheet', 'linear', 'accessory'],
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  kind text,
  id uuid,
  name text,
  manufacturer_name text,
  type_label text,
  sku text,
  length_mm integer,
  width_mm integer,
  thickness_mm numeric,
  on_stock boolean,
  price_gross_per_m numeric,
  price_gross_sqm numeric,
  price_gross_piece numeric,
  unit_shortform text,
  total_count bigint
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
  v_pattern text;
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 50));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_kinds text[] := coalesce(p_kinds, array['sheet', 'linear', 'accessory']);
  v_can boolean;
begin
  if v_q = '' or length(v_q) < 1 then
    return;
  end if;

  -- DEFINER: RLS ne fusson 30k+ soron; AuthZ egy check az elején.
  v_can := public.is_tenant_member(p_tenant_id)
    or public.partner_can_read_tenant_catalog(p_tenant_id);
  if not v_can then
    raise exception 'not authorized for tenant catalog'
      using errcode = '42501';
  end if;

  -- %/_ strip → GIN trgm használható (ESCAPE nélkül)
  v_q := regexp_replace(v_q, '[%_\\]', '', 'g');
  if v_q = '' then
    return;
  end if;
  v_pattern := '%' || v_q || '%';

  return query
  with mfr as (
    select m.id as manufacturer_id
    from public.manufacturers m
    where m.tenant_id = p_tenant_id
      and m.deleted_at is null
      and m.name ilike v_pattern
    limit 50
  ),
  sheet_ids as materialized (
    select s.id
    from public.sheet_materials s
    where 'sheet' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.name ilike v_pattern
    union
    select s.id
    from public.sheet_materials s
    where 'sheet' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.machine_code is not null
      and s.machine_code ilike v_pattern
    union
    select s.id
    from public.sheet_materials s
    where 'sheet' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.manufacturer_id in (select manufacturer_id from mfr)
  ),
  sheet_rows as (
    select
      'sheet'::text as kind,
      s.id,
      s.name,
      coalesce(m.name, '—')::text as manufacturer_name,
      'Bútorlap'::text as type_label,
      null::text as sku,
      s.length_mm,
      s.width_mm,
      s.thickness_mm,
      s.on_stock,
      null::numeric as price_gross_per_m,
      round(s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))::numeric as price_gross_sqm,
      round(
        s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)
        * (s.length_mm::numeric / 1000.0) * (s.width_mm::numeric / 1000.0)
      )::numeric as price_gross_piece,
      null::text as unit_shortform
    from sheet_ids sid
    join public.sheet_materials s on s.id = sid.id
    left join public.manufacturers m on m.id = s.manufacturer_id
    left join public.tax_rates t on t.id = s.tax_rate_id
    order by s.name asc
    limit 40
  ),
  linear_ids as materialized (
    select s.id
    from public.linear_materials s
    where 'linear' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.name ilike v_pattern
    union
    select s.id
    from public.linear_materials s
    where 'linear' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.manufacturer_id in (select manufacturer_id from mfr)
  ),
  linear_rows as (
    select
      'linear'::text as kind,
      s.id,
      s.name,
      coalesce(m.name, '—')::text as manufacturer_name,
      case s.material_type
        when 'hatfal' then 'Hátfal'
        when 'munkalap' then 'Munkalap'
        when 'asztalap' then 'Asztalap'
        else s.material_type
      end::text as type_label,
      null::text as sku,
      s.length_mm,
      s.width_mm,
      s.thickness_mm,
      s.on_stock,
      round(s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))::numeric as price_gross_per_m,
      null::numeric as price_gross_sqm,
      round(
        s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)
        * (s.length_mm::numeric / 1000.0)
      )::numeric as price_gross_piece,
      null::text as unit_shortform
    from linear_ids lid
    join public.linear_materials s on s.id = lid.id
    left join public.manufacturers m on m.id = s.manufacturer_id
    left join public.tax_rates t on t.id = s.tax_rate_id
    order by s.name asc
    limit 40
  ),
  accessory_ids as materialized (
    select s.id
    from public.accessories s
    where 'accessory' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.name ilike v_pattern
    union
    select s.id
    from public.accessories s
    where 'accessory' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.sku ilike v_pattern
    union
    select s.id
    from public.accessories s
    where 'accessory' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.barcode is not null
      and s.barcode ilike v_pattern
    union
    select s.id
    from public.accessories s
    where 'accessory' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.barcode_internal is not null
      and s.barcode_internal ilike v_pattern
    union
    select s.id
    from public.accessories s
    where 'accessory' = any (v_kinds)
      and s.tenant_id = p_tenant_id
      and s.active = true
      and s.deleted_at is null
      and s.manufacturer_id in (select manufacturer_id from mfr)
  ),
  accessory_rows as (
    select
      'accessory'::text as kind,
      s.id,
      s.name,
      coalesce(m.name, '—')::text as manufacturer_name,
      'Termék'::text as type_label,
      s.sku::text as sku,
      null::integer as length_mm,
      null::integer as width_mm,
      null::numeric as thickness_mm,
      null::boolean as on_stock,
      null::numeric as price_gross_per_m,
      null::numeric as price_gross_sqm,
      coalesce(
        s.price_gross,
        round(s.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))
      )::numeric as price_gross_piece,
      coalesce(u.shortform, 'db')::text as unit_shortform
    from accessory_ids aid
    join public.accessories s on s.id = aid.id
    left join public.manufacturers m on m.id = s.manufacturer_id
    left join public.tax_rates t on t.id = s.tax_rate_id
    left join public.units u on u.id = s.unit_id
    order by s.name asc
    limit 40
  ),
  combined as (
    select * from sheet_rows
    union all
    select * from linear_rows
    union all
    select * from accessory_rows
  ),
  numbered as (
    select
      c.*,
      count(*) over () as total_count,
      row_number() over (order by lower(c.name), lower(c.manufacturer_name), c.kind, c.id) as rn
    from combined c
  )
  select
    n.kind,
    n.id,
    n.name,
    n.manufacturer_name,
    n.type_label,
    n.sku,
    n.length_mm,
    n.width_mm,
    n.thickness_mm,
    n.on_stock,
    n.price_gross_per_m,
    n.price_gross_sqm,
    n.price_gross_piece,
    n.unit_shortform,
    n.total_count
  from numbered n
  where n.rn > v_offset
    and n.rn <= v_offset + v_limit
  order by n.rn;
end;
$$;

revoke all on function public.search_materials_catalog(uuid, text, text[], int, int) from public;
grant execute on function public.search_materials_catalog(uuid, text, text[], int, int) to authenticated;
grant execute on function public.search_materials_catalog(uuid, text, text[], int, int) to service_role;

comment on function public.search_materials_catalog is
  'Unified anyagkereső — SECURITY DEFINER + GIN-barát ILIKE; termék polcár = coalesce(price_gross, round(net×ÁFA)).';

-- ---------------------------------------------------------------------------
-- storefront_category_covers: min_price_gross ← tárolt polcár
-- ---------------------------------------------------------------------------
create or replace function public.storefront_category_covers(p_tenant uuid, p_days integer default 180)
returns table (
  web_category_id uuid,
  accessory_id uuid,
  image_url text,
  title text,
  manual boolean,
  in_stock boolean,
  is_part boolean,
  group_orders bigint,
  group_size integer,
  min_price_gross numeric,
  group_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with pub as (
    select
      a.id,
      w.web_category_id,
      nullif(trim(a.image_url), '') as image_url,
      coalesce(nullif(trim(w.web_title), ''), a.name) as title,
      lower(coalesce(nullif(trim(w.web_group_id), ''), a.id::text)) as group_key,
      coalesce(
        a.price_gross,
        round(a.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0))
      ) as price_gross
    from public.accessories a
    join public.accessory_web w on w.accessory_id = a.id
    left join public.tax_rates t on t.id = a.tax_rate_id
    where a.tenant_id = p_tenant
      and w.tenant_id = p_tenant
      and w.sellable_web
      and w.web_slug is not null
      and w.web_category_id is not null
      and a.active
      and a.deleted_at is null
  ),
  ord as (
    select i.accessory_id, count(distinct i.sales_order_id) as orders
    from public.sales_order_items i
    join public.sales_orders o on o.id = i.sales_order_id
    where i.tenant_id = p_tenant
      and o.tenant_id = p_tenant
      and i.item_kind = 'product'
      and i.deleted_at is null
      and o.deleted_at is null
      and o.status in ('confirmed', 'fulfilled', 'partially_returned')
      and o.created_at >= now() - make_interval(days => greatest(1, least(p_days, 730)))
    group by i.accessory_id
  ),
  stk as (
    select m.accessory_id,
      sum(case when m.movement_type = 'in' then m.quantity else -m.quantity end) as qty
    from public.stock_movements m
    where m.tenant_id = p_tenant
      and m.accessory_id in (select id from pub where image_url is not null)
    group by m.accessory_id
  ),
  parts as (
    select distinct r.related_id as id
    from public.accessory_related r
    where r.tenant_id = p_tenant
      and r.kind in ('accessory', 'required')
  ),
  scored as (
    select
      p.*,
      coalesce(o.orders, 0) as orders,
      coalesce(s.qty, 0) > 0 as in_stock,
      (pt.id is not null) as is_part,
      sum(coalesce(o.orders, 0)) over (partition by p.web_category_id, p.group_key) as g_orders,
      count(*) over (partition by p.web_category_id, p.group_key) as g_size,
      coalesce(g.main_accessory_id = p.id, false) as is_main
    from pub p
    left join ord o on o.accessory_id = p.id
    left join stk s on s.accessory_id = p.id
    left join parts pt on pt.id = p.id
    left join public.web_variant_groups g
      on g.tenant_id = p_tenant and lower(g.code) = p.group_key
    where p.image_url is not null
  ),
  auto as (
    select distinct on (sc.web_category_id) sc.*
    from scored sc
    order by
      sc.web_category_id,
      sc.in_stock desc,
      sc.is_part asc,
      sc.g_orders desc,
      sc.g_size desc,
      sc.is_main desc,
      sc.orders desc,
      sc.price_gross asc,
      sc.id
  ),
  manual as (
    select c.id as web_category_id, p.id, p.image_url, p.title
    from public.web_categories c
    join pub p on p.id = c.cover_accessory_id
    where c.tenant_id = p_tenant
      and c.deleted_at is null
      and p.image_url is not null
  ),
  prices as (
    select
      p.web_category_id,
      coalesce(min(p.price_gross) filter (where pt.id is null), min(p.price_gross)) as min_price,
      count(distinct p.group_key) as group_count
    from pub p
    left join parts pt on pt.id = p.id
    group by p.web_category_id
  ),
  cats as (
    select web_category_id from prices
    union
    select web_category_id from manual
  )
  select
    c.web_category_id,
    coalesce(m.id, a.id),
    coalesce(m.image_url, a.image_url),
    coalesce(m.title, a.title),
    (m.id is not null),
    coalesce(a.in_stock, false),
    coalesce(a.is_part, false),
    coalesce(a.g_orders, 0)::bigint,
    coalesce(a.g_size, 0)::integer,
    pr.min_price,
    coalesce(pr.group_count, 0)::bigint
  from cats c
  left join manual m on m.web_category_id = c.web_category_id
  left join auto a on a.web_category_id = c.web_category_id
  left join prices pr on pr.web_category_id = c.web_category_id;
$$;

revoke all on function public.storefront_category_covers(uuid, integer) from public;
grant execute on function public.storefront_category_covers(uuid, integer) to service_role;
