-- =============================================================================
-- b2b-portal / 028_plans_v5.sql
-- MANUÁLISAN futtasd — előtte: 027 (vagy 019)
-- v5: egy alapár + felirat-eltávolítás felár
-- start 9900 · plus/pro 14800 (9900+4900) · partner soft 500
-- =============================================================================

insert into public.plan_defaults (plan, partner_limit, sku_limit, list_price_huf)
values
  ('start', 500, 80000, 9900),
  ('plus', 500, 80000, 14800),
  ('pro', 500, 80000, 14800)
on conflict (plan) do update
set
  partner_limit = excluded.partner_limit,
  sku_limit = excluded.sku_limit,
  list_price_huf = excluded.list_price_huf,
  updated_at = now();

do $$
begin
  if to_regclass('public.platform_settings') is not null then
    update public.platform_settings
    set trial_days = 14, updated_at = now()
    where id = 1;
  end if;
end $$;

insert into public.schema_migrations (filename)
values ('028_plans_v5.sql')
on conflict (filename) do nothing;
