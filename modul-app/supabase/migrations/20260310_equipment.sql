-- modul-app: tenant-scoped equipment (Berendezés)
-- Futtasd a tenancy foundation (+ can_write_tenant) után.

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists equipment_tenant_alive_idx
  on public.equipment (tenant_id)
  where deleted_at is null;

create unique index if not exists equipment_tenant_name_alive_uidx
  on public.equipment (tenant_id, lower(name))
  where deleted_at is null;

alter table public.equipment enable row level security;

drop policy if exists equipment_select_member on public.equipment;
create policy equipment_select_member
  on public.equipment
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists equipment_insert_writer on public.equipment;
create policy equipment_insert_writer
  on public.equipment
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists equipment_update_writer on public.equipment;
create policy equipment_update_writer
  on public.equipment
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists equipment_delete_writer on public.equipment;
create policy equipment_delete_writer
  on public.equipment
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.equipment is 'Berendezések törzs tenantonként';
