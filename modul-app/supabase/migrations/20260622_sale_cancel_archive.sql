-- Értékesítés lemondás audit + archív (lista/KPI defaultból rejt).

alter table public.sales_orders
  add column if not exists cancelled_by uuid references auth.users (id) on delete set null,
  add column if not exists cancelled_by_label_snapshot text,
  add column if not exists cancel_reason text,
  add column if not exists cancel_note text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archived_by_label_snapshot text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_orders_cancel_reason_check'
  ) then
    alter table public.sales_orders
      add constraint sales_orders_cancel_reason_check
      check (
        cancel_reason is null
        or cancel_reason in ('test', 'customer', 'error', 'other')
      );
  end if;
end $$;

comment on column public.sales_orders.cancel_reason is
  'test | customer | error | other';
comment on column public.sales_orders.archived_at is
  'Lista/KPI defaultból rejtett soft archív.';

create index if not exists sales_orders_tenant_active_list_idx
  on public.sales_orders (tenant_id, created_at desc)
  where deleted_at is null and archived_at is null;

create index if not exists sales_orders_tenant_archived_list_idx
  on public.sales_orders (tenant_id, archived_at desc)
  where deleted_at is null and archived_at is not null;
