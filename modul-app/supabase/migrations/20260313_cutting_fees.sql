-- modul-app: tenant-scoped Opti cutting fee (V1: fee_per_meter + tax_rate only)
-- Futtasd: tenancy + tax_rates után.

create table if not exists public.cutting_fees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  fee_per_meter numeric(10, 2) not null default 300
    check (fee_per_meter > 0),
  tax_rate_id uuid not null references public.tax_rates (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists cutting_fees_tenant_alive_uidx
  on public.cutting_fees (tenant_id)
  where deleted_at is null;

create index if not exists cutting_fees_tenant_alive_idx
  on public.cutting_fees (tenant_id)
  where deleted_at is null;

alter table public.cutting_fees enable row level security;

drop policy if exists cutting_fees_select_member on public.cutting_fees;
create policy cutting_fees_select_member
  on public.cutting_fees
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists cutting_fees_insert_writer on public.cutting_fees;
create policy cutting_fees_insert_writer
  on public.cutting_fees
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists cutting_fees_update_writer on public.cutting_fees;
create policy cutting_fees_update_writer
  on public.cutting_fees
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists cutting_fees_delete_writer on public.cutting_fees;
create policy cutting_fees_delete_writer
  on public.cutting_fees
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.cutting_fees is 'Opti vágási díj tenantonként (V1: nettó Ft/m + ÁFA)';
comment on column public.cutting_fees.fee_per_meter is 'Nettó vágási díj Ft/m (UI bruttót mutat)';
