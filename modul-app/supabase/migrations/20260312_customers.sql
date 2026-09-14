-- modul-app: tenant-scoped customers (Ügyfelek)
-- V1: nincs kedvezmény, SMS, kedvenc.
-- Futtasd a tenancy foundation (+ can_write_tenant) után.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  name text not null,
  email text,
  mobile text,

  billing_name text,
  billing_country text not null default 'Magyarország',
  billing_city text,
  billing_postal_code text,
  billing_street text,
  billing_house_number text,
  billing_tax_number text,
  billing_company_reg_number text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists customers_tenant_alive_idx
  on public.customers (tenant_id)
  where deleted_at is null;

create unique index if not exists customers_tenant_name_alive_uidx
  on public.customers (tenant_id, lower(name))
  where deleted_at is null;

alter table public.customers enable row level security;

drop policy if exists customers_select_member on public.customers;
create policy customers_select_member
  on public.customers
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists customers_insert_writer on public.customers;
create policy customers_insert_writer
  on public.customers
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists customers_update_writer on public.customers;
create policy customers_update_writer
  on public.customers
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists customers_delete_writer on public.customers;
create policy customers_delete_writer
  on public.customers
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.customers is 'Ügyfelek törzs tenantonként (V1: nincs kedvezmény / SMS / kedvenc)';
