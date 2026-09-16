-- Hotfix: Média menüpont jogosultság (ha a 20260422 már lefutott, de a menü nem látszik)
-- Futtasd a Supabase SQL Editorben, majd jelentkezz ki/be (session snapshot).

insert into public.product_features (key, label, category, page_key, sort_order)
values
  (
    '/torzsadatok/rendszer/media',
    'Média',
    'Törzsadatok',
    '/torzsadatok/rendszer/media',
    95
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/torzsadatok/rendszer/media'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/torzsadatok/rendszer/media'
from public.tenants t
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  m.tenant_id,
  m.id,
  '/torzsadatok/rendszer/media',
  true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
