-- Storefront kategória oldal (doc 40 §3h)
-- 1) web_categories.intro (≤300 kar., a H1 alatt) + cover_accessory_id (kézi borítókép).
-- 2) storefront_category_covers: kategóriánként (saját termékek) a borítókép-jelölt + legkisebb bruttó ár.
--    Jelölt: kézi borító, különben a legtöbb RENDELÉSBEN szereplő variánscsoport (N nap, minden csatorna;
--    darabszám nem, mert a csavar / tipli ezrével fogy). Raktáron lévő előre, más termék tartozéka hátra.
--    Eladás nélkül: a legnagyobb sorozat fő terméke. A szülő-kategóriákra a kód görgeti fel.
--    group_count: kártyák (variánscsoportok) száma — a csempe / menü ugyanazt számolja, mint a lista.
-- 3) storefront_order_counts: termékenként hány rendelésben szerepelt N nap alatt („Ajánlott” sorrend).
-- Csak olvas; service_role hívja (mint a storefront_category_counts).

alter table public.web_categories
  add column if not exists intro text,
  add column if not exists cover_accessory_id uuid references public.accessories (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'web_categories_intro_len'
  ) then
    alter table public.web_categories
      add constraint web_categories_intro_len check (intro is null or char_length(intro) <= 300);
  end if;
end $$;

create index if not exists sales_order_items_tenant_accessory_idx
  on public.sales_order_items (tenant_id, accessory_id)
  where deleted_at is null and accessory_id is not null;

drop function if exists public.storefront_sold_qty(uuid, uuid[], integer);
drop function if exists public.storefront_category_covers(uuid, integer);

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
      round(a.price_net * (1 + coalesce(t.rate_percent, 0) / 100.0)) as price_gross
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
    -- A „-tól” ár tartozék nélkül (ha van más termék); a darabszám kártyát (variánscsoportot) számol.
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

create or replace function public.storefront_order_counts(p_tenant uuid, p_ids uuid[], p_days integer default 180)
returns table (accessory_id uuid, order_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select i.accessory_id, count(distinct i.sales_order_id)
  from public.sales_order_items i
  join public.sales_orders o on o.id = i.sales_order_id
  where i.tenant_id = p_tenant
    and o.tenant_id = p_tenant
    and i.accessory_id = any (p_ids)
    and i.item_kind = 'product'
    and i.deleted_at is null
    and o.deleted_at is null
    and o.status in ('confirmed', 'fulfilled', 'partially_returned')
    and o.created_at >= now() - make_interval(days => greatest(1, least(p_days, 730)))
  group by i.accessory_id;
$$;

revoke all on function public.storefront_order_counts(uuid, uuid[], integer) from public;
grant execute on function public.storefront_order_counts(uuid, uuid[], integer) to service_role;
