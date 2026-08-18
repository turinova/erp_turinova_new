-- =============================================================================
-- b2b-portal / 002_tenancy_auth.sql
-- Organizations, users, memberships, invitations, sessions
-- MANUÁLISAN futtasd — előtte: 001
-- =============================================================================

-- -----------------------------------------------------------------------------
-- organizations (tenant)
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status text not null default 'trial'
    check (status in ('trial', 'active', 'suspended')),
  plan text not null default 'starter'
    check (plan in ('starter', 'pro')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_unique unique (slug)
);

create index if not exists idx_organizations_status
  on public.organizations (status);

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- users (app-owned identity — invite-only; NEM auth.users kényszer)
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text,
  display_name text,
  is_platform_admin boolean not null default false,
  last_login_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_unique unique (email)
);

-- Email mindig lower(trim) az app rétegben; DB check soft:
alter table public.users
  drop constraint if exists users_email_lowercase;
alter table public.users
  add constraint users_email_lowercase check (email = lower(email));

create index if not exists idx_users_platform_admin
  on public.users (is_platform_admin)
  where is_platform_admin = true;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- memberships (role az org tagságon)
-- -----------------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  user_id uuid not null
    references public.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  constraint memberships_org_user_unique unique (organization_id, user_id)
);

create index if not exists idx_memberships_user
  on public.memberships (user_id);
create index if not exists idx_memberships_org
  on public.memberships (organization_id);

-- -----------------------------------------------------------------------------
-- invitations
-- -----------------------------------------------------------------------------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'member')),
  token_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id uuid
    references public.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_token_hash_unique unique (token_hash),
  constraint invitations_email_lowercase check (email = lower(email))
);

create index if not exists idx_invitations_org
  on public.invitations (organization_id);
create index if not exists idx_invitations_email
  on public.invitations (email);
create index if not exists idx_invitations_status
  on public.invitations (status);

-- Egy pending invite / org+email
create unique index if not exists idx_invitations_one_pending_per_org_email
  on public.invitations (organization_id, email)
  where status = 'pending';

-- -----------------------------------------------------------------------------
-- sessions
-- -----------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.users (id) on delete cascade,
  active_organization_id uuid
    references public.organizations (id) on delete set null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user
  on public.sessions (user_id);
create index if not exists idx_sessions_expires
  on public.sessions (expires_at)
  where revoked_at is null;

insert into public.schema_migrations (filename)
values ('002_tenancy_auth.sql')
on conflict (filename) do nothing;
