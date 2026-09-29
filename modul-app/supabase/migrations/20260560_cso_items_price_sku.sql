-- Ügyfélrendelés tétel: bruttó egységár (amit a vevőnek mondtunk) + SKU snapshot
-- (szabad tételnél nincs accessory → SKU különben elveszne).

alter table public.customer_special_order_items
  add column if not exists unit_price_gross numeric(12, 2)
    check (unit_price_gross is null or unit_price_gross >= 0),
  add column if not exists sku_snapshot text;

comment on column public.customer_special_order_items.unit_price_gross is
  'Bruttó egységár (Ft) felvételkor — vevőnek mondott ár.';
comment on column public.customer_special_order_items.sku_snapshot is
  'SKU felvételkor (katalógus vagy szabad szöveg).';

-- Rendelésszám: a törölt rendelések is foglalják a számot (unique tenant_id + order_number).
create or replace function public.generate_customer_special_order_number(p_tenant_id uuid)
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
      substring(order_number from length('UR-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.customer_special_orders
  where tenant_id = p_tenant_id
    and order_number ~ ('^UR-' || current_year::text || '-[0-9]+$');

  return 'UR-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_customer_special_order_number(uuid) from public;
grant execute on function public.generate_customer_special_order_number(uuid) to authenticated;

notify pgrst, 'reload schema';
