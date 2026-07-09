-- =============================================================================
-- Építő Ártükör — Auth alap (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- 1. Futtasd ezt a teljes scriptet
-- 2. Supabase Dashboard → Authentication → Users → Add user (email + jelszó)
-- 3. Futtasd a lenti „Első felhasználó összekötése” blokkot (e-mail cserével)
-- 4. Add hozzá a .env.local-hoz:
--    NEXT_PUBLIC_SUPABASE_URL=...
--    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Organizations (tenant / cég — egy DB, org_id izoláció későbbi táblákhoz)
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_slug on public.organizations (slug);

-- -----------------------------------------------------------------------------
-- Profiles (auth.users kiterjesztés)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles (email);

-- -----------------------------------------------------------------------------
-- Organization members (user ↔ cég, SaaS multi-user alap)
-- -----------------------------------------------------------------------------
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_organization_members_user on public.organization_members (user_id);
create index if not exists idx_organization_members_org on public.organization_members (organization_id);

-- -----------------------------------------------------------------------------
-- Auto profile on signup
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at
  before update on public.organizations
  for each row
  execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;

-- Profiles: own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Organization members: own memberships
drop policy if exists "organization_members_select_own" on public.organization_members;
create policy "organization_members_select_own"
  on public.organization_members for select
  using (auth.uid() = user_id);

-- Organizations: only orgs the user belongs to
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Seed: demo organization (idempotens)
-- -----------------------------------------------------------------------------
insert into public.organizations (name, slug)
values ('Demo Építő Kft.', 'demo')
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- ELSŐ FELHASZNÁLÓ ÖSSZEKÖTÉSE (auth user létrehozása után futtasd!)
-- Cseréld: kovacs.peter@vallalat.hu → a Supabase Auth-ban létrehozott e-mail
-- -----------------------------------------------------------------------------
/*
insert into public.organization_members (organization_id, user_id, role)
select o.id, u.id, 'owner'
from public.organizations o
cross join auth.users u
where o.slug = 'demo'
  and u.email = 'kovacs.peter@vallalat.hu'
on conflict (organization_id, user_id) do nothing;
*/

-- Ellenőrzés:
-- select u.email, o.name, om.role
-- from organization_members om
-- join auth.users u on u.id = om.user_id
-- join organizations o on o.id = om.organization_id;
