-- =============================================================================
-- b2b-portal / 011_rls_customers.sql
-- MANUÁLISAN futtasd — előtte: 006 + 008–010
-- SaaS tenant isolation via shops.organization_id
-- =============================================================================

grant select, insert, update, delete on
  public.shop_customer_group_map,
  public.shop_customers,
  public.b2b_orders,
  public.shop_customer_group_moves
to b2b_app, b2b_admin;

alter table public.shop_customer_group_map enable row level security;
alter table public.shop_customer_group_map force row level security;
alter table public.shop_customers enable row level security;
alter table public.shop_customers force row level security;
alter table public.b2b_orders enable row level security;
alter table public.b2b_orders force row level security;
alter table public.shop_customer_group_moves enable row level security;
alter table public.shop_customer_group_moves force row level security;

drop policy if exists scgm_tenant on public.shop_customer_group_map;
create policy scgm_tenant on public.shop_customer_group_map
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

drop policy if exists shop_customers_tenant on public.shop_customers;
create policy shop_customers_tenant on public.shop_customers
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

drop policy if exists b2b_orders_tenant on public.b2b_orders;
create policy b2b_orders_tenant on public.b2b_orders
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

drop policy if exists scgm_moves_tenant on public.shop_customer_group_moves;
create policy scgm_moves_tenant on public.shop_customer_group_moves
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
values ('011_rls_customers.sql')
on conflict (filename) do nothing;
