-- Kiemelt partnerek: product_features + lapszabászat addon + entitlement backfill.
-- (A 20261017 csak page_access-t adott — entitlements nélkül nem jelenik meg a nav / jogosultság UI.)

insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/kiemelt-partnerek',
  'Kiemelt partnerek',
  'Ügyfél',
  '/kiemelt-partnerek',
  55,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

-- Lapszabászat add-on feature lista
insert into public.product_addon_features (addon_id, feature_key)
select a.id, '/kiemelt-partnerek'
from public.product_addons a
where a.key = 'lapszabaszat'
  and exists (
    select 1 from public.product_features f where f.key = '/kiemelt-partnerek'
  )
on conflict do nothing;

-- Entitlement: akinek már van lapszabászat (vagy /ajanlatok)
insert into public.tenant_entitlements (tenant_id, feature_key)
select distinct te.tenant_id, '/kiemelt-partnerek'
from public.tenant_entitlements te
where te.feature_key in ('lapszabaszat', '/ajanlatok', '/megrendelesek', '/opti')
on conflict do nothing;

-- Page access (ha 20261017 nem futott / hiányos)
insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  a.tenant_id,
  a.membership_id,
  '/kiemelt-partnerek',
  true
from public.tenant_membership_page_access a
where a.page_key = '/ajanlatok'
  and a.can_access = true
  and exists (
    select 1
    from public.tenant_entitlements e
    where e.tenant_id = a.tenant_id
      and e.feature_key = 'lapszabaszat'
  )
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
