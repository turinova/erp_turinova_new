-- modul-app: orders list speed — composite index for status filter + updated_at sort
-- Supports: tenant + status + order_number IS NOT NULL + order by updated_at desc

create index if not exists quotes_tenant_status_order_updated_alive_idx
  on public.quotes (tenant_id, status, updated_at desc)
  where deleted_at is null and order_number is not null;

comment on index public.quotes_tenant_status_order_updated_alive_idx is
  'Megrendelés lista: status szűrő + updated_at rendezés (alive orders).';
