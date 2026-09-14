-- modul-app: tenant-scoped order number for quote → order conversion
-- Format: O-YYYY-NNN (mirrors generate_quote_number / Q-YYYY-NNN)

create or replace function public.generate_order_number(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year integer;
  next_number integer;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id required';
  end if;

  if not public.can_write_tenant(p_tenant_id) then
    raise exception 'not allowed';
  end if;

  current_year := extract(year from now())::integer;

  select coalesce(max(
    cast(
      substring(order_number from length('O-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.quotes
  where tenant_id = p_tenant_id
    and order_number like 'O-' || current_year::text || '-%'
    and deleted_at is null;

  return 'O-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_order_number(uuid) from public;
grant execute on function public.generate_order_number(uuid) to authenticated;

comment on function public.generate_order_number(uuid) is
  'Tenant-scoped megrendelésszám: O-YYYY-NNN.';
