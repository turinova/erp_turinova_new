-- =============================================================================
-- b2b-portal / 033_free_shipping_cache.sql
-- SUPERSEDED by 034_drop_free_shipping_cache.sql (manual threshold only).
-- Kept for migration history; do not apply on new installs — run 034 instead
-- if 033 was already applied.
-- =============================================================================

alter table public.shops
  add column if not exists free_shipping_gross_synced integer,
  add column if not exists free_shipping_mode_name text,
  add column if not exists free_shipping_synced_at timestamptz;

comment on column public.shops.free_shipping_gross_synced is
  'DEPRECATED — removed by 034. Was: synced freeShippingFrom (HUF gross).';
comment on column public.shops.free_shipping_mode_name is
  'DEPRECATED — removed by 034.';
comment on column public.shops.free_shipping_synced_at is
  'DEPRECATED — removed by 034.';

insert into public.schema_migrations (filename)
values ('033_free_shipping_cache.sql')
on conflict (filename) do nothing;
