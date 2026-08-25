-- =============================================================================
-- b2b-portal / 021_catalog_manufacturer.sql
-- Gyártó / márka a katalógus tükörben (Shoprenter manufacturer → szűrés /arak).
-- MANUÁLISAN futtasd — előtte: 020
-- =============================================================================

alter table public.product_catalog
  add column if not exists manufacturer_inner_id integer;

alter table public.product_catalog
  add column if not exists manufacturer_name text;

create index if not exists idx_product_catalog_shop_mfr
  on public.product_catalog (shop_id, manufacturer_inner_id)
  where manufacturer_inner_id is not null;

create index if not exists idx_product_catalog_shop_mfr_name
  on public.product_catalog (shop_id, manufacturer_name)
  where manufacturer_name is not null;

insert into public.schema_migrations (filename)
values ('021_catalog_manufacturer.sql')
on conflict (filename) do nothing;
