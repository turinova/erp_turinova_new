-- =============================================================================
-- b2b-portal / 013_commerce_catalog.sql
-- MANUÁLISAN futtasd — előtte: 012
-- Vékony katalógus-tükör (typeahead). Platform-agnosztikus.
-- =============================================================================

create extension if not exists "pg_trgm";

create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  platform text not null default 'shoprenter',
  external_product_id text not null,
  sku text not null,
  sku_norm text generated always as (upper(trim(sku))) stored,
  model_number text,
  model_norm text generated always as (
    nullif(upper(trim(coalesce(model_number, ''))), '')
  ) stored,
  gtin text,
  gtin_norm text generated always as (
    nullif(upper(trim(coalesce(gtin, ''))), '')
  ) stored,
  name text,
  active boolean not null default true,
  min_qty integer not null default 1,
  qty_step integer not null default 1,
  cost_net numeric(14, 2),
  list_price_net numeric(14, 2),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_catalog_shop_sku_unique unique (shop_id, sku_norm),
  constraint product_catalog_shop_external_unique unique (shop_id, external_product_id)
);

create index if not exists idx_product_catalog_shop_active
  on public.product_catalog (shop_id)
  where active;
create index if not exists idx_product_catalog_shop_model
  on public.product_catalog (shop_id, model_norm)
  where model_norm is not null;
create index if not exists idx_product_catalog_shop_gtin
  on public.product_catalog (shop_id, gtin_norm)
  where gtin_norm is not null;

drop trigger if exists trg_product_catalog_updated_at on public.product_catalog;
create trigger trg_product_catalog_updated_at
  before update on public.product_catalog
  for each row execute function public.set_updated_at();

insert into public.schema_migrations (filename)
values ('013_commerce_catalog.sql')
on conflict (filename) do nothing;
