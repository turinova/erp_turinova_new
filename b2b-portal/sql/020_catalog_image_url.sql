-- =============================================================================
-- b2b-portal / 020_catalog_image_url.sql
-- Termékkép URL a katalógus tükörben (Shoprenter mainPicture → CDN).
-- =============================================================================

alter table public.product_catalog
  add column if not exists image_url text;

insert into public.schema_migrations (filename)
values ('020_catalog_image_url.sql')
on conflict (filename) do nothing;
