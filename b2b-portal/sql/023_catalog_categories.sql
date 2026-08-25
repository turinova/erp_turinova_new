-- =============================================================================
-- b2b-portal / 023_catalog_categories.sql
-- Shoprenter kategóriák + termék↔kategória (M:N) — /arak szűrés + bulk.
-- MANUÁLISAN futtasd — előtte: 022 + 017 (RLS minta)
-- =============================================================================

create table if not exists public.catalog_categories (
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  category_inner_id integer not null,
  name text,
  parent_inner_id integer,
  synced_at timestamptz not null default now(),
  primary key (shop_id, category_inner_id),
  constraint catalog_categories_inner_positive
    check (category_inner_id > 0)
);

create index if not exists idx_catalog_categories_shop_parent
  on public.catalog_categories (shop_id, parent_inner_id)
  where parent_inner_id is not null;

create table if not exists public.product_catalog_categories (
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  product_inner_id integer not null,
  category_inner_id integer not null,
  synced_at timestamptz not null default now(),
  primary key (shop_id, product_inner_id, category_inner_id),
  constraint product_catalog_categories_product_positive
    check (product_inner_id > 0),
  constraint product_catalog_categories_cat_positive
    check (category_inner_id > 0)
);

create index if not exists idx_pcc_shop_category
  on public.product_catalog_categories (shop_id, category_inner_id);

create index if not exists idx_pcc_shop_product
  on public.product_catalog_categories (shop_id, product_inner_id);

grant select, insert, update, delete on
  public.catalog_categories,
  public.product_catalog_categories
to b2b_app, b2b_admin;

alter table public.catalog_categories enable row level security;
alter table public.catalog_categories force row level security;
alter table public.product_catalog_categories enable row level security;
alter table public.product_catalog_categories force row level security;

drop policy if exists catalog_categories_tenant on public.catalog_categories;
create policy catalog_categories_tenant on public.catalog_categories
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

drop policy if exists product_catalog_categories_tenant
  on public.product_catalog_categories;
create policy product_catalog_categories_tenant
  on public.product_catalog_categories
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
values ('023_catalog_categories.sql')
on conflict (filename) do nothing;
