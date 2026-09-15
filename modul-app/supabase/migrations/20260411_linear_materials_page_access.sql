-- Szálas anyagok: meglévő membership page_access pótlás (menü megjelenés)
-- Futtasd, ha a 20260410 már lefutott a page_access insert nélkül.

insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  a.tenant_id,
  a.membership_id,
  '/torzsadatok/alapanyagok/szalas-anyagok',
  true
from public.tenant_membership_page_access a
where a.page_key = '/torzsadatok/alapanyagok/tablas-anyagok'
  and a.can_access = true
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();

insert into public.product_features (key, label, category, page_key, sort_order)
values
  (
    '/torzsadatok/alapanyagok/szalas-anyagok',
    'Szálas anyagok',
    'Törzsadatok',
    '/torzsadatok/alapanyagok/szalas-anyagok',
    75
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/torzsadatok/alapanyagok/szalas-anyagok'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/torzsadatok/alapanyagok/szalas-anyagok'
from public.tenants t
on conflict do nothing;
