-- Napi egyeztetés: product_features + Alap plan + entitlement + page_access backfill
-- Route: /ertekesitesek/napi-egyeztetes

insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/ertekesitesek/napi-egyeztetes',
  'Napi egyeztetés',
  'Értékesítés',
  '/ertekesitesek/napi-egyeztetes',
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

-- Alap plan
insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/ertekesitesek/napi-egyeztetes'
from public.product_plans p
where p.key = 'alap'
  and exists (
    select 1 from public.product_features f
    where f.key = '/ertekesitesek/napi-egyeztetes'
  )
on conflict do nothing;

-- Entitlement: akinek van értékesítés / műszak / POS
insert into public.tenant_entitlements (tenant_id, feature_key)
select distinct te.tenant_id, '/ertekesitesek/napi-egyeztetes'
from public.tenant_entitlements te
where te.feature_key in (
  '/ertekesitesek',
  '/ertekesitesek/muszakok',
  '/pos',
  'pos'
)
on conflict do nothing;

-- Alap plan tenantok (ha materializálás még nem futott)
insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/ertekesitesek/napi-egyeztetes'
from public.tenants t
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
on conflict do nothing;

-- Page access: aki látja az értékesítést vagy műszakokat
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select distinct m.tenant_id, m.id, '/ertekesitesek/napi-egyeztetes', true
from public.tenant_memberships m
where exists (
  select 1
  from public.tenant_membership_page_access pa
  where pa.membership_id = m.id
    and pa.can_access = true
    and pa.page_key in (
      '/ertekesitesek',
      '/ertekesitesek/muszakok',
      '/pos'
    )
)
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();

-- Alap tenant membershipek (üres / részleges page_access)
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/ertekesitesek/napi-egyeztetes', true
from public.tenant_memberships m
join public.tenants t on t.id = m.tenant_id
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
