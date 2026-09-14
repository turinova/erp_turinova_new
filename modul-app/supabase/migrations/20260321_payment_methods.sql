-- modul-app: tenant-scoped fizetési módok törzs
-- Route: /torzsadatok/rendszer/fizetesi-modok

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  comment text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint payment_methods_name_len check (char_length(name) <= 50)
);

create index if not exists payment_methods_tenant_alive_idx
  on public.payment_methods (tenant_id)
  where deleted_at is null;

create index if not exists payment_methods_tenant_active_alive_idx
  on public.payment_methods (tenant_id)
  where deleted_at is null and active = true;

create unique index if not exists payment_methods_tenant_name_alive_uidx
  on public.payment_methods (tenant_id, lower(name))
  where deleted_at is null;

alter table public.payment_methods enable row level security;

drop policy if exists payment_methods_select_member on public.payment_methods;
create policy payment_methods_select_member
  on public.payment_methods
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists payment_methods_insert_writer on public.payment_methods;
create policy payment_methods_insert_writer
  on public.payment_methods
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists payment_methods_update_writer on public.payment_methods;
create policy payment_methods_update_writer
  on public.payment_methods
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists payment_methods_delete_writer on public.payment_methods;
create policy payment_methods_delete_writer
  on public.payment_methods
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.payment_methods is
  'Fizetési módok tenantonként (előleg / megrendelés).';
