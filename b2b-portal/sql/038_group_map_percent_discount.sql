-- =============================================================================
-- b2b-portal / 038_group_map_percent_discount.sql
-- MANUÁLISAN futtasd — előtte: 008
-- Csoport % kedvezmény snapshot (Shoprenter customerGroups.percentDiscount)
-- =============================================================================

alter table public.shop_customer_group_map
  add column if not exists percent_discount smallint;

alter table public.shop_customer_group_map
  drop constraint if exists shop_customer_group_map_percent_check;

alter table public.shop_customer_group_map
  add constraint shop_customer_group_map_percent_check
  check (
    percent_discount is null
    or (percent_discount >= 0 and percent_discount <= 100)
  );

insert into public.schema_migrations (filename)
values ('038_group_map_percent_discount.sql')
on conflict (filename) do nothing;
