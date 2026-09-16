-- Manuális előfizetés: katalógus árak + tenant Előfizetés oldal (read-only)

-- ---------------------------------------------------------------------------
-- Ár mezők
-- ---------------------------------------------------------------------------
alter table public.product_plans
  add column if not exists price_monthly_huf integer not null default 0,
  add column if not exists currency text not null default 'HUF';

alter table public.product_addons
  add column if not exists price_monthly_huf integer not null default 0,
  add column if not exists price_unit_huf integer,
  add column if not exists unit_key text,
  add column if not exists currency text not null default 'HUF';

alter table public.product_plans
  drop constraint if exists product_plans_price_monthly_nonneg;
alter table public.product_plans
  add constraint product_plans_price_monthly_nonneg
  check (price_monthly_huf >= 0);

alter table public.product_addons
  drop constraint if exists product_addons_price_monthly_nonneg;
alter table public.product_addons
  add constraint product_addons_price_monthly_nonneg
  check (price_monthly_huf >= 0);

alter table public.product_addons
  drop constraint if exists product_addons_price_unit_nonneg;
alter table public.product_addons
  add constraint product_addons_price_unit_nonneg
  check (price_unit_huf is null or price_unit_huf >= 0);

alter table public.product_addons
  drop constraint if exists product_addons_unit_key_check;
alter table public.product_addons
  add constraint product_addons_unit_key_check
  check (unit_key is null or unit_key in ('sms_sent'));

comment on column public.product_plans.price_monthly_huf is
  'Listaár havidíj nettó HUF — manuális számlázás.';
comment on column public.product_addons.price_monthly_huf is
  'Add-on listaár havidíj nettó HUF.';
comment on column public.product_addons.price_unit_huf is
  'Usage egységár nettó HUF (pl. SMS Ft/db); null = nincs metered.';
comment on column public.product_addons.unit_key is
  'Usage meter kulcs: sms_sent.';

-- Seed / update listaárak
update public.product_plans
set price_monthly_huf = 55000, currency = 'HUF', updated_at = now()
where key = 'alap';

update public.product_addons
set
  price_monthly_huf = 15000,
  price_unit_huf = null,
  unit_key = null,
  currency = 'HUF',
  updated_at = now()
where key = 'product_labels';

update public.product_addons
set
  price_monthly_huf = 35000,
  price_unit_huf = null,
  unit_key = null,
  currency = 'HUF',
  updated_at = now()
where key = 'partner_orders';

update public.product_addons
set
  price_monthly_huf = 7500,
  price_unit_huf = 95,
  unit_key = 'sms_sent',
  currency = 'HUF',
  updated_at = now()
where key = 'quote_ready_sms';

-- ---------------------------------------------------------------------------
-- Tenant Előfizetés oldal (Alap plan — mindig, ha van cégadatok jellegű access)
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beallitasok/elofizetes',
  'Előfizetés',
  'Beállítások',
  '/beallitasok/elofizetes',
  178,
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
select p.id, '/beallitasok/elofizetes'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

-- Entitlement + page access minden meglévő tenant/tagnek
insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/beallitasok/elofizetes'
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
  '/beallitasok/elofizetes',
  true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();

