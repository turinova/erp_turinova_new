-- =============================================================================
-- b2b-portal / 025_partner_volume_tiers.sql
-- Shoprenter productSpecials (mennyiségi sáv) tükör — /arak lista „N sáv” badge.
-- MANUÁLISAN futtasd — előtte: 022 (RLS minta) + 017
-- =============================================================================

create table if not exists public.partner_volume_tiers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  customer_group_outer_id text not null,
  product_inner_id integer not null,
  min_qty integer not null,
  price_net numeric(14, 2) not null,
  max_qty integer,
  sr_special_id text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_volume_tiers_unique
    unique (shop_id, customer_group_outer_id, product_inner_id, min_qty),
  constraint partner_volume_tiers_inner_positive
    check (product_inner_id > 0),
  constraint partner_volume_tiers_min_qty_positive
    check (min_qty >= 1),
  constraint partner_volume_tiers_price_nonneg
    check (price_net >= 0)
);

create index if not exists idx_partner_volume_tiers_shop_group
  on public.partner_volume_tiers (shop_id, customer_group_outer_id);

create index if not exists idx_partner_volume_tiers_shop_group_product
  on public.partner_volume_tiers (
    shop_id, customer_group_outer_id, product_inner_id
  );

drop trigger if exists trg_partner_volume_tiers_updated_at
  on public.partner_volume_tiers;
create trigger trg_partner_volume_tiers_updated_at
  before update on public.partner_volume_tiers
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on
  public.partner_volume_tiers
to b2b_app, b2b_admin;

alter table public.partner_volume_tiers enable row level security;
alter table public.partner_volume_tiers force row level security;

drop policy if exists partner_volume_tiers_tenant on public.partner_volume_tiers;
create policy partner_volume_tiers_tenant on public.partner_volume_tiers
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
values ('025_partner_volume_tiers.sql')
on conflict (filename) do nothing;
