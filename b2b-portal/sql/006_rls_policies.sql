-- =============================================================================
-- b2b-portal / 006_rls_policies.sql
-- Row Level Security — MANUÁLISAN futtasd — előtte: 001–005
--
-- App connection: NE superuser legyen.
-- Tranzakciónként: select set_config('app.organization_id', '<uuid>', true);
-- Platform admin / migráció: owner szerep vagy b2b_admin (bypass policy külön).
-- =============================================================================

-- Alkalmazás role (ha még nincs) — jelszót TE állítod / grantolod
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'b2b_app') then
    create role b2b_app nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'b2b_admin') then
    create role b2b_admin nologin;
  end if;
end
$$;

grant usage on schema public to b2b_app, b2b_admin;
grant select, insert, update, delete on all tables in schema public to b2b_app, b2b_admin;
grant usage, select on all sequences in schema public to b2b_app, b2b_admin;
alter default privileges in schema public
  grant select, insert, update, delete on tables to b2b_app, b2b_admin;

-- Helper: aktuális org (üres → semmi sem látszik a tenant policyk alatt)
create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.organization_id', true), '')::uuid;
$$;

create or replace function public.is_b2b_admin()
returns boolean
language sql
stable
as $$
  select pg_has_role(current_user, 'b2b_admin', 'member')
    or current_setting('app.is_platform_admin', true) = 'true';
$$;

-- -----------------------------------------------------------------------------
-- Enable + FORCE RLS
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.invitations enable row level security;
alter table public.invitations force row level security;
alter table public.shops enable row level security;
alter table public.shops force row level security;
alter table public.shop_credentials enable row level security;
alter table public.shop_credentials force row level security;
alter table public.shop_allowed_origins enable row level security;
alter table public.shop_allowed_origins force row level security;
alter table public.widget_settings enable row level security;
alter table public.widget_settings force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

-- users + sessions: saját sor / admin — külön policy
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.sessions enable row level security;
alter table public.sessions force row level security;

-- -----------------------------------------------------------------------------
-- Drop old policies (idempotent re-run)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organizations','memberships','invitations','shops','shop_credentials',
        'shop_allowed_origins','widget_settings','audit_events','users','sessions'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end
$$;

-- organizations
create policy organizations_tenant on public.organizations
  for all
  using (
    public.is_b2b_admin()
    or id = public.current_org_id()
  )
  with check (
    public.is_b2b_admin()
    or id = public.current_org_id()
  );

-- memberships
create policy memberships_tenant on public.memberships
  for all
  using (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  )
  with check (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  );

-- invitations
create policy invitations_tenant on public.invitations
  for all
  using (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  )
  with check (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  );

-- shops
create policy shops_tenant on public.shops
  for all
  using (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  )
  with check (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  );

-- shop_credentials via shop
create policy shop_credentials_tenant on public.shop_credentials
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

create policy shop_allowed_origins_tenant on public.shop_allowed_origins
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

create policy widget_settings_tenant on public.widget_settings
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

create policy audit_events_tenant on public.audit_events
  for all
  using (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
  )
  with check (
    public.is_b2b_admin()
    or organization_id = public.current_org_id()
    or organization_id is null and public.is_b2b_admin()
  );

-- users: saját rekord VAGY admin; login lookuphoz app gyakran bypass role-lal megy
create policy users_self_or_admin on public.users
  for all
  using (
    public.is_b2b_admin()
    or id::text = nullif(current_setting('app.user_id', true), '')
  )
  with check (
    public.is_b2b_admin()
    or id::text = nullif(current_setting('app.user_id', true), '')
  );

create policy sessions_self_or_admin on public.sessions
  for all
  using (
    public.is_b2b_admin()
    or user_id::text = nullif(current_setting('app.user_id', true), '')
  )
  with check (
    public.is_b2b_admin()
    or user_id::text = nullif(current_setting('app.user_id', true), '')
  );

-- schema_migrations: csak admin olvas (opcionális)
alter table public.schema_migrations enable row level security;
alter table public.schema_migrations force row level security;
drop policy if exists schema_migrations_admin on public.schema_migrations;
create policy schema_migrations_admin on public.schema_migrations
  for all
  using (public.is_b2b_admin())
  with check (public.is_b2b_admin());

insert into public.schema_migrations (filename)
values ('006_rls_policies.sql')
on conflict (filename) do nothing;
