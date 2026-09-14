-- modul-app: plan + add-on entitlements (manuális platform kapcsolás)
-- Option A: plan szerkesztés csak a katalógust írja; tenant anyagiasítás
-- külön „Alkalmaz” / create / add-on toggle.

-- ---------------------------------------------------------------------------
-- Feature katalógus (V1: feature_key ≈ page_key)
-- ---------------------------------------------------------------------------
create table if not exists public.product_features (
  key text primary key,
  label text not null,
  category text not null,
  page_key text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.product_features is
  'Termék feature katalógus — oldal vagy képesség kulcs.';

alter table public.product_features enable row level security;

drop policy if exists product_features_select on public.product_features;
create policy product_features_select
  on public.product_features
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Planok
-- ---------------------------------------------------------------------------
create table if not exists public.product_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_plans_one_default_idx
  on public.product_plans ((is_default))
  where is_default = true;

alter table public.product_plans enable row level security;

drop policy if exists product_plans_select on public.product_plans;
create policy product_plans_select
  on public.product_plans
  for select
  to authenticated
  using (true);

create table if not exists public.product_plan_features (
  plan_id uuid not null references public.product_plans (id) on delete cascade,
  feature_key text not null references public.product_features (key) on delete cascade,
  primary key (plan_id, feature_key)
);

alter table public.product_plan_features enable row level security;

drop policy if exists product_plan_features_select on public.product_plan_features;
create policy product_plan_features_select
  on public.product_plan_features
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Add-onok
-- ---------------------------------------------------------------------------
create table if not exists public.product_addons (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_addons enable row level security;

drop policy if exists product_addons_select on public.product_addons;
create policy product_addons_select
  on public.product_addons
  for select
  to authenticated
  using (true);

create table if not exists public.product_addon_features (
  addon_id uuid not null references public.product_addons (id) on delete cascade,
  feature_key text not null references public.product_features (key) on delete cascade,
  primary key (addon_id, feature_key)
);

alter table public.product_addon_features enable row level security;

drop policy if exists product_addon_features_select on public.product_addon_features;
create policy product_addon_features_select
  on public.product_addon_features
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Tenant plan + materializált entitlement + bekapcsolt add-onok
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists plan_id uuid references public.product_plans (id);

create table if not exists public.tenant_addons (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  addon_id uuid not null references public.product_addons (id) on delete cascade,
  enabled_at timestamptz not null default now(),
  enabled_by uuid references auth.users (id) on delete set null,
  primary key (tenant_id, addon_id)
);

alter table public.tenant_addons enable row level security;

drop policy if exists tenant_addons_select on public.tenant_addons;
create policy tenant_addons_select
  on public.tenant_addons
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

create table if not exists public.tenant_entitlements (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  feature_key text not null references public.product_features (key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

create index if not exists tenant_entitlements_feature_idx
  on public.tenant_entitlements (feature_key);

alter table public.tenant_entitlements enable row level security;

drop policy if exists tenant_entitlements_select on public.tenant_entitlements;
create policy tenant_entitlements_select
  on public.tenant_entitlements
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

-- Audit (platform manuális kapcsolások)
create table if not exists public.entitlement_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists entitlement_audit_log_tenant_idx
  on public.entitlement_audit_log (tenant_id, created_at desc);

alter table public.entitlement_audit_log enable row level security;

drop policy if exists entitlement_audit_select_platform on public.entitlement_audit_log;
create policy entitlement_audit_select_platform
  on public.entitlement_audit_log
  for select
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Seed: mai APP_PAGES → features + Alap plan
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order)
values
  ('/home', 'Kezdőlap', 'Fő', '/home', 10),
  ('/kereso', 'Kereső', 'Fő', '/kereso', 20),
  ('/opti', 'Opti', 'Műhely', '/opti', 30),
  ('/ugyfelek', 'Ügyfelek', 'Műhely', '/ugyfelek', 40),
  ('/ajanlatok', 'Árajánlatok', 'Műhely', '/ajanlatok', 50),
  ('/megrendelesek', 'Megrendelések', 'Műhely', '/megrendelesek', 60),
  ('/torzsadatok/alapanyagok/tablas-anyagok', 'Táblás anyagok', 'Törzsadatok', '/torzsadatok/alapanyagok/tablas-anyagok', 70),
  ('/torzsadatok/alapanyagok/elzarok', 'Élzárók', 'Törzsadatok', '/torzsadatok/alapanyagok/elzarok', 80),
  ('/torzsadatok/rendszer/adonem', 'Adónem', 'Törzsadatok', '/torzsadatok/rendszer/adonem', 90),
  ('/torzsadatok/rendszer/fizetesi-modok', 'Fizetési módok', 'Törzsadatok', '/torzsadatok/rendszer/fizetesi-modok', 100),
  ('/torzsadatok/rendszer/egysegek', 'Egységek', 'Törzsadatok', '/torzsadatok/rendszer/egysegek', 110),
  ('/torzsadatok/rendszer/dij-tipusok', 'Díj típusok', 'Törzsadatok', '/torzsadatok/rendszer/dij-tipusok', 120),
  ('/torzsadatok/rendszer/gyartok', 'Gyártók', 'Törzsadatok', '/torzsadatok/rendszer/gyartok', 130),
  ('/torzsadatok/rendszer/berendezes', 'Berendezés', 'Törzsadatok', '/torzsadatok/rendszer/berendezes', 140),
  ('/torzsadatok/rendszer/gyartogepek', 'Gyártógépek', 'Törzsadatok', '/torzsadatok/rendszer/gyartogepek', 150),
  ('/beallitasok/cegadatok', 'Cégadatok', 'Beállítások', '/beallitasok/cegadatok', 160),
  ('/beallitasok/opti', 'Opti beállítások', 'Beállítások', '/beallitasok/opti', 170),
  ('/beallitasok/felhasznalok', 'Felhasználók', 'Beállítások', '/beallitasok/felhasznalok', 180)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_plans (key, name, description, is_default)
values (
  'alap',
  'Alap',
  'Alap Optinova csomag — jelenleg a teljes modulkészlet.',
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  is_default = true,
  updated_at = now();

insert into public.product_plan_features (plan_id, feature_key)
select p.id, f.key
from public.product_plans p
cross join public.product_features f
where p.key = 'alap'
  and f.active = true
on conflict do nothing;

-- Meglévő tenantok → Alap plan + materializált entitlement
update public.tenants t
set plan_id = p.id
from public.product_plans p
where p.key = 'alap'
  and t.plan_id is null;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, pf.feature_key
from public.tenants t
join public.product_plans p on p.id = t.plan_id
join public.product_plan_features pf on pf.plan_id = p.id
on conflict do nothing;
