-- =============================================================================
-- b2b-portal / 019_plans_v3.sql
-- MANUÁLISAN futtasd — előtte: 015 + 016 + 018
-- v3 plan ID: start | plus | pro
-- grow → plus, scale → pro (+ partner_limit_override 200 ha üres)
-- Árak: 6900 / 12900 / 24900 · vevő 15 / 40 / 120
-- =============================================================================

alter table public.organizations
  drop constraint if exists organizations_plan_check;

update public.organizations
set
  partner_limit_override = coalesce(partner_limit_override, 200),
  plan = 'pro',
  updated_at = now()
where plan = 'scale';

update public.organizations
set plan = 'plus', updated_at = now()
where plan = 'grow';

alter table public.organizations
  alter column plan set default 'start';

alter table public.organizations
  add constraint organizations_plan_check
  check (plan in ('start', 'plus', 'pro'));

alter table public.plan_defaults
  drop constraint if exists plan_defaults_plan_check;

delete from public.plan_defaults where plan in ('grow', 'scale');

alter table public.plan_defaults
  add constraint plan_defaults_plan_check
  check (plan in ('start', 'plus', 'pro'));

insert into public.plan_defaults (plan, partner_limit, sku_limit, list_price_huf)
values
  ('start', 15, 15000, 6900),
  ('plus', 40, 40000, 12900),
  ('pro', 120, 80000, 24900)
on conflict (plan) do update
set
  partner_limit = excluded.partner_limit,
  sku_limit = excluded.sku_limit,
  list_price_huf = excluded.list_price_huf,
  updated_at = now();

insert into public.schema_migrations (filename)
values ('019_plans_v3.sql')
on conflict (filename) do nothing;
