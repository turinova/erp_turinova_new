-- Pénzügy oldalak entitlement + page_access (20260566 után)
-- Az új /penzugy* route-ok nem voltak a katalógusban / tag jogokban.

insert into public.product_features (key, label, category, page_key, sort_order, active)
values
  (
    '/penzugy',
    'Pénzügy áttekintés',
    'Pénzügy',
    '/penzugy',
    39,
    true
  ),
  (
    '/penzugy/kintlevoseg',
    'Kintlévőség',
    'Pénzügy',
    '/penzugy/kintlevoseg',
    40,
    true
  ),
  (
    '/penzugy/afa',
    'ÁFA összesítő',
    'Pénzügy',
    '/penzugy/afa',
    41,
    true
  ),
  (
    '/penzugy/exportok',
    'Pénzügy exportok',
    'Pénzügy',
    '/penzugy/exportok',
    42,
    true
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

update public.product_features
set
  label = 'Bizonylatok',
  category = 'Pénzügy'
where key = '/szamlak';

insert into public.product_plan_features (plan_id, feature_key)
select p.id, v.feature_key
from public.product_plans p
cross join (
  values
    ('/penzugy'),
    ('/penzugy/kintlevoseg'),
    ('/penzugy/afa'),
    ('/penzugy/exportok')
) as v(feature_key)
where p.key = 'alap'
  and exists (select 1 from public.product_features f where f.key = v.feature_key)
on conflict do nothing;

-- Tenant: aki már kapott számlázást / /szamlak-ot
insert into public.tenant_entitlements (tenant_id, feature_key)
select distinct e.tenant_id, v.feature_key
from public.tenant_entitlements e
cross join (
  values
    ('/penzugy'),
    ('/penzugy/kintlevoseg'),
    ('/penzugy/afa'),
    ('/penzugy/exportok')
) as v(feature_key)
where e.feature_key in ('szamlazas', '/szamlak')
on conflict do nothing;

-- Tag jog: aki látja a /szamlak-ot, kapja a Pénzügy oldalakat is
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select
  a.tenant_id,
  a.membership_id,
  v.page_key,
  true
from public.tenant_membership_page_access a
cross join (
  values
    ('/penzugy'),
    ('/penzugy/kintlevoseg'),
    ('/penzugy/afa'),
    ('/penzugy/exportok')
) as v(page_key)
where a.page_key = '/szamlak'
  and a.can_access = true
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();

-- Alap plan tenantok (ha /szamlak még nincs a page_accessben, de alap + szamlazas van)
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, v.page_key, true
from public.tenant_memberships m
join public.tenants t on t.id = m.tenant_id
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
cross join (
  values
    ('/szamlak'),
    ('/penzugy'),
    ('/penzugy/kintlevoseg'),
    ('/penzugy/afa'),
    ('/penzugy/exportok'),
    ('/beallitasok/szamlazas')
) as v(page_key)
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
