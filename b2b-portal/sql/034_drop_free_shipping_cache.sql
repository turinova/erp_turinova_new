-- =============================================================================
-- b2b-portal / 034_drop_free_shipping_cache.sql
-- Manual free-shipping FOMO only — drop Shoprenter sync cache columns.
-- =============================================================================

alter table public.shops
  drop column if exists free_shipping_gross_synced,
  drop column if exists free_shipping_mode_name,
  drop column if exists free_shipping_synced_at;

delete from public.schema_migrations
where filename = '033_free_shipping_cache.sql';

insert into public.schema_migrations (filename)
values ('034_drop_free_shipping_cache.sql')
on conflict (filename) do nothing;
