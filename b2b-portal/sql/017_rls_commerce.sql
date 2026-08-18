-- =============================================================================
-- b2b-portal / 017_rls_commerce.sql
-- MANUÁLISAN futtasd — előtte: 006 + 013–016
-- Tenant isolation: shop → organization_id (011 mintája)
-- =============================================================================

grant select, insert, update, delete on
  public.product_catalog,
  public.sync_jobs,
  public.sync_cursors,
  public.plan_defaults,
  public.organization_stats,
  public.widget_opens
to b2b_app, b2b_admin;

alter table public.product_catalog enable row level security;
alter table public.product_catalog force row level security;
alter table public.sync_jobs enable row level security;
alter table public.sync_jobs force row level security;
alter table public.sync_cursors enable row level security;
alter table public.sync_cursors force row level security;
alter table public.organization_stats enable row level security;
alter table public.organization_stats force row level security;
alter table public.widget_opens enable row level security;
alter table public.widget_opens force row level security;

-- plan_defaults: globális referencia — minden app role olvashatja, csak admin ír
alter table public.plan_defaults enable row level security;
alter table public.plan_defaults force row level security;

drop policy if exists product_catalog_tenant on public.product_catalog;
create policy product_catalog_tenant on public.product_catalog
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

drop policy if exists sync_jobs_tenant on public.sync_jobs;
create policy sync_jobs_tenant on public.sync_jobs
  for all
  using (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  )
  with check (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  );

drop policy if exists sync_cursors_tenant on public.sync_cursors;
create policy sync_cursors_tenant on public.sync_cursors
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

drop policy if exists organization_stats_tenant on public.organization_stats;
create policy organization_stats_tenant on public.organization_stats
  for all
  using (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  )
  with check (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  );

drop policy if exists widget_opens_tenant on public.widget_opens;
create policy widget_opens_tenant on public.widget_opens
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

drop policy if exists plan_defaults_read on public.plan_defaults;
create policy plan_defaults_read on public.plan_defaults
  for select
  using (true);

drop policy if exists plan_defaults_write_admin on public.plan_defaults;
create policy plan_defaults_write_admin on public.plan_defaults
  for all
  using (public.is_b2b_admin())
  with check (public.is_b2b_admin());

grant execute on function public.effective_partner_limit(uuid) to b2b_app, b2b_admin;
grant execute on function public.effective_sku_limit(uuid) to b2b_app, b2b_admin;
grant execute on function public.count_active_partners_month(uuid, timestamptz) to b2b_app, b2b_admin;
grant execute on function public.count_active_partners_month_by_shop(uuid, timestamptz) to b2b_app, b2b_admin;

insert into public.schema_migrations (filename)
values ('017_rls_commerce.sql')
on conflict (filename) do nothing;
