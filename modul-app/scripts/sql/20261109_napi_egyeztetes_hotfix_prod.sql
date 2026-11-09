-- PROD hotfix (egyszer futtatható SQL editorban) — ugyanaz, mint
-- supabase/migrations/20260925_napi_egyeztetes_all_sales_plans.sql
--
-- Utána: staff kilépés + új login (modul_session_v1 frissül).
-- Ellenőrzés:
--   select feature_key from tenant_entitlements
--   where tenant_id = '<hiros-tenant>' and feature_key = '/ertekesitesek/napi-egyeztetes';

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

insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/ertekesitesek/napi-egyeztetes'
from public.product_plans p
where p.key in ('alap', 'bolt', 'bolt_plus', 'muhely', 'pro')
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/ertekesitesek/napi-egyeztetes'
from public.tenants t
join public.product_plans p on p.id = t.plan_id
where p.key in ('alap', 'bolt', 'bolt_plus', 'muhely', 'pro')
on conflict do nothing;

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

-- Hírös sanity (opcionális output)
select t.slug, p.key as plan_key, te.feature_key
from public.tenants t
join public.product_plans p on p.id = t.plan_id
left join public.tenant_entitlements te
  on te.tenant_id = t.id
 and te.feature_key = '/ertekesitesek/napi-egyeztetes'
where t.id = '45dd7c02-28e9-4f4a-b74c-704f63437927';
