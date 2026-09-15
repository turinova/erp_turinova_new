-- modul-app: tenant-scoped fee types (Díj típusok)
-- Később quote_fees snapshot sorokhoz; NEM a cutting_fees (Opti Ft/m).

create table if not exists public.fee_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tax_rate_id uuid not null references public.tax_rates (id),
  name text not null,
  price_net numeric(12, 0) not null check (price_net >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists fee_types_tenant_alive_idx
  on public.fee_types (tenant_id)
  where deleted_at is null;

create index if not exists fee_types_tenant_active_idx
  on public.fee_types (tenant_id, active)
  where deleted_at is null;

create unique index if not exists fee_types_tenant_name_alive_uidx
  on public.fee_types (tenant_id, lower(name))
  where deleted_at is null;

alter table public.fee_types enable row level security;

drop policy if exists fee_types_select_member on public.fee_types;
create policy fee_types_select_member
  on public.fee_types
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists fee_types_insert_writer on public.fee_types;
create policy fee_types_insert_writer
  on public.fee_types
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists fee_types_update_writer on public.fee_types;
create policy fee_types_update_writer
  on public.fee_types
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists fee_types_delete_writer on public.fee_types;
create policy fee_types_delete_writer
  on public.fee_types
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.fee_types is 'Díj típusok törzs (Fuvar, szerelés stb.); nem Opti vágási díj';
comment on column public.fee_types.price_net is 'Nettó Ft / db; UI bruttót szerkeszt';
