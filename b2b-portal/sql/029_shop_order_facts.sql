-- =============================================================================
-- b2b-portal / 029_shop_order_facts.sql
-- MANUÁLISAN futtasd (Supabase SQL Editor / psql) — az app NEM futtat DDL-t.
-- Bolt-szintű rendelés-tükör a gyors /riport-hoz (nem a widget b2b_orders).
-- Előtte: 010, 013, 017 (RLS minták).
-- =============================================================================

create table if not exists public.shop_order_facts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  sr_order_id text not null,
  sr_order_inner_id text,
  date_created timestamptz not null,
  email text,
  customer_name text,
  sr_customer_inner_id integer,
  sr_group_inner_id integer,
  status_id text,
  status_name text,
  total_gross numeric(14, 2) not null default 0,
  total_net numeric(14, 2),
  shipping_gross numeric(14, 2) not null default 0,
  discount_gross numeric(14, 2) not null default 0,
  currency text not null default 'HUF',
  source_guess text
    check (source_guess is null or source_guess in ('widget', 'store')),
  raw_meta jsonb not null default '{}'::jsonb,
  lines_synced_at timestamptz,
  synced_at timestamptz not null default now(),
  constraint shop_order_facts_shop_sr unique (shop_id, sr_order_id)
);

create index if not exists idx_sof_shop_date
  on public.shop_order_facts (shop_id, date_created desc);
create index if not exists idx_sof_shop_customer
  on public.shop_order_facts (shop_id, sr_customer_inner_id);

create table if not exists public.shop_order_line_facts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  order_fact_id uuid not null
    references public.shop_order_facts (id) on delete cascade,
  sr_order_id text not null,
  sku text,
  sku_norm text,
  model_number text,
  name text,
  quantity numeric(14, 3) not null default 1,
  line_gross numeric(14, 2) not null default 0,
  line_net numeric(14, 2),
  is_fee_or_shipping boolean not null default false
);

create index if not exists idx_solf_order
  on public.shop_order_line_facts (order_fact_id);
create index if not exists idx_solf_shop_sku
  on public.shop_order_line_facts (shop_id, sku_norm);

create table if not exists public.shop_report_sync_state (
  shop_id uuid primary key
    references public.shops (id) on delete cascade,
  cursor_page integer not null default 0,
  oldest_synced_at timestamptz,
  newest_synced_at timestamptz,
  last_run_at timestamptz,
  last_error text,
  status text not null default 'idle'
    check (status in ('idle', 'running', 'error'))
);

grant select, insert, update, delete on
  public.shop_order_facts,
  public.shop_order_line_facts,
  public.shop_report_sync_state
to b2b_app, b2b_admin;

alter table public.shop_order_facts enable row level security;
alter table public.shop_order_facts force row level security;
alter table public.shop_order_line_facts enable row level security;
alter table public.shop_order_line_facts force row level security;
alter table public.shop_report_sync_state enable row level security;
alter table public.shop_report_sync_state force row level security;

drop policy if exists shop_order_facts_tenant on public.shop_order_facts;
create policy shop_order_facts_tenant on public.shop_order_facts
  for all
  using (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  )
  with check (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  );

drop policy if exists shop_order_line_facts_tenant on public.shop_order_line_facts;
create policy shop_order_line_facts_tenant on public.shop_order_line_facts
  for all
  using (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  )
  with check (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  );

drop policy if exists shop_report_sync_state_tenant on public.shop_report_sync_state;
create policy shop_report_sync_state_tenant on public.shop_report_sync_state
  for all
  using (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  )
  with check (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  );

insert into public.schema_migrations (filename)
values ('029_shop_order_facts.sql')
on conflict (filename) do nothing;
