-- =============================================================================
-- b2b-portal / 037_shop_bootstrap.sql
-- MANUÁLISAN futtasd — előtte: 014, 029 ajánlott
-- Egységes bolt-bekötés utáni első betöltés (bootstrap) státusz
-- =============================================================================

alter table public.shops
  add column if not exists bootstrap_status text not null default 'pending',
  add column if not exists bootstrap_started_at timestamptz,
  add column if not exists bootstrap_ready_at timestamptz,
  add column if not exists bootstrap_error text,
  add column if not exists bootstrap_groups_at timestamptz,
  add column if not exists bootstrap_orders_kicked_at timestamptz;

alter table public.shops
  drop constraint if exists shops_bootstrap_status_check;

alter table public.shops
  add constraint shops_bootstrap_status_check
  check (bootstrap_status in ('pending', 'running', 'ready', 'error'));

insert into public.schema_migrations (filename)
values ('037_shop_bootstrap.sql')
on conflict (filename) do nothing;
