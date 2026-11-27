-- Publikus weblap katalógus (hirosablak.hu): bútorlap + munkalap
-- Ár NINCS a view-kban. Anon csak a view-t olvassa (GRANT); a nyers tábla RLS tag-only marad.
-- Tenant: Hírös-Ablak Kft. (hiros-ablak-kft)

-- ---------------------------------------------------------------------------
-- 1) SEO oszlopok
-- ---------------------------------------------------------------------------
alter table public.sheet_materials
  add column if not exists slug text;

alter table public.sheet_materials
  add column if not exists indexable_on_site boolean not null default false;

alter table public.linear_materials
  add column if not exists slug text;

alter table public.linear_materials
  add column if not exists indexable_on_site boolean not null default false;

comment on column public.sheet_materials.slug is
  'Stabil URL-slug a hirosablak.hu/butorlap/{slug} oldalhoz';
comment on column public.sheet_materials.indexable_on_site is
  'true = megjelenhet a weblap sitemapjében / indexelhető';
comment on column public.linear_materials.slug is
  'Stabil URL-slug a hirosablak.hu/munkalap/{slug} oldalhoz';
comment on column public.linear_materials.indexable_on_site is
  'true = megjelenhet a weblap sitemapjében / indexelhető';

create unique index if not exists sheet_materials_tenant_slug_alive_uidx
  on public.sheet_materials (tenant_id, slug)
  where deleted_at is null and slug is not null;

create unique index if not exists linear_materials_tenant_slug_alive_uidx
  on public.linear_materials (tenant_id, slug)
  where deleted_at is null and slug is not null;

create index if not exists sheet_materials_indexable_alive_idx
  on public.sheet_materials (tenant_id)
  where deleted_at is null and indexable_on_site = true;

create index if not exists linear_materials_indexable_alive_idx
  on public.linear_materials (tenant_id)
  where deleted_at is null and indexable_on_site = true;

-- ---------------------------------------------------------------------------
-- 2) Hírös tenant id (view WHERE)
-- ---------------------------------------------------------------------------
-- 45dd7c02-28e9-4f4a-b74c-704f63437927 = tenants.slug = hiros-ablak-kft

-- ---------------------------------------------------------------------------
-- 3) public_butorlap — ár nélkül
-- ---------------------------------------------------------------------------
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
  sm.indexable_on_site
from public.sheet_materials sm
join public.manufacturers m on m.id = sm.manufacturer_id
where sm.deleted_at is null
  and sm.active = true
  and sm.tenant_id = '45dd7c02-28e9-4f4a-b74c-704f63437927'::uuid;

comment on view public.public_butorlap is
  'Hírös Ablak weblap bútorlap katalógus (modul-app sheet_materials, ár nélkül)';

grant select on public.public_butorlap to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) public_munkalap — ár nélkül; type_name a marketing UI címkéi
-- ---------------------------------------------------------------------------
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
  end as type_name
from public.linear_materials lm
join public.manufacturers m on m.id = lm.manufacturer_id
where lm.deleted_at is null
  and lm.active = true
  and lm.tenant_id = '45dd7c02-28e9-4f4a-b74c-704f63437927'::uuid
  and lm.material_type in ('munkalap', 'asztalap', 'hatfal');

comment on view public.public_munkalap is
  'Hírös Ablak weblap munkalap/asztallap/hátfal katalógus (modul-app linear_materials, ár nélkül)';

grant select on public.public_munkalap to anon, authenticated;
