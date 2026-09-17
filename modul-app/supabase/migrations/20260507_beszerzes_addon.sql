-- Beszerzés add-on feature (termék detail készlet szekció gate)
-- Pages already on Alap (/beszallitok, /beszallitoi-rendelesek, /beerkezesek, raktarak).
-- This addon key gates product-master stock UI and future billing.

insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  'beszerzes',
  'Beszerzés',
  'Add-on',
  null,
  520,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addons (key, name, description, active, price_monthly_huf)
values (
  'beszerzes',
  'Beszerzés',
  'Beszállítók, rendelések, beérkezés és készlet — termékoldali készlet / mozgás nézettel.',
  true,
  0
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  updated_at = now();

insert into public.product_addon_features (addon_id, feature_key)
select a.id, 'beszerzes'
from public.product_addons a
where a.key = 'beszerzes'
on conflict do nothing;

-- Grant feature to tenants that already have procurement pages (Alap backfill)
insert into public.tenant_entitlements (tenant_id, feature_key)
select distinct te.tenant_id, 'beszerzes'
from public.tenant_entitlements te
where te.feature_key in (
  '/beszallitok',
  '/beszallitoi-rendelesek',
  '/beerkezesek',
  '/torzsadatok/rendszer/raktarak'
)
on conflict do nothing;

-- Also enable addon row for those tenants
insert into public.tenant_addons (tenant_id, addon_id, enabled_at)
select distinct te.tenant_id, a.id, now()
from public.tenant_entitlements te
cross join public.product_addons a
where a.key = 'beszerzes'
  and te.feature_key in (
    '/beszallitok',
    '/beszallitoi-rendelesek',
    '/beerkezesek',
    '/torzsadatok/rendszer/raktarak'
  )
on conflict (tenant_id, addon_id) do nothing;
