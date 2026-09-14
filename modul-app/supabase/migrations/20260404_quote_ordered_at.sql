-- modul-app: quotes.ordered_at — tiszta megrendelés KPI (ne updated_at)
-- Depends on: 20260322_quote_payments, 20260324_quote_production

alter table public.quotes
  add column if not exists ordered_at timestamptz;

comment on column public.quotes.ordered_at is
  'Mikor vált megrendeléssé (convert). Platform / riport KPI forrás.';

-- Backfill: meglévő order_number-es sorok
update public.quotes
set ordered_at = coalesce(ordered_at, updated_at)
where order_number is not null
  and ordered_at is null
  and deleted_at is null;

create index if not exists quotes_tenant_ordered_at_idx
  on public.quotes (tenant_id, ordered_at)
  where deleted_at is null and ordered_at is not null;

create index if not exists quotes_ordered_at_alive_idx
  on public.quotes (ordered_at)
  where deleted_at is null and ordered_at is not null;

-- convert_quote_to_order: állítsa be az ordered_at-et
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

  if v_amount > v_quote.total_gross + 1 then
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

  v_order_number := public.generate_order_number(p_tenant_id);

  update public.quotes
  set status = 'ordered',
      order_number = v_order_number,
      payment_status = 'not_paid',
      ordered_at = now(),
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

comment on function public.convert_quote_to_order(uuid, uuid, numeric, uuid, text) is
  'Draft árajánlat → megrendelés (+ ordered_at), opcionális előleg egy tranzakcióban.';
