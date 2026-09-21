-- Alap plan: POS + termékcímke beolvasztás; listaár 39 990 Ft nettó/hó
-- (Beszerzés már Alap — 20260517)

-- ---------------------------------------------------------------------------
-- 1) Alap plan ár + leírás
-- ---------------------------------------------------------------------------
update public.product_plans
set
  price_monthly_huf = 39990,
  currency = 'HUF',
  description =
    'Bolt mag: eladás, árajánlat, készlet, beszerzés, POS, címke, törzsadat.',
  updated_at = now()
where key = 'alap';

-- ---------------------------------------------------------------------------
-- 2) Feature kategóriák (UI)
-- ---------------------------------------------------------------------------
update public.product_features
set
  category = 'Értékesítés',
  sort_order = 36,
  active = true
where key = 'pos';

update public.product_features
set
  category = 'Értékesítés',
  sort_order = 35,
  active = true
where key = '/pos';

update public.product_features
set
  category = 'Értékesítés',
  sort_order = 37,
  active = true
where key = '/ertekesitesek/muszakok';

update public.product_features
set
  category = 'Készlet',
  sort_order = 120,
  active = true
where key = 'product_labels';

-- ---------------------------------------------------------------------------
-- 3) Feature-ök az Alap planre
-- ---------------------------------------------------------------------------
insert into public.product_plan_features (plan_id, feature_key)
select p.id, v.feature_key
from public.product_plans p
cross join (
  values
    ('pos'),
    ('/pos'),
    ('/ertekesitesek/muszakok'),
    ('product_labels')
) as v(feature_key)
where p.key = 'alap'
  and exists (select 1 from public.product_features f where f.key = v.feature_key)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4) Entitlement backfill minden Alap-tenantnak
-- ---------------------------------------------------------------------------
insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, v.feature_key
from public.tenants t
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
cross join (
  values
    ('pos'),
    ('/pos'),
    ('/ertekesitesek/muszakok'),
    ('product_labels')
) as v(feature_key)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5) POS page_access minden Alap-tenant membershipnek
-- ---------------------------------------------------------------------------
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, v.page_key, true
from public.tenant_memberships m
join public.tenants t on t.id = m.tenant_id
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
cross join (values ('/pos'), ('/ertekesitesek/muszakok')) as v(page_key)
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 6) POS + címke add-on kikapcsolva (mint beszerzes)
-- ---------------------------------------------------------------------------
update public.product_addons
set
  active = false,
  updated_at = now()
where key in ('pos', 'product_labels');

delete from public.tenant_addons ta
using public.product_addons a
where ta.addon_id = a.id
  and a.key in ('pos', 'product_labels');

comment on table public.product_addons is
  'Add-on katalógus. Alap plan = bolt mag (eladás, készlet, beszerzés, POS, címke). Lapszabászat / Partner / SMS / Jelenlét / Belépő = add-on.';
