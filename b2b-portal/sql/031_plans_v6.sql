-- =============================================================================
-- b2b-portal / 031_plans_v6.sql
-- MANUÁLISAN futtasd — előtte: 028 (vagy 027)
-- v6: start 7500 · plus/pro 9999 bruttó (7500+2499 felirat nélkül)
-- =============================================================================

insert into public.plan_defaults (plan, partner_limit, sku_limit, list_price_huf)
values
  ('start', 500, 80000, 7500),
  ('plus', 500, 80000, 9999),
  ('pro', 500, 80000, 9999)
on conflict (plan) do update
set
  partner_limit = excluded.partner_limit,
  sku_limit = excluded.sku_limit,
  list_price_huf = excluded.list_price_huf,
  updated_at = now();

insert into public.schema_migrations (filename)
values ('031_plans_v6.sql')
on conflict (filename) do nothing;
