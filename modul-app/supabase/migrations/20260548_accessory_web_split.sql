-- Webshop modul adatainak leválasztása az alap termékről (doc 39 §4, doc 40 §3g).
-- Expand lépés: az accessories.web_* oszlopok megmaradnak (visszaút), de az app
-- ettől kezdve csak az accessory_web táblát írja/olvassa. Takarítás: külön migráció.
--
-- 1) accessory_web: 1:1 a termékkel, csak webshop-adat (a galéria alap adat, marad)
-- 2) adatmásolás a meglévő termékekből
-- 3) storefront_products nézet: alap + web mezők, a régi oszlopnevekkel
-- 4) kereső és „gyakran együtt” RPC az új táblára
-- 5) soft delete → web slug felszabadul, bolt kikapcsol

-- ---------------------------------------------------------------------------
-- 1) Tábla
-- ---------------------------------------------------------------------------
create table if not exists public.accessory_web (
  accessory_id uuid primary key references public.accessories (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sellable_web boolean not null default false,
  web_category_id uuid references public.web_categories (id) on delete set null,
  web_slug text,
  web_title text,
  web_description_short text,
  web_description_long text,
  web_brand text,
  web_gtin text,
  web_mpn text,
  web_product_type text,
  web_google_category text,
  web_tags text[] not null default '{}',
  web_search_aliases text[] not null default '{}',
  web_color text,
  web_size text,
  web_material text,
  web_attributes jsonb not null default '{}'::jsonb,
  web_specs jsonb not null default '{}'::jsonb,
  web_faq jsonb not null default '[]'::jsonb,
  web_use_cases text[] not null default '{}',
  web_compatibility text[] not null default '{}',
  web_compare_at_price integer,
  shipping_weight_kg numeric(12, 3),
  shipping_length_cm numeric(12, 2),
  shipping_width_cm numeric(12, 2),
  shipping_height_cm numeric(12, 2),
  product_weight_kg numeric(12, 3),
  product_length_cm numeric(12, 2),
  product_width_cm numeric(12, 2),
  product_height_cm numeric(12, 2),
  web_group_id text,
  web_box_contents text[] not null default '{}',
  web_dimension_image_url text,
  web_safety_info text,
  web_identifier_exists boolean not null default true,
  web_image_alts jsonb not null default '{}'::jsonb,
  web_price_tiers jsonb not null default '[]'::jsonb,
  web_net_quantity numeric(12, 3),
  web_net_unit text,
  web_ingredients text,
  web_usage text,
  web_video_url text,
  web_country_of_origin text,
  web_multipack integer,
  web_is_bundle boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accessory_web_compare_at_price_nonneg
    check (web_compare_at_price is null or web_compare_at_price >= 0),
  constraint accessory_web_slug_format
    check (web_slug is null or web_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint accessory_web_net_content_chk check (
    (web_net_quantity is null or web_net_quantity > 0)
    and (web_net_unit is null or web_net_unit in ('g', 'kg', 'ml', 'l', 'db', 'm', 'm2'))
    and ((web_net_quantity is null) = (web_net_unit is null))
  ),
  constraint accessory_web_safety_info_len_chk
    check (web_safety_info is null or char_length(web_safety_info) <= 2000),
  constraint accessory_web_country_of_origin_chk
    check (web_country_of_origin is null or web_country_of_origin ~ '^[A-Z]{2}$'),
  constraint accessory_web_multipack_chk
    check (web_multipack is null or web_multipack between 2 and 10000),
  constraint accessory_web_video_url_chk check (
    web_video_url is null
    or web_video_url ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/'
  )
);

create unique index if not exists accessory_web_tenant_slug_uidx
  on public.accessory_web (tenant_id, web_slug)
  where web_slug is not null;

create index if not exists accessory_web_tenant_sellable_idx
  on public.accessory_web (tenant_id)
  where sellable_web = true and web_slug is not null;

create index if not exists accessory_web_category_idx
  on public.accessory_web (tenant_id, web_category_id)
  where web_category_id is not null;

create index if not exists accessory_web_group_idx
  on public.accessory_web (tenant_id, web_group_id)
  where web_group_id is not null;

comment on table public.accessory_web is
  'Webshop modul termékadatai (1:1 accessories). Modul nélkül nincs sora; az alap termék nem olvassa.';

alter table public.accessory_web enable row level security;

drop policy if exists accessory_web_select on public.accessory_web;
drop policy if exists accessory_web_write on public.accessory_web;

create policy accessory_web_select
  on public.accessory_web for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy accessory_web_write
  on public.accessory_web for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

grant select, insert, update, delete on public.accessory_web to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Adatmásolás (csak élő termék, amin van bármilyen webshop-adat)
-- ---------------------------------------------------------------------------
insert into public.accessory_web (
  accessory_id, tenant_id, sellable_web, web_category_id, web_slug, web_title,
  web_description_short, web_description_long, web_brand, web_gtin, web_mpn,
  web_product_type, web_google_category, web_tags, web_search_aliases, web_color,
  web_size, web_material, web_attributes, web_specs, web_faq, web_use_cases,
  web_compatibility, web_compare_at_price, shipping_weight_kg, shipping_length_cm,
  shipping_width_cm, shipping_height_cm, product_weight_kg, product_length_cm,
  product_width_cm, product_height_cm, web_group_id, web_box_contents,
  web_dimension_image_url, web_safety_info, web_identifier_exists, web_image_alts,
  web_price_tiers, web_net_quantity, web_net_unit, web_ingredients, web_usage,
  web_video_url, web_country_of_origin, web_multipack, web_is_bundle, updated_at
)
select
  a.id, a.tenant_id, a.sellable_web, a.web_category_id, a.web_slug, a.web_title,
  a.web_description_short, a.web_description_long, a.web_brand, a.web_gtin, a.web_mpn,
  a.web_product_type, a.web_google_category, a.web_tags, a.web_search_aliases, a.web_color,
  a.web_size, a.web_material, a.web_attributes, a.web_specs, a.web_faq, a.web_use_cases,
  a.web_compatibility, a.web_compare_at_price, a.shipping_weight_kg, a.shipping_length_cm,
  a.shipping_width_cm, a.shipping_height_cm, a.product_weight_kg, a.product_length_cm,
  a.product_width_cm, a.product_height_cm, a.web_group_id, a.web_box_contents,
  a.web_dimension_image_url, a.web_safety_info, a.web_identifier_exists, a.web_image_alts,
  a.web_price_tiers, a.web_net_quantity, a.web_net_unit, a.web_ingredients, a.web_usage,
  a.web_video_url, a.web_country_of_origin, a.web_multipack, a.web_is_bundle, a.updated_at
from public.accessories a
where a.deleted_at is null
  and (
    a.sellable_web
    or a.web_slug is not null
    or a.web_category_id is not null
    or a.web_description_long is not null
    or a.web_title is not null
  )
on conflict (accessory_id) do nothing;

comment on column public.accessories.sellable_web is
  'ELAVULT (20260548): accessory_web.sellable_web az igazság. Takarító migráció törli.';

-- ---------------------------------------------------------------------------
-- 3) Storefront nézet — alap + web, a régi oszlopnevekkel
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
-- 4) RPC-k az új táblára
-- ---------------------------------------------------------------------------
create or replace function public.storefront_search(
  p_tenant_id uuid,
  p_q text,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (accessory_id uuid, total_count bigint)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (
    select array_remove(
      regexp_split_to_array(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(unaccent(coalesce(p_q, ''))), '(\d),(\d)', '\1.\2', 'g'),
            '(\d)([a-z])', '\1 \2', 'g'
          ),
          '[^a-z0-9.]+', ' ', 'g'
        ),
        ' '
      ),
      ''
    ) as toks
  ),
  docs as (
    select
      a.id,
      coalesce(nullif(btrim(w.web_title), ''), a.name) as title,
      lower(unaccent(concat_ws(' ',
        w.web_title, a.name, a.sku, a.barcode, w.web_gtin, w.web_mpn, w.web_brand,
        m.name, w.web_color, w.web_size, w.web_material,
        array_to_string(w.web_search_aliases, ' '),
        c.name,
        (
          select string_agg(
            public.storefront_num_text(i.value_num) || ' ' || coalesce(pa.unit, ''),
            ' '
          )
          from public.accessory_attribute_inputs i
          join public.product_attributes pa on pa.id = i.attribute_id
          where i.accessory_id = a.id and i.value_num is not null
        ),
        (
          select string_agg(av.label, ' ')
          from public.accessory_attribute_values aav
          join public.attribute_values av on av.id = aav.attribute_value_id
          where aav.accessory_id = a.id and av.deleted_at is null
        )
      ))) as doc
    from public.accessory_web w
    join public.accessories a on a.id = w.accessory_id
    left join public.manufacturers m on m.id = a.manufacturer_id
    left join public.web_categories c on c.id = w.web_category_id and c.deleted_at is null
    where w.tenant_id = p_tenant_id
      and w.sellable_web
      and w.web_slug is not null
      and a.active
      and a.deleted_at is null
  ),
  hits as (
    select d.id, d.title
    from docs d, q
    where cardinality(q.toks) > 0
      and not exists (
        select 1 from unnest(q.toks) t where position(t in d.doc) = 0
      )
  )
  select h.id, count(*) over ()
  from hits h, q
  order by
    (lower(unaccent(h.title)) like q.toks[1] || '%') desc,
    similarity(lower(unaccent(h.title)), array_to_string(q.toks, ' ')) desc,
    h.title
  limit greatest(1, least(coalesce(p_limit, 25), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.storefront_search(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.storefront_search(uuid, text, integer, integer) to service_role;

create or replace function public.storefront_bought_together(
  p_tenant_id uuid,
  p_accessory_id uuid,
  p_limit integer default 4
)
returns table (accessory_id uuid, orders_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with base_orders as (
    select distinct i.sales_order_id
    from public.sales_order_items i
    join public.sales_orders o on o.id = i.sales_order_id
    where i.tenant_id = p_tenant_id
      and i.accessory_id = p_accessory_id
      and i.deleted_at is null
      and o.deleted_at is null
      and o.status in ('confirmed', 'fulfilled')
      and o.created_at >= now() - interval '365 days'
  )
  select i.accessory_id, count(distinct i.sales_order_id) as orders_count
  from public.sales_order_items i
  join base_orders b on b.sales_order_id = i.sales_order_id
  join public.accessories a on a.id = i.accessory_id
  join public.accessory_web w on w.accessory_id = a.id
  where i.tenant_id = p_tenant_id
    and i.accessory_id is not null
    and i.accessory_id <> p_accessory_id
    and i.deleted_at is null
    and a.deleted_at is null
    and a.active = true
    and w.sellable_web = true
    and w.web_slug is not null
  group by i.accessory_id
  having count(distinct i.sales_order_id) >= 2
  order by orders_count desc
  limit greatest(least(p_limit, 12), 1);
$$;

revoke all on function public.storefront_bought_together(uuid, uuid, integer) from public;
grant execute on function public.storefront_bought_together(uuid, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5) Soft delete: a slug felszabadul, a termék kikerül a boltból
-- ---------------------------------------------------------------------------
create or replace function public.accessory_web_on_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.accessory_web
    set sellable_web = false, web_slug = null, updated_at = now()
    where accessory_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists accessories_web_soft_delete on public.accessories;
create trigger accessories_web_soft_delete
  after update of deleted_at on public.accessories
  for each row execute function public.accessory_web_on_soft_delete();

-- ---------------------------------------------------------------------------
-- 6) Bolt kategória darabszámok (a PostgREST 1000 soros limitje miatt nem sorokból számoljuk)
-- ---------------------------------------------------------------------------
create or replace function public.storefront_category_counts(p_tenant uuid)
returns table (web_category_id uuid, product_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select w.web_category_id, count(*)::bigint
  from public.accessory_web w
  join public.accessories a on a.id = w.accessory_id
  where w.tenant_id = p_tenant
    and w.sellable_web
    and w.web_slug is not null
    and w.web_category_id is not null
    and a.active
    and a.deleted_at is null
  group by w.web_category_id;
$$;

revoke all on function public.storefront_category_counts(uuid) from public;
grant execute on function public.storefront_category_counts(uuid) to service_role;
