-- Beállítások → Google értékelések oldal: feature + entitlement + page_access
-- Route: /beallitasok/google-ertekelesek
-- Kapu: ugyanaz, mint a Cégadatok (alap oldal, nem add-on).

insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beallitasok/google-ertekelesek',
  'Google értékelések',
  'Beállítások',
  '/beallitasok/google-ertekelesek',
  177,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

-- Minden plan, amiben a Cégadatok benne van (újraszámoláskor se vesszen el)
insert into public.product_plan_features (plan_id, feature_key)
select distinct pf.plan_id, '/beallitasok/google-ertekelesek'
from public.product_plan_features pf
where pf.feature_key = '/beallitasok/cegadatok'
on conflict do nothing;

-- Meglévő tenantek: akinek van Cégadatok entitlementje
insert into public.tenant_entitlements (tenant_id, feature_key)
select distinct e.tenant_id, '/beallitasok/google-ertekelesek'
from public.tenant_entitlements e
where e.feature_key = '/beallitasok/cegadatok'
on conflict do nothing;

-- Page access: aki a Cégadatokat eléri
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select a.tenant_id, a.membership_id, '/beallitasok/google-ertekelesek', true
from public.tenant_membership_page_access a
where a.page_key = '/beallitasok/cegadatok'
  and a.can_access = true
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
