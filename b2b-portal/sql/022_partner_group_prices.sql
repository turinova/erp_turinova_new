-- =============================================================================
-- b2b-portal / 022_partner_group_prices.sql
-- Shoprenter customerGroupProductPrices tükör — /arak read path = Postgres.
-- MANUÁLISAN futtasd — előtte: 021 + 017 (RLS minta)
-- =============================================================================

create table if not exists public.partner_group_prices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  customer_group_outer_id text not null,
  product_inner_id integer not null,
  price_net numeric(14, 2) not null,
  sr_price_id text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_group_prices_unique
    unique (shop_id, customer_group_outer_id, product_inner_id),
  constraint partner_group_prices_inner_positive
    check (product_inner_id > 0)
);

create index if not exists idx_partner_group_prices_shop_group
  on public.partner_group_prices (shop_id, customer_group_outer_id);

create index if not exists idx_partner_group_prices_shop_group_product
  on public.partner_group_prices (shop_id, customer_group_outer_id, product_inner_id);

create table if not exists public.partner_group_price_sync (
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  customer_group_outer_id text not null,
  synced_at timestamptz not null default now(),
  row_count integer not null default 0,
  last_error text,
  primary key (shop_id, customer_group_outer_id)
);

drop trigger if exists trg_partner_group_prices_updated_at
  on public.partner_group_prices;
create trigger trg_partner_group_prices_updated_at
  before update on public.partner_group_prices
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on
  public.partner_group_prices,
  public.partner_group_price_sync
to b2b_app, b2b_admin;

alter table public.partner_group_prices enable row level security;
alter table public.partner_group_prices force row level security;
alter table public.partner_group_price_sync enable row level security;
alter table public.partner_group_price_sync force row level security;

drop policy if exists partner_group_prices_tenant on public.partner_group_prices;
create policy partner_group_prices_tenant on public.partner_group_prices
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

drop policy if exists partner_group_price_sync_tenant
  on public.partner_group_price_sync;
create policy partner_group_price_sync_tenant on public.partner_group_price_sync
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
values ('022_partner_group_prices.sql')
on conflict (filename) do nothing;
