-- Napi egyeztetés: bolt valós KP / kártya / utalás vs rendszer (sales_payments)
-- UI: /ertekesitesek/napi-egyeztetes

create table if not exists public.daily_reconciliations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  business_date date not null,

  store_cash numeric(12, 0),
  store_card numeric(12, 0),
  store_transfer numeric(12, 0),

  system_cash_snapshot numeric(12, 0),
  system_card_snapshot numeric(12, 0),
  system_transfer_snapshot numeric(12, 0),

  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  constraint daily_reconciliations_tenant_date_uidx unique (tenant_id, business_date)
);

create index if not exists daily_reconciliations_tenant_date_idx
  on public.daily_reconciliations (tenant_id, business_date desc);

comment on table public.daily_reconciliations is
  'Napi KP/kártya/utalás egyeztetés — bolt manuális vs rendszer snapshot.';

alter table public.daily_reconciliations enable row level security;

drop policy if exists daily_reconciliations_select_member on public.daily_reconciliations;
create policy daily_reconciliations_select_member
  on public.daily_reconciliations for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists daily_reconciliations_insert_writer on public.daily_reconciliations;
create policy daily_reconciliations_insert_writer
  on public.daily_reconciliations for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists daily_reconciliations_update_writer on public.daily_reconciliations;
create policy daily_reconciliations_update_writer
  on public.daily_reconciliations for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists daily_reconciliations_delete_writer on public.daily_reconciliations;
create policy daily_reconciliations_delete_writer
  on public.daily_reconciliations for delete to authenticated
  using (public.can_write_tenant(tenant_id));
