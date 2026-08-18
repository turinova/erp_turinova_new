-- =============================================================================
-- b2b-portal / 015_org_stats_and_limits.sql
-- MANUÁLISAN futtasd — előtte: 014
-- Plan enum (start|grow|pro|scale), limitek, organization_stats
-- Launch: nincs Free tier. Trial status külön (organizations.status).
-- =============================================================================

-- Régi starter → start (002_tenancy_auth.sql check)
alter table public.organizations
  drop constraint if exists organizations_plan_check;

update public.organizations
set plan = 'start'
where plan = 'starter';

alter table public.organizations
  alter column plan set default 'start';

alter table public.organizations
  add constraint organizations_plan_check
  check (plan in ('start', 'grow', 'pro', 'scale'));

alter table public.organizations
  add column if not exists partner_limit_override integer,
  add column if not exists sku_limit_override integer;

alter table public.organizations
  drop constraint if exists organizations_partner_limit_override_check;
alter table public.organizations
  add constraint organizations_partner_limit_override_check
  check (partner_limit_override is null or partner_limit_override > 0);

alter table public.organizations
  drop constraint if exists organizations_sku_limit_override_check;
alter table public.organizations
  add constraint organizations_sku_limit_override_check
  check (sku_limit_override is null or sku_limit_override > 0);

create table if not exists public.plan_defaults (
  plan text primary key
    check (plan in ('start', 'grow', 'pro', 'scale')),
  partner_limit integer not null,
  sku_limit integer not null,
  list_price_huf integer not null,
  updated_at timestamptz not null default now()
);

insert into public.plan_defaults (plan, partner_limit, sku_limit, list_price_huf)
values
  ('start', 15, 15000, 14900),
  ('grow', 30, 40000, 34900),
  ('pro', 80, 80000, 69900),
  ('scale', 200, 150000, 139900)
on conflict (plan) do update
set
  partner_limit = excluded.partner_limit,
  sku_limit = excluded.sku_limit,
  list_price_huf = excluded.list_price_huf,
  updated_at = now();

create table if not exists public.organization_stats (
  organization_id uuid primary key
    references public.organizations (id) on delete cascade,
  sku_count integer not null default 0,
  sku_limit integer not null default 15000,
  active_partners_month integer not null default 0,
  partner_limit integer not null default 15,
  widget_opens_month integer not null default 0,
  shops_count integer not null default 0,
  widget_enabled_any boolean not null default false,
  widget_hits_24h integer not null default 0,
  search_count_24h integer not null default 0,
  orders_24h integer not null default 0,
  last_activity_at timestamptz,
  worst_catalog_status text,
  health text not null default 'ok'
    check (health in ('ok', 'warn', 'crit')),
  updated_at timestamptz not null default now()
);

insert into public.schema_migrations (filename)
values ('015_org_stats_and_limits.sql')
on conflict (filename) do nothing;
