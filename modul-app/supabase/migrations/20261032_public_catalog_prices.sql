-- Publikus katalógus: bruttó egész-tábla / egész-szál ár a weblapra
-- Előfeltétel: 20261030_public_catalog_views.sql
-- Képlet = OpenAI feed (modul-app/src/lib/feeds/openai/build.ts grossPrice)

create or replace view public.public_butorlap as
select
  sm.id,
  sm.slug,
  sm.name,
  m.name as brand_name,
  null::text as group_name,
  sm.length_mm,
  sm.width_mm,
  sm.thickness_mm,
  sm.grain_direction,
  sm.on_stock,
  sm.image_url,
  sm.updated_at,
  sm.indexable_on_site,
  case
    when sm.price_net > 0
      and sm.length_mm > 0
      and sm.width_mm > 0
    then round(
      sm.price_net
        * (sm.length_mm::numeric * sm.width_mm::numeric) / 1000000.0
        * (1 + coalesce(tr.rate_percent, 0) / 100.0)
    )::integer
    else null
  end as price_gross
from public.sheet_materials sm
join public.manufacturers m on m.id = sm.manufacturer_id
left join public.tax_rates tr on tr.id = sm.tax_rate_id
where sm.deleted_at is null
  and sm.active = true
  and sm.tenant_id = '45dd7c02-28e9-4f4a-b74c-704f63437927'::uuid;

comment on view public.public_butorlap is
  'Hírös Ablak weblap bútorlap katalógus (modul-app sheet_materials; price_gross = bruttó egész tábla)';

grant select on public.public_butorlap to anon, authenticated;

create or replace view public.public_munkalap as
select
  lm.id,
  lm.slug,
  lm.name,
  m.name as brand_name,
  lm.length_mm,
  lm.width_mm,
  cast(round(lm.thickness_mm) as integer) as thickness_mm,
  lm.on_stock,
  lm.image_url,
  lm.updated_at,
  lm.indexable_on_site,
  case lm.material_type
    when 'munkalap' then 'Munkalap'
    when 'asztalap' then 'Asztallap'
    when 'hatfal' then 'Hátfal'
    else lm.material_type
  end as type_name,
  case
    when lm.price_net > 0 and lm.length_mm > 0
    then round(
      lm.price_net
        * (lm.length_mm::numeric / 1000.0)
        * (1 + coalesce(tr.rate_percent, 0) / 100.0)
    )::integer
    else null
  end as price_gross
from public.linear_materials lm
join public.manufacturers m on m.id = lm.manufacturer_id
left join public.tax_rates tr on tr.id = lm.tax_rate_id
where lm.deleted_at is null
  and lm.active = true
  and lm.tenant_id = '45dd7c02-28e9-4f4a-b74c-704f63437927'::uuid
  and lm.material_type in ('munkalap', 'asztalap', 'hatfal');

comment on view public.public_munkalap is
  'Hírös Ablak weblap munkalap/asztallap/hátfal (price_gross = bruttó egész szál)';

grant select on public.public_munkalap to anon, authenticated;

-- Gyors ellenőrzés:
-- select count(*) filter (where price_gross is not null) as with_price,
--        count(*) filter (where price_gross is null) as no_price
-- from public.public_butorlap;
