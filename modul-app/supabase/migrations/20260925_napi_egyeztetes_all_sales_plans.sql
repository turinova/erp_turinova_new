-- Napi egyeztetés / home bónusz kártya: plan lefedés minden sales planre.
--
-- Gyökérok: 20260616 csak `alap` planhez + egyszeri tenant_entitlements backfill.
-- Addon ki/be → materializeTenantEntitlements töröl+újraír plan∪addon alapján →
-- bolt / bolt_plus / muhely / pro tenantokról leesik a feature (page_access megmarad).
--
-- Fix: product_plan_features minden releváns planre + entitlement backfill.

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

-- Sales / shop planek (alap legacy + square pack)
insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/ertekesitesek/napi-egyeztetes'
from public.product_plans p
where p.key in ('alap', 'bolt', 'bolt_plus', 'muhely', 'pro')
  and exists (
    select 1
    from public.product_features f
    where f.key = '/ertekesitesek/napi-egyeztetes'
  )
on conflict do nothing;

-- Élő tenantok ezeken a planeken
insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/ertekesitesek/napi-egyeztetes'
from public.tenants t
join public.product_plans p on p.id = t.plan_id
where p.key in ('alap', 'bolt', 'bolt_plus', 'muhely', 'pro')
on conflict do nothing;

-- Akinek van értékesítés / műszak / POS (plan-független safety net)
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
