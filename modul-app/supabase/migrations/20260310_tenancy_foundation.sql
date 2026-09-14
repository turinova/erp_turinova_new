-- modul-app SaaS tenancy foundation
-- Futtasd a Supabase SQL Editorben (vagy CLI migration).
-- Shared schema + RLS — lásd docs/17-saas-architecture.md + docs/19-supabase-setup.md

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status text not null default 'active'
    check (status in ('provisioning', 'active', 'read_only', 'suspended', 'churned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_unique unique (slug)
);

create index if not exists tenants_status_idx on public.tenants (status);

-- ---------------------------------------------------------------------------
-- Memberships (user ↔ tenant + role)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  constraint tenant_memberships_tenant_user_unique unique (tenant_id, user_id)
);

create index if not exists tenant_memberships_user_id_idx
  on public.tenant_memberships (user_id);

create index if not exists tenant_memberships_tenant_id_idx
  on public.tenant_memberships (tenant_id);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER — RLS-ben használható)
-- ---------------------------------------------------------------------------
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.tenant_id
  from public.tenant_memberships m
  where m.user_id = auth.uid();
$$;

revoke all on function public.is_tenant_member(uuid) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;

revoke all on function public.user_tenant_ids() from public;
grant execute on function public.user_tenant_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;

drop policy if exists tenants_select_member on public.tenants;
create policy tenants_select_member
  on public.tenants
  for select
  to authenticated
  using (public.is_tenant_member(id));

drop policy if exists memberships_select_own on public.tenant_memberships;
create policy memberships_select_own
  on public.tenant_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- Írás V1-ben: service role / SQL seed (nincs self-serve tenant create még)
-- Később: owner meghívó flow → insert policy

comment on table public.tenants is 'SaaS cégek / előfizetők (shared DB)';
comment on table public.tenant_memberships is 'User tagság egy tenantban + szerepkör';
