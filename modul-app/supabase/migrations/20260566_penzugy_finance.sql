-- Pénzügy P0/P0b: tétel snapshot, fizetés, időszakzárás, nettó/ÁFA oszlopok

alter table public.invoices
  add column if not exists net_total numeric(12, 2),
  add column if not exists vat_total numeric(12, 2),
  add column if not exists external_id text,
  add column if not exists agent_last_error text,
  add column if not exists paid_amount numeric(12, 2) not null default 0;

create unique index if not exists invoices_tenant_external_uidx
  on public.invoices (tenant_id, external_id)
  where deleted_at is null and external_id is not null;

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  line_no int not null default 1,
  name text not null,
  quantity numeric(14, 4) not null default 1,
  unit text not null default 'db',
  vat_percent numeric(6, 2) not null default 27,
  unit_net numeric(12, 2) not null default 0,
  line_net numeric(12, 2) not null default 0,
  line_vat numeric(12, 2) not null default 0,
  line_gross numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (invoice_id, line_no)
);

create index if not exists invoice_lines_tenant_invoice_idx
  on public.invoice_lines (tenant_id, invoice_id);

alter table public.invoice_lines enable row level security;

drop policy if exists invoice_lines_select_member on public.invoice_lines;
create policy invoice_lines_select_member
  on public.invoice_lines for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists invoice_lines_insert_writer on public.invoice_lines;
create policy invoice_lines_insert_writer
  on public.invoice_lines for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists invoice_lines_update_writer on public.invoice_lines;
create policy invoice_lines_update_writer
  on public.invoice_lines for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists invoice_lines_delete_writer on public.invoice_lines;
create policy invoice_lines_delete_writer
  on public.invoice_lines for delete to authenticated
  using (public.can_write_tenant(tenant_id));

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  paid_at date not null default (timezone('Europe/Budapest', now()))::date,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null default 'bank_transfer'
    check (method in ('cash', 'bank_transfer', 'card', 'other')),
  note text,
  agent_synced boolean not null default false,
  agent_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_invoice_idx
  on public.invoice_payments (tenant_id, invoice_id, paid_at desc);

alter table public.invoice_payments enable row level security;

drop policy if exists invoice_payments_select_member on public.invoice_payments;
create policy invoice_payments_select_member
  on public.invoice_payments for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists invoice_payments_insert_writer on public.invoice_payments;
create policy invoice_payments_insert_writer
  on public.invoice_payments for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists invoice_payments_update_writer on public.invoice_payments;
create policy invoice_payments_update_writer
  on public.invoice_payments for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

create table if not exists public.finance_period_locks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  period_ym text not null
    check (period_ym ~ '^[0-9]{4}-[0-9]{2}$'),
  locked_at timestamptz not null default now(),
  locked_by uuid references auth.users (id) on delete set null,
  note text,
  unique (tenant_id, period_ym)
);

alter table public.finance_period_locks enable row level security;

drop policy if exists finance_period_locks_select_member on public.finance_period_locks;
create policy finance_period_locks_select_member
  on public.finance_period_locks for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists finance_period_locks_write on public.finance_period_locks;
create policy finance_period_locks_write
  on public.finance_period_locks for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

comment on table public.invoice_lines is
  'Számla tétel snapshot — ÁFA összesítő / export (Agent nem listáz időszakot).';
comment on table public.invoice_payments is
  'ERP kiegyenlítés; agent_synced = Számlázz kifiz Agent siker.';
comment on table public.finance_period_locks is
  'Hónap soft-lock (YYYY-MM) — visszadátumozás ellen.';
