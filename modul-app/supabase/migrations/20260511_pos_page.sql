-- POS page entitlement (/pos)

insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/pos',
  'POS',
  'Értékesítés',
  '/pos',
  36,
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
select p.id, '/pos'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/pos'
from public.tenants t
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/pos', true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
