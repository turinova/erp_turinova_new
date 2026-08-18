-- =============================================================================
-- b2b-portal / 014_sync_jobs.sql
-- MANUÁLISAN futtasd — előtte: 013
-- Katalógus sync worker: jobs, cursors, shop catalog status
-- =============================================================================

alter table public.shops
  add column if not exists platform text not null default 'shoprenter',
  add column if not exists catalog_status text not null default 'pending',
  add column if not exists catalog_product_count integer not null default 0,
  add column if not exists catalog_ready_at timestamptz,
  add column if not exists catalog_synced_at timestamptz,
  add column if not exists catalog_error text,
  add column if not exists purged_at timestamptz;

alter table public.shops
  drop constraint if exists shops_catalog_status_check;
alter table public.shops
  add constraint shops_catalog_status_check
  check (catalog_status in (
    'pending',
    'syncing',
    'ready',
    'degraded',
    'error',
    'blocked_limit'
  ));

alter table public.shops
  drop constraint if exists shops_catalog_product_count_check;
alter table public.shops
  add constraint shops_catalog_product_count_check
  check (catalog_product_count >= 0);

create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  kind text not null
    check (kind in ('full', 'incremental')),
  status text not null default 'queued'
    check (status in (
      'queued',
      'running',
      'succeeded',
      'failed',
      'cancelled',
      'blocked_limit'
    )),
  pages_done integer not null default 0,
  pages_total integer,
  products_upserted integer not null default 0,
  error_code text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_jobs_shop_created
  on public.sync_jobs (shop_id, created_at desc);
create index if not exists idx_sync_jobs_org_status
  on public.sync_jobs (organization_id, status);

-- Shoponként legfeljebb egy queued|running job
create unique index if not exists idx_sync_jobs_one_active_per_shop
  on public.sync_jobs (shop_id)
  where status in ('queued', 'running');

create table if not exists public.sync_cursors (
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  resource text not null default 'products',
  cursor text,
  watermark timestamptz,
  updated_at timestamptz not null default now(),
  primary key (shop_id, resource)
);

insert into public.schema_migrations (filename)
values ('014_sync_jobs.sql')
on conflict (filename) do nothing;
