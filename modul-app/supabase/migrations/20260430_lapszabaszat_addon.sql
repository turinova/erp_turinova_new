-- Lapszabászat add-on: Opti stack (nem része az Alap plannak)
-- Ár: 10 000 Ft / hó nettó
-- Függő add-onok: partner_orders, quote_ready_sms

-- ---------------------------------------------------------------------------
-- Capability feature (könnyű entitlement check)
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  'lapszabaszat',
  'Lapszabászat',
  'Add-on',
  null,
  400,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

-- ---------------------------------------------------------------------------
-- Add-on katalógus
-- ---------------------------------------------------------------------------
insert into public.product_addons (key, name, description, active, price_monthly_huf, currency)
values (
  'lapszabaszat',
  'Lapszabászat',
  'Opti, ajánlatok, megrendelések, táblás/szálas/élzáró anyagok, gépek, berendezés, scanner.',
  true,
  10000,
  'HUF'
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  price_monthly_huf = excluded.price_monthly_huf,
  currency = 'HUF',
  updated_at = now();

-- Page features → addon
insert into public.product_addon_features (addon_id, feature_key)
select a.id, v.feature_key
from public.product_addons a
cross join (
  values
    ('lapszabaszat'),
    ('/opti'),
    ('/ajanlatok'),
    ('/megrendelesek'),
    ('/scanner'),
    ('/torzsadatok/alapanyagok/tablas-anyagok'),
    ('/torzsadatok/alapanyagok/szalas-anyagok'),
    ('/torzsadatok/alapanyagok/elzarok'),
    ('/torzsadatok/rendszer/gyartogepek'),
    ('/torzsadatok/rendszer/berendezes'),
    ('/beallitasok/opti')
) as v(feature_key)
where a.key = 'lapszabaszat'
  and exists (
    select 1 from public.product_features f where f.key = v.feature_key
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Alap plan: lapszabászat page-ek kiveszve
-- ---------------------------------------------------------------------------
delete from public.product_plan_features pf
using public.product_plans p
where pf.plan_id = p.id
  and p.key = 'alap'
  and pf.feature_key in (
    '/opti',
    '/ajanlatok',
    '/megrendelesek',
    '/scanner',
    '/torzsadatok/alapanyagok/tablas-anyagok',
    '/torzsadatok/alapanyagok/szalas-anyagok',
    '/torzsadatok/alapanyagok/elzarok',
    '/torzsadatok/rendszer/gyartogepek',
    '/torzsadatok/rendszer/berendezes',
    '/beallitasok/opti',
    'lapszabaszat'
  );

-- ---------------------------------------------------------------------------
-- Meglévő tenantok: Lapszabászat be (ne törjön production)
-- ---------------------------------------------------------------------------
insert into public.tenant_addons (tenant_id, addon_id, enabled_at)
select t.id, a.id, now()
from public.tenants t
cross join public.product_addons a
where a.key = 'lapszabaszat'
on conflict (tenant_id, addon_id) do nothing;

-- Entitlement materialize (addon feature-ök)
insert into public.tenant_entitlements (tenant_id, feature_key)
select ta.tenant_id, paf.feature_key
from public.tenant_addons ta
join public.product_addons a on a.id = ta.addon_id
join public.product_addon_features paf on paf.addon_id = a.id
where a.key = 'lapszabaszat'
on conflict do nothing;

-- Page access minden tagnak
insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  m.tenant_id,
  m.id,
  v.page_key,
  true
from public.tenant_memberships m
join public.tenant_addons ta on ta.tenant_id = m.tenant_id
join public.product_addons a on a.id = ta.addon_id and a.key = 'lapszabaszat'
cross join (
  values
    ('/opti'),
    ('/ajanlatok'),
    ('/megrendelesek'),
    ('/scanner'),
    ('/torzsadatok/alapanyagok/tablas-anyagok'),
    ('/torzsadatok/alapanyagok/szalas-anyagok'),
    ('/torzsadatok/alapanyagok/elzarok'),
    ('/torzsadatok/rendszer/gyartogepek'),
    ('/torzsadatok/rendszer/berendezes'),
    ('/beallitasok/opti')
) as v(page_key)
on conflict (membership_id, page_key) do update
set can_access = true;
