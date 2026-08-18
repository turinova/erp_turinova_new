-- =============================================================================
-- b2b-portal / 009_shop_customers.sql
-- MANUÁLISAN futtasd — előtte: 008
-- Vékony ujjlenyomat (NEM full CRM sync) — touch / átrakás / widget fact
-- =============================================================================

create table if not exists public.shop_customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  sr_customer_inner_id integer not null,
  sr_customer_id text,
  email text,
  name_snapshot text,
  phone_snapshot text,
  tax_number_snapshot text,
  sr_group_inner_id integer,
  sr_group_name_snapshot text,
  sr_status text not null default 'active'
    check (sr_status in ('active', 'missing', 'deleted')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_customers_unique
    unique (shop_id, sr_customer_inner_id)
);

create index if not exists idx_shop_customers_shop_email
  on public.shop_customers (shop_id, lower(email));
create index if not exists idx_shop_customers_shop_seen
  on public.shop_customers (shop_id, last_seen_at desc);
create index if not exists idx_shop_customers_shop_status
  on public.shop_customers (shop_id, sr_status);

drop trigger if exists trg_shop_customers_updated_at on public.shop_customers;
create trigger trg_shop_customers_updated_at
  before update on public.shop_customers
  for each row execute function public.set_updated_at();

insert into public.schema_migrations (filename)
values ('009_shop_customers.sql')
on conflict (filename) do nothing;
