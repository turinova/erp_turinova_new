-- Csomag tisztítás (2026-09-18):
-- 1) Beszerzés → Alap plan (0 Ft add-on kikapcsolva)
-- 2) POS → külön add-on (/pos + műszakok lista)

-- ---------------------------------------------------------------------------
-- 1) Beszerzés feature az Alap planra
-- ---------------------------------------------------------------------------
update public.product_plans
set
  description =
    'Bolt mag: eladás, árajánlat, készlet, beszerzés, törzsadat.',
  updated_at = now()
where key = 'alap';

insert into public.product_plan_features (plan_id, feature_key)
select p.id, 'beszerzes'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, 'beszerzes'
from public.tenants t
where t.plan_id in (select id from public.product_plans where key = 'alap')
on conflict do nothing;

-- 0 Ft „Beszerzés” add-on: ne jelenjen meg a katalógusban
update public.product_addons
set
  active = false,
  updated_at = now()
where key = 'beszerzes';

-- tenant_addons sorok: opcionális cleanup (feature már planból jön)
delete from public.tenant_addons ta
using public.product_addons a
where ta.addon_id = a.id
  and a.key = 'beszerzes';

-- ---------------------------------------------------------------------------
-- 2) POS capability + műszakok page feature
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values
  (
    'pos',
    'POS terminál',
    'Add-on',
    null,
    540,
    true
  ),
  (
    '/ertekesitesek/muszakok',
    'Műszakok',
    'Értékesítés',
    '/ertekesitesek/muszakok',
    37,
    true
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

-- /pos marad page feature; kategória Add-on jelzés a UI-nak nem kötelező
update public.product_features
set
  category = 'Add-on',
  sort_order = 541,
  active = true
where key = '/pos';

-- ---------------------------------------------------------------------------
-- POS add-on katalógus
-- ---------------------------------------------------------------------------
insert into public.product_addons (
  key, name, description, active, price_monthly_huf, currency
)
values (
  'pos',
  'POS terminál',
  'Pénztár UI, műszak nyitás/zárás, KP mozgás. Manuális értékesítés az Alapban marad.',
  true,
  9900,
  'HUF'
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  price_monthly_huf = excluded.price_monthly_huf,
  currency = 'HUF',
  updated_at = now();

insert into public.product_addon_features (addon_id, feature_key)
select a.id, v.feature_key
from public.product_addons a
cross join (
  values
    ('pos'),
    ('/pos'),
    ('/ertekesitesek/muszakok')
) as v(feature_key)
where a.key = 'pos'
  and exists (select 1 from public.product_features f where f.key = v.feature_key)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Alap plan: /pos kiveszve (műszakok soha nem volt planen)
-- ---------------------------------------------------------------------------
delete from public.product_plan_features pf
using public.product_plans p
where pf.plan_id = p.id
  and p.key = 'alap'
  and pf.feature_key in ('/pos', 'pos', '/ertekesitesek/muszakok');

-- ---------------------------------------------------------------------------
-- Backfill: aki eddig használta a POS-t (/pos entitlement) → POS add-on ON
-- ---------------------------------------------------------------------------
insert into public.tenant_addons (tenant_id, addon_id, enabled_at)
select distinct te.tenant_id, a.id, now()
from public.tenant_entitlements te
cross join public.product_addons a
where a.key = 'pos'
  and te.feature_key = '/pos'
on conflict (tenant_id, addon_id) do nothing;

-- Capability + műszakok entitlement a POS-addon tenantoknak
insert into public.tenant_entitlements (tenant_id, feature_key)
select ta.tenant_id, v.feature_key
from public.tenant_addons ta
join public.product_addons a on a.id = ta.addon_id and a.key = 'pos'
cross join (values ('pos'), ('/ertekesitesek/muszakok')) as v(feature_key)
on conflict do nothing;

-- Membership page access műszakokhoz (POS-os tenantok)
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/ertekesitesek/muszakok', true
from public.tenant_memberships m
join public.tenant_addons ta on ta.tenant_id = m.tenant_id
join public.product_addons a on a.id = ta.addon_id and a.key = 'pos'
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();

-- Akinek NINCS pos add-on: /pos entitlement le (ha még planről maradt)
delete from public.tenant_entitlements te
where te.feature_key in ('/pos', 'pos', '/ertekesitesek/muszakok')
  and not exists (
    select 1
    from public.tenant_addons ta
    join public.product_addons a on a.id = ta.addon_id and a.key = 'pos'
    where ta.tenant_id = te.tenant_id
  );

comment on table public.product_addons is
  'Add-on katalógus. Alap plan = bolt mag (eladás, készlet, beszerzés). POS / Lapszabászat / Partner / SMS / Címke / Belépő = add-on.';
