-- modul-app: tenant-scoped tax rates (Adónem)
-- Futtasd a tenancy foundation után.

create or replace function public.can_write_tenant(p_tenant_id uuid)
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
      and m.role in ('owner', 'admin', 'member')
  );
$$;

revoke all on function public.can_write_tenant(uuid) from public;
grant execute on function public.can_write_tenant(uuid) to authenticated;

create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  rate_percent numeric(5, 2) not null
    check (rate_percent >= 0 and rate_percent <= 100),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists tax_rates_tenant_alive_idx
  on public.tax_rates (tenant_id)
  where deleted_at is null;

create unique index if not exists tax_rates_tenant_name_alive_uidx
  on public.tax_rates (tenant_id, lower(name))
  where deleted_at is null;

create unique index if not exists tax_rates_tenant_default_alive_uidx
  on public.tax_rates (tenant_id)
  where is_default = true and deleted_at is null;

alter table public.tax_rates enable row level security;

drop policy if exists tax_rates_select_member on public.tax_rates;
create policy tax_rates_select_member
  on public.tax_rates
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tax_rates_insert_writer on public.tax_rates;
create policy tax_rates_insert_writer
  on public.tax_rates
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tax_rates_update_writer on public.tax_rates;
create policy tax_rates_update_writer
  on public.tax_rates
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tax_rates_delete_writer on public.tax_rates;
create policy tax_rates_delete_writer
  on public.tax_rates
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.tax_rates is 'Adónemek / ÁFA kulcsok tenantonként';
