-- modul-app: quote payment_status + quote_payments + convert RPC
-- Depends on: 20260316_quotes, 20260320_generate_order_number, 20260321_payment_methods

-- ---------------------------------------------------------------------------
-- quotes.payment_status
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists payment_status text not null default 'not_paid';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_payment_status_check'
  ) then
    alter table public.quotes
      add constraint quotes_payment_status_check
      check (payment_status in ('not_paid', 'partial', 'paid'));
  end if;
end $$;

create index if not exists quotes_tenant_payment_status_alive_idx
  on public.quotes (tenant_id, payment_status)
  where deleted_at is null;

comment on column public.quotes.payment_status is
  'Auto: not_paid | partial | paid (trigger a quote_payments alapján).';

-- ---------------------------------------------------------------------------
-- quote_payments
-- ---------------------------------------------------------------------------
create table if not exists public.quote_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  payment_method_name text not null,
  comment text,
  payment_date timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists quote_payments_tenant_quote_alive_idx
  on public.quote_payments (tenant_id, quote_id)
  where deleted_at is null;

create index if not exists quote_payments_quote_date_alive_idx
  on public.quote_payments (quote_id, payment_date desc)
  where deleted_at is null;

alter table public.quote_payments enable row level security;

drop policy if exists quote_payments_select_member on public.quote_payments;
create policy quote_payments_select_member
  on public.quote_payments
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists quote_payments_insert_writer on public.quote_payments;
create policy quote_payments_insert_writer
  on public.quote_payments
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists quote_payments_update_writer on public.quote_payments;
create policy quote_payments_update_writer
  on public.quote_payments
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists quote_payments_delete_writer on public.quote_payments;
create policy quote_payments_delete_writer
  on public.quote_payments
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.quote_payments is
  'Megrendelés befizetések / előlegek. payment_method_name = snapshot.';

-- ---------------------------------------------------------------------------
-- Trigger: payment_status from sum(payments) vs total_gross
-- ---------------------------------------------------------------------------
create or replace function public.update_quote_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_total_gross numeric(14, 2);
  v_total_paid numeric(14, 2);
  v_new_status text;
  v_tolerance constant numeric := 1.0;
begin
  if tg_op = 'DELETE' then
    v_quote_id := old.quote_id;
  else
    v_quote_id := new.quote_id;
  end if;

  select total_gross into v_total_gross
  from public.quotes
  where id = v_quote_id;

  if v_total_gross is null then
    return null;
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
  from public.quote_payments
  where quote_id = v_quote_id
    and deleted_at is null;

  if v_total_paid = 0 then
    v_new_status := 'not_paid';
  elsif v_total_paid >= v_total_gross - v_tolerance then
    v_new_status := 'paid';
  else
    v_new_status := 'partial';
  end if;

  update public.quotes
  set payment_status = v_new_status,
      updated_at = now()
  where id = v_quote_id;

  return null;
end;
$$;

drop trigger if exists trigger_quote_payments_payment_status_ins on public.quote_payments;
create trigger trigger_quote_payments_payment_status_ins
  after insert on public.quote_payments
  for each row execute function public.update_quote_payment_status();

drop trigger if exists trigger_quote_payments_payment_status_upd on public.quote_payments;
create trigger trigger_quote_payments_payment_status_upd
  after update on public.quote_payments
  for each row execute function public.update_quote_payment_status();

drop trigger if exists trigger_quote_payments_payment_status_del on public.quote_payments;
create trigger trigger_quote_payments_payment_status_del
  after delete on public.quote_payments
  for each row execute function public.update_quote_payment_status();

-- ---------------------------------------------------------------------------
-- Atomic convert: draft → ordered (+ optional initial payment)
-- ---------------------------------------------------------------------------
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
  'Draft árajánlat → megrendelés, opcionális előleg egy tranzakcióban.';
