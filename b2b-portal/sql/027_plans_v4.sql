-- =============================================================================
-- b2b-portal / 027_plans_v4.sql
-- MANUÁLISAN futtasd — előtte: 019
-- v4: Start ≤10 / Plus ≤50 / Pro ≤150
-- Árak: 5900 / 11900 / 19900 · próba 14 nap (kód default: TRIAL_DAYS_DEFAULT)
-- Minden funkció minden csomagban; logó Plus+Pro
-- =============================================================================

insert into public.plan_defaults (plan, partner_limit, sku_limit, list_price_huf)
values
  ('start', 10, 15000, 5900),
  ('plus', 50, 40000, 11900),
  ('pro', 150, 80000, 19900)
on conflict (plan) do update
set
  partner_limit = excluded.partner_limit,
  sku_limit = excluded.sku_limit,
  list_price_huf = excluded.list_price_huf,
  updated_at = now();

-- Optional: only if 018_platform_settings.sql already ran
do $$
begin
  if to_regclass('public.platform_settings') is not null then
    update public.platform_settings
    set trial_days = 14, updated_at = now()
    where id = 1;
  end if;
end $$;

insert into public.schema_migrations (filename)
values ('027_plans_v4.sql')
on conflict (filename) do nothing;
