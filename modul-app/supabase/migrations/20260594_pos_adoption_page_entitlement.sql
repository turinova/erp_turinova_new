-- POS használat oldal: product_features + Alap/POS entitlement + page_access backfill.

insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/ertekesitesek/pos-hasznalat',
  'POS használat',
  'Értékesítés',
  '/ertekesitesek/pos-hasznalat',
  38,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

-- Alap plan (POS beolvasztva)
insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/ertekesitesek/pos-hasznalat'
from public.product_plans p
where p.key = 'alap'
  and exists (
    select 1 from public.product_features f
    where f.key = '/ertekesitesek/pos-hasznalat'
  )
on conflict do nothing;

-- POS add-on (ha még aktív / legacy)
insert into public.product_addon_features (addon_id, feature_key)
select a.id, '/ertekesitesek/pos-hasznalat'
from public.product_addons a
where a.key = 'pos'
  and exists (
    select 1 from public.product_features f
    where f.key = '/ertekesitesek/pos-hasznalat'
  )
on conflict do nothing;

-- Entitlement: mindenkinek, akinek már van POS / műszak feature
insert into public.tenant_entitlements (tenant_id, feature_key)
select distinct te.tenant_id, '/ertekesitesek/pos-hasznalat'
from public.tenant_entitlements te
where te.feature_key in ('pos', '/pos', '/ertekesitesek/muszakok')
on conflict do nothing;

-- Alap plan tenantok (ha materializálás még nem futott)
insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/ertekesitesek/pos-hasznalat'
from public.tenants t
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
on conflict do nothing;

-- Page access: aki már látja a POS-t vagy műszakokat
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select distinct m.tenant_id, m.id, '/ertekesitesek/pos-hasznalat', true
from public.tenant_memberships m
where exists (
  select 1
  from public.tenant_membership_page_access pa
  where pa.membership_id = m.id
    and pa.can_access = true
    and pa.page_key in ('/pos', '/ertekesitesek/muszakok')
)
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();

-- Alap tenant membershipek (üres / részleges page_access eset)
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/ertekesitesek/pos-hasznalat', true
from public.tenant_memberships m
join public.tenants t on t.id = m.tenant_id
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
