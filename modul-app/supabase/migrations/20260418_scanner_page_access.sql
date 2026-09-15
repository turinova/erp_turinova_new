-- Scanner oldal: feature + Alap plan + entitlements + membership page_access

insert into public.product_features (key, label, category, page_key, sort_order)
values
  (
    '/scanner',
    'Scanner',
    'Műhely',
    '/scanner',
    65
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/scanner'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/scanner'
from public.tenants t
on conflict do nothing;

-- Meglévő membership: aki látja a Megrendeléseket, kapja a Scannert is
insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  a.tenant_id,
  a.membership_id,
  '/scanner',
  true
from public.tenant_membership_page_access a
where a.page_key = '/megrendelesek'
  and a.can_access = true
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
