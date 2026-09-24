-- Lapszabászat quote billing snapshots (számla / díjbekérő vevőadatok).
-- Convert order: ha üres a snapshot, másolás az ügyfél törzsből.

alter table public.quotes
  add column if not exists billing_name_snapshot text,
  add column if not exists billing_country_snapshot text,
  add column if not exists billing_city_snapshot text,
  add column if not exists billing_postal_code_snapshot text,
  add column if not exists billing_street_snapshot text,
  add column if not exists billing_house_number_snapshot text,
  add column if not exists billing_tax_number_snapshot text;

comment on column public.quotes.billing_name_snapshot is
  'Számlázási név a dokumentumon (megrendelés / számla). Az ügyféltörzset nem írja felül.';

-- Backfill: élő customer billing, ahol snapshot üres
update public.quotes q
set
  billing_name_snapshot = coalesce(q.billing_name_snapshot, c.billing_name, c.name),
  billing_country_snapshot = coalesce(
    q.billing_country_snapshot,
    nullif(trim(c.billing_country), ''),
    'Magyarország'
  ),
  billing_city_snapshot = coalesce(q.billing_city_snapshot, c.billing_city),
  billing_postal_code_snapshot = coalesce(
    q.billing_postal_code_snapshot,
    c.billing_postal_code
  ),
  billing_street_snapshot = coalesce(q.billing_street_snapshot, c.billing_street),
  billing_house_number_snapshot = coalesce(
    q.billing_house_number_snapshot,
    c.billing_house_number
  ),
  billing_tax_number_snapshot = coalesce(
    q.billing_tax_number_snapshot,
    c.billing_tax_number
  )
from public.customers c
where q.customer_id = c.id
  and q.deleted_at is null
  and c.deleted_at is null
  and q.billing_name_snapshot is null
  and q.billing_city_snapshot is null
  and q.billing_street_snapshot is null
  and q.billing_tax_number_snapshot is null;

-- convert_quote_to_order: snapshot kitöltés megrendeléskor, ha üres
create or replace function public.convert_quote_to_order(
  p_quote_id uuid,
  p_tenant_id uuid,
  p_amount numeric default 0,
  p_payment_method_id uuid default null,
  p_payment_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_order_number text;
  v_method_name text;
  v_amount numeric(14, 2);
  v_payment_status text;
  v_due numeric(14, 2);
  v_c public.customers%rowtype;
begin
  if p_tenant_id is null or p_quote_id is null then
    raise exception 'tenant_id and quote_id required';
  end if;

  if not public.can_write_tenant(p_tenant_id) then
    raise exception 'not allowed';
  end if;

  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_amount := coalesce(p_amount, 0);

  if v_amount < 0 then
    raise exception 'invalid amount';
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id
    and tenant_id = p_tenant_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'quote not found';
  end if;

  if v_quote.status is distinct from 'draft' then
    raise exception 'quote not draft';
  end if;

  if v_quote.order_number is not null then
    raise exception 'order already exists';
  end if;

  v_due := coalesce(v_quote.final_total_gross, v_quote.total_gross);

  if v_amount > v_due + 1 then
    raise exception 'amount exceeds total';
  end if;

  if v_amount > 0 then
    if p_payment_method_id is null then
      raise exception 'payment method required';
    end if;

    select name into v_method_name
    from public.payment_methods
    where id = p_payment_method_id
      and tenant_id = p_tenant_id
      and deleted_at is null
      and active = true;

    if v_method_name is null then
      raise exception 'payment method not found';
    end if;
  end if;

  if v_quote.customer_id is not null then
    select * into v_c
    from public.customers
    where id = v_quote.customer_id
      and tenant_id = p_tenant_id
      and deleted_at is null;
  end if;

  v_order_number := public.generate_order_number(p_tenant_id);

  update public.quotes
  set status = 'ordered',
      order_number = v_order_number,
      payment_status = 'not_paid',
      ordered_at = now(),
      billing_name_snapshot = coalesce(
        nullif(trim(billing_name_snapshot), ''),
        nullif(trim(v_c.billing_name), ''),
        nullif(trim(v_c.name), ''),
        billing_name_snapshot
      ),
      billing_country_snapshot = coalesce(
        nullif(trim(billing_country_snapshot), ''),
        nullif(trim(v_c.billing_country), ''),
        'Magyarország'
      ),
      billing_city_snapshot = coalesce(
        nullif(trim(billing_city_snapshot), ''),
        v_c.billing_city
      ),
      billing_postal_code_snapshot = coalesce(
        nullif(trim(billing_postal_code_snapshot), ''),
        v_c.billing_postal_code
      ),
      billing_street_snapshot = coalesce(
        nullif(trim(billing_street_snapshot), ''),
        v_c.billing_street
      ),
      billing_house_number_snapshot = coalesce(
        nullif(trim(billing_house_number_snapshot), ''),
        v_c.billing_house_number
      ),
      billing_tax_number_snapshot = coalesce(
        nullif(trim(billing_tax_number_snapshot), ''),
        v_c.billing_tax_number
      ),
      updated_at = now()
  where id = p_quote_id
    and tenant_id = p_tenant_id
    and status = 'draft'
    and order_number is null
    and deleted_at is null;

  if not found then
    raise exception 'quote race';
  end if;

  if v_amount > 0 then
    insert into public.quote_payments (
      tenant_id,
      quote_id,
      amount,
      payment_method_id,
      payment_method_name,
      comment,
      payment_date,
      created_by
    ) values (
      p_tenant_id,
      p_quote_id,
      round(v_amount, 2),
      p_payment_method_id,
      v_method_name,
      nullif(trim(coalesce(p_payment_comment, '')), ''),
      now(),
      auth.uid()
    );
  end if;

  select payment_status into v_payment_status
  from public.quotes
  where id = p_quote_id;

  return jsonb_build_object(
    'order_number', v_order_number,
    'payment_status', coalesce(v_payment_status, 'not_paid')
  );
end;
$$;

revoke all on function public.convert_quote_to_order(uuid, uuid, numeric, uuid, text) from public;
grant execute on function public.convert_quote_to_order(uuid, uuid, numeric, uuid, text) to authenticated;

comment on function public.convert_quote_to_order(uuid, uuid, numeric, uuid, text) is
  'Draft → megrendelés (+ ordered_at, billing snapshot); előleg limit = final_total_gross.';
