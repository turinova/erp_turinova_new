-- modul-app: tenant-scoped manufacturers (Gyártók)
-- Futtasd a tenancy foundation (+ can_write_tenant) után.

create table if not exists public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists manufacturers_tenant_alive_idx
  on public.manufacturers (tenant_id)
  where deleted_at is null;

create unique index if not exists manufacturers_tenant_name_alive_uidx
  on public.manufacturers (tenant_id, lower(name))
  where deleted_at is null;

alter table public.manufacturers enable row level security;

drop policy if exists manufacturers_select_member on public.manufacturers;
create policy manufacturers_select_member
  on public.manufacturers
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists manufacturers_insert_writer on public.manufacturers;
create policy manufacturers_insert_writer
  on public.manufacturers
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists manufacturers_update_writer on public.manufacturers;
create policy manufacturers_update_writer
  on public.manufacturers
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists manufacturers_delete_writer on public.manufacturers;
create policy manufacturers_delete_writer
  on public.manufacturers
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.manufacturers is 'Gyártók törzs tenantonként';
