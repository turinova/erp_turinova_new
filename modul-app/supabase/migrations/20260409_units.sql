-- modul-app: tenant-scoped units (Egységek / mértékegységek)
-- Futtasd a tenancy foundation (+ can_write_tenant) után.

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  shortform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists units_tenant_alive_idx
  on public.units (tenant_id)
  where deleted_at is null;

create unique index if not exists units_tenant_name_alive_uidx
  on public.units (tenant_id, lower(name))
  where deleted_at is null;

create unique index if not exists units_tenant_shortform_alive_uidx
  on public.units (tenant_id, lower(shortform))
  where deleted_at is null;

alter table public.units enable row level security;

drop policy if exists units_select_member on public.units;
create policy units_select_member
  on public.units
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists units_insert_writer on public.units;
create policy units_insert_writer
  on public.units
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists units_update_writer on public.units;
create policy units_update_writer
  on public.units
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists units_delete_writer on public.units;
create policy units_delete_writer
  on public.units
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.units is 'Mértékegységek törzs tenantonként (name + shortform)';
