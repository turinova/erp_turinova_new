-- Termék: gyártó opcionális; több beszállító (accessory_suppliers).
-- Futtasd a 20260501_suppliers + 20260416_accessories után.

-- ---------------------------------------------------------------------------
-- accessories.manufacturer_id → nullable
-- ---------------------------------------------------------------------------
alter table public.accessories
  alter column manufacturer_id drop not null;

comment on column public.accessories.manufacturer_id is
  'Opcionális gyártó (márka). Beszállítók: accessory_suppliers.';

-- ---------------------------------------------------------------------------
-- accessory_suppliers (M:N)
-- ---------------------------------------------------------------------------
create table if not exists public.accessory_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  is_primary boolean not null default false,
  sort_order integer not null default 0
    check (sort_order >= 0 and sort_order <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (accessory_id, supplier_id)
);

create index if not exists accessory_suppliers_tenant_idx
  on public.accessory_suppliers (tenant_id);

create index if not exists accessory_suppliers_accessory_idx
  on public.accessory_suppliers (accessory_id);

create index if not exists accessory_suppliers_supplier_idx
  on public.accessory_suppliers (supplier_id);

create unique index if not exists accessory_suppliers_one_primary_uidx
  on public.accessory_suppliers (accessory_id)
  where is_primary = true;

alter table public.accessory_suppliers enable row level security;

drop policy if exists accessory_suppliers_select_member on public.accessory_suppliers;
create policy accessory_suppliers_select_member
  on public.accessory_suppliers
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists accessory_suppliers_insert_writer on public.accessory_suppliers;
create policy accessory_suppliers_insert_writer
  on public.accessory_suppliers
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists accessory_suppliers_update_writer on public.accessory_suppliers;
create policy accessory_suppliers_update_writer
  on public.accessory_suppliers
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists accessory_suppliers_delete_writer on public.accessory_suppliers;
create policy accessory_suppliers_delete_writer
  on public.accessory_suppliers
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.accessory_suppliers is
  'Termék ↔ beszállító (több is); is_primary = fő beszállító.';
