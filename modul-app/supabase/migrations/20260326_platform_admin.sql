-- modul-app: Turinova Platform admin + tenant onboarding checklist
-- Futtasd a tenancy foundation után.

-- ---------------------------------------------------------------------------
-- platform_admins (Turinova belső — nem tenant membership)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- Saját sor olvasható (session check)
drop policy if exists platform_admins_select_own on public.platform_admins;
create policy platform_admins_select_own
  on public.platform_admins
  for select
  to authenticated
  using (user_id = auth.uid() and active = true);

comment on table public.platform_admins is
  'Turinova platform operátorok (Optinova SaaS admin).';

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins p
    where p.user_id = auth.uid()
      and p.active = true
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- tenant_onboarding checklist
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_onboarding (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  company_profile_done boolean not null default false,
  first_login_at timestamptz,
  has_sheet_material boolean not null default false,
  has_edge_material boolean not null default false,
  has_quote boolean not null default false,
  has_order boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.tenant_onboarding enable row level security;

drop policy if exists tenant_onboarding_select_member on public.tenant_onboarding;
create policy tenant_onboarding_select_member
  on public.tenant_onboarding
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

drop policy if exists tenant_onboarding_update_writer on public.tenant_onboarding;
create policy tenant_onboarding_update_writer
  on public.tenant_onboarding
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id) or public.is_platform_admin())
  with check (public.can_write_tenant(tenant_id) or public.is_platform_admin());

drop policy if exists tenant_onboarding_insert_writer on public.tenant_onboarding;
create policy tenant_onboarding_insert_writer
  on public.tenant_onboarding
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id) or public.is_platform_admin());

comment on table public.tenant_onboarding is
  'Tenant onboarding checklist — platform + tenant app frissíti.';

-- Backfill onboarding rows for existing tenants
insert into public.tenant_onboarding (tenant_id)
select t.id
from public.tenants t
on conflict (tenant_id) do nothing;

-- Seed: add current demo owner as platform admin if exists
insert into public.platform_admins (user_id, name, active)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.email), true
from auth.users u
where lower(u.email) = lower('admin@turinova.hu')
on conflict (user_id) do update
set active = true;
