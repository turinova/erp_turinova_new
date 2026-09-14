-- Partner portal: generate_quote_number callable when saving portal drafts.
-- Staff path unchanged (can_write_tenant). Partners: selected tenant + add-on.

create or replace function public.generate_quote_number(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year integer;
  next_number integer;
  allowed boolean;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id required';
  end if;

  allowed := public.can_write_tenant(p_tenant_id)
    or (
      public.is_partner()
      and public.partner_selected_tenant_is(p_tenant_id)
      and public.tenant_accepts_partner_orders(p_tenant_id)
    );

  if not allowed then
    raise exception 'not allowed';
  end if;

  current_year := extract(year from now())::integer;

  select coalesce(max(
    cast(
      substring(quote_number from length('Q-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.quotes
  where tenant_id = p_tenant_id
    and quote_number like 'Q-' || current_year::text || '-%'
    and deleted_at is null;

  return 'Q-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_quote_number(uuid) from public;
grant execute on function public.generate_quote_number(uuid) to authenticated;
