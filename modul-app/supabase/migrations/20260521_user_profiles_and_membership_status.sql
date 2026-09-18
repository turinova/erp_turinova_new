-- Staff display name + membership active/disabled (no Auth ban).
-- Docs: tenant user management — remove/disable + profile name.

-- ---------------------------------------------------------------------------
-- tenant_memberships.status (before policies that filter on it)
-- ---------------------------------------------------------------------------
alter table public.tenant_memberships
  add column if not exists status text not null default 'active',
  add column if not exists disabled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenant_memberships_status_check'
  ) then
    alter table public.tenant_memberships
      add constraint tenant_memberships_status_check
      check (status in ('active', 'disabled'));
  end if;
end $$;

create index if not exists tenant_memberships_tenant_status_idx
  on public.tenant_memberships (tenant_id, status);

comment on column public.tenant_memberships.status is
  'active = beléphet a cégbe; disabled = tagság megmarad, access nincs (seat nem számít).';

-- ---------------------------------------------------------------------------
-- Helpers: only active memberships count as tenant access
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
      and m.status = 'active'
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
  where m.user_id = auth.uid()
    and m.status = 'active';
$$;

create or replace function public.can_manage_users(p_tenant_id uuid)
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
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

-- Manager may delete memberships (remove from company)
drop policy if exists memberships_delete_manager on public.tenant_memberships;
create policy memberships_delete_manager
  on public.tenant_memberships
  for delete
  to authenticated
  using (public.can_manage_users(tenant_id));

-- ---------------------------------------------------------------------------
-- user_profiles (1:1 auth.users — display name for staff)
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default now()
);

comment on table public.user_profiles is
  'Staff megjelenített név (tenant-független). Partner külön: partner_profiles.';

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_profiles_select_tenant_manager on public.user_profiles;
create policy user_profiles_select_tenant_manager
  on public.user_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_memberships m
      where m.user_id = user_profiles.user_id
        and public.can_manage_users(m.tenant_id)
    )
  );

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own
  on public.user_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own
  on public.user_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
