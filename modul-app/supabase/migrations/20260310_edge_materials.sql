-- modul-app: tenant-scoped edge materials (Élzárók)
-- Futtasd a manufacturers + tax_rates migrációk után.

create table if not exists public.edge_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  manufacturer_id uuid not null references public.manufacturers (id),
  tax_rate_id uuid not null references public.tax_rates (id),
  equipment_id uuid not null references public.equipment (id),
  type text not null,
  decor text not null,
  width_mm numeric(8, 2) not null check (width_mm > 0),
  thickness_mm numeric(8, 2) not null check (thickness_mm > 0),
  price_net numeric(12, 0) not null check (price_net >= 0),
  allowance_mm integer not null default 0 check (allowance_mm >= 0),
  favourite_priority integer,
  active boolean not null default true,
  machine_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists edge_materials_tenant_alive_idx
  on public.edge_materials (tenant_id)
  where deleted_at is null;

create index if not exists edge_materials_tenant_active_idx
  on public.edge_materials (tenant_id, active)
  where deleted_at is null;

create unique index if not exists edge_materials_identity_alive_uidx
  on public.edge_materials (
    tenant_id,
    manufacturer_id,
    lower(type),
    lower(decor),
    width_mm,
    thickness_mm
  )
  where deleted_at is null;

alter table public.edge_materials enable row level security;

drop policy if exists edge_materials_select_member on public.edge_materials;
create policy edge_materials_select_member
  on public.edge_materials
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists edge_materials_insert_writer on public.edge_materials;
create policy edge_materials_insert_writer
  on public.edge_materials
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists edge_materials_update_writer on public.edge_materials;
create policy edge_materials_update_writer
  on public.edge_materials
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists edge_materials_delete_writer on public.edge_materials;
create policy edge_materials_delete_writer
  on public.edge_materials
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

create index if not exists edge_materials_equipment_id_idx
  on public.edge_materials (equipment_id)
  where deleted_at is null;

comment on table public.edge_materials is 'Élzáró anyagok törzs tenantonként';
comment on column public.edge_materials.price_net is 'Nettó ár Ft-ban; UI bruttót szerkeszt';
comment on column public.edge_materials.allowance_mm is 'Ráhagyás mm (gyártás / opti)';
comment on column public.edge_materials.equipment_id is 'Export berendezés (equipment törzs)';
comment on column public.edge_materials.machine_code is 'Export gépkód';
comment on column public.edge_materials.favourite_priority is 'Kedvenc sorrend (UI); kisebb = előrébb';
