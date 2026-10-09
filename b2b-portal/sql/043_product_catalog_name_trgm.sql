-- =============================================================================
-- b2b-portal / 043_product_catalog_name_trgm.sql
-- MANUÁLISAN futtasd — előtte: 013 (pg_trgm already enabled)
-- Speeds widget typeahead `name ilike '%…%'` (GIN trigram).
-- =============================================================================

create extension if not exists "pg_trgm";

create index if not exists idx_product_catalog_shop_name_trgm
  on public.product_catalog
  using gin (name gin_trgm_ops)
  where active and name is not null and btrim(name) <> '';

insert into public.schema_migrations (filename)
values ('043_product_catalog_name_trgm.sql')
on conflict (filename) do nothing;
