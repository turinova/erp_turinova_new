-- modul-app: tenant-scoped gyártógépek (műhely) — Gyártásba adás selecthez
-- Route: /torzsadatok/rendszer/gyartogepek
-- Nem keverendő: manufacturers (Gyártók) / equipment (Berendezés Excel)

create table if not exists public.production_machines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  comment text,
  usage_limit_per_day integer not null default 100
    check (usage_limit_per_day > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint production_machines_name_len check (char_length(name) <= 100)
);

create index if not exists production_machines_tenant_alive_idx
  on public.production_machines (tenant_id)
  where deleted_at is null;

create index if not exists production_machines_tenant_active_alive_idx
  on public.production_machines (tenant_id)
  where deleted_at is null and active = true;

create unique index if not exists production_machines_tenant_name_alive_uidx
  on public.production_machines (tenant_id, lower(name))
  where deleted_at is null;

alter table public.production_machines enable row level security;

drop policy if exists production_machines_select_member on public.production_machines;
create policy production_machines_select_member
  on public.production_machines
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists production_machines_insert_writer on public.production_machines;
create policy production_machines_insert_writer
  on public.production_machines
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists production_machines_update_writer on public.production_machines;
create policy production_machines_update_writer
  on public.production_machines
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists production_machines_delete_writer on public.production_machines;
create policy production_machines_delete_writer
  on public.production_machines
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.production_machines is
  'Műhely gyártógépek — megrendelés gyártásba adásához (nem Excel berendezés).';
