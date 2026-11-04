-- Kedvenc ügyfél: Opti/POS/számla typeahead előrébb; tenant-szintű flag.

alter table public.customers
  add column if not exists is_favorite boolean not null default false;

comment on column public.customers.is_favorite is
  'Kedvenc ügyfél — typeahead (Opti/POS/számla) előrébb; nem befolyásolja a számlázást.';

comment on table public.customers is
  'Ügyfelek törzs tenantonként (SMS: sms_notification; kedvenc: is_favorite; ügyfél-szintű kedvezmény nincs).';

create index if not exists customers_tenant_favorite_alive_idx
  on public.customers (tenant_id, name)
  where deleted_at is null and is_favorite;

-- Return type bővül → drop + recreate
drop function if exists public.search_customers_for_select(uuid, text, int);

create function public.search_customers_for_select(
  p_tenant_id uuid,
  p_q text default '',
  p_limit int default 25
)
returns table (
  id uuid,
  name text,
  email text,
  mobile text,
  billing_name text,
  billing_country text,
  billing_city text,
  billing_postal_code text,
  billing_street text,
  billing_house_number text,
  billing_tax_number text,
  is_favorite boolean
)
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_q text := trim(both from coalesce(p_q, ''));
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 50));
  v_pattern text;
begin
  if p_tenant_id is null then
    return;
  end if;

  if v_q = '' then
    return query
    select
      c.id,
      c.name,
      c.email,
      c.mobile,
      c.billing_name,
      coalesce(c.billing_country, 'Magyarország'),
      c.billing_city,
      c.billing_postal_code,
      c.billing_street,
      c.billing_house_number,
      c.billing_tax_number,
      c.is_favorite
    from public.customers c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
    order by c.is_favorite desc, c.name asc
    limit v_limit;
    return;
  end if;

  v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    c.id,
    c.name,
    c.email,
    c.mobile,
    c.billing_name,
    coalesce(c.billing_country, 'Magyarország'),
    c.billing_city,
    c.billing_postal_code,
    c.billing_street,
    c.billing_house_number,
    c.billing_tax_number,
    c.is_favorite
  from public.customers c
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and (
      c.name ilike v_pattern escape '\'
      or c.billing_name ilike v_pattern escape '\'
      or c.email ilike v_pattern escape '\'
      or c.mobile ilike v_pattern escape '\'
      or c.billing_city ilike v_pattern escape '\'
    )
  order by
    c.is_favorite desc,
    case
      when c.name ilike v_q || '%' escape '\' then 0
      when c.billing_name ilike v_q || '%' escape '\' then 1
      else 2
    end,
    c.name asc
  limit v_limit;
end;
$$;

revoke all on function public.search_customers_for_select(uuid, text, int) from public;
grant execute on function public.search_customers_for_select(uuid, text, int) to authenticated;
grant execute on function public.search_customers_for_select(uuid, text, int) to service_role;

comment on function public.search_customers_for_select is
  'POS/Opti/számla ügyfél typeahead — név/billing/email/mobile/city; kedvencek előrébb.';
