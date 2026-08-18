-- =============================================================================
-- b2b-portal / 010_b2b_orders.sql
-- MANUÁLISAN futtasd — előtte: 009
-- Widget / B2B fact + átrakás history (riport / későbbi ERP gerinc)
-- =============================================================================

create table if not exists public.b2b_orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  shop_customer_id uuid
    references public.shop_customers (id) on delete set null,
  email_snapshot text,
  name_snapshot text,
  sr_customer_inner_id integer,
  sr_group_inner_id integer,
  sr_group_name_snapshot text,
  currency text not null default 'HUF',
  net_total numeric(14, 2),
  gross_total numeric(14, 2),
  vat_total numeric(14, 2),
  line_count integer not null default 0,
  lines jsonb not null default '[]'::jsonb,
  source text not null default 'widget'
    check (source in ('widget', 'manual', 'import')),
  sr_order_id text,
  status text not null default 'recorded'
    check (status in ('recorded', 'linked', 'cancelled', 'anonymized')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_b2b_orders_shop_created
  on public.b2b_orders (shop_id, created_at desc);
create index if not exists idx_b2b_orders_shop_customer
  on public.b2b_orders (shop_id, shop_customer_id);
create index if not exists idx_b2b_orders_email
  on public.b2b_orders (shop_id, lower(email_snapshot));

create table if not exists public.shop_customer_group_moves (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  shop_customer_id uuid
    references public.shop_customers (id) on delete set null,
  sr_customer_inner_id integer not null,
  email_snapshot text,
  from_group_inner_id integer,
  from_group_name text,
  to_group_inner_id integer not null,
  to_group_name text,
  actor_user_id uuid
    references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_scgm_moves_shop_created
  on public.shop_customer_group_moves (shop_id, created_at desc);

insert into public.schema_migrations (filename)
values ('010_b2b_orders.sql')
on conflict (filename) do nothing;
