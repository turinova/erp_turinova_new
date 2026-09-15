-- modul-app: fizetés forrásigazsága = final_total_gross (lapszabászat + díjak + termékek)
-- Depends on: 20260322_quote_payments, 20260404_quote_ordered_at, 20260414_quote_fees, 20260416_accessories

-- ---------------------------------------------------------------------------
-- final_total_gross mindig = max(0, total_gross + fees + accessories)
-- ---------------------------------------------------------------------------
create or replace function public.trigger_quotes_recompute_final_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.final_total_gross := greatest(
    0::numeric,
    round(
      coalesce(new.total_gross, 0)
      + coalesce(new.fees_total_gross, 0)
      + coalesce(new.accessories_total_gross, 0)
    , 2)
  );
  return new;
end;
$$;

comment on function public.trigger_quotes_recompute_final_total() is
  'quotes.final_total_gross = lapszabászat + díjak + termékek (≥ 0).';

drop trigger if exists trigger_quotes_recompute_final_total on public.quotes;
create trigger trigger_quotes_recompute_final_total
  before insert or update of total_gross, fees_total_gross, accessories_total_gross, final_total_gross
  on public.quotes
  for each row
  execute function public.trigger_quotes_recompute_final_total();

-- ---------------------------------------------------------------------------
-- Közös sync: payment_status ← Σ payments vs final_total_gross
-- ---------------------------------------------------------------------------
create or replace function public.sync_quote_payment_status(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due numeric(14, 2);
  v_total_paid numeric(14, 2);
  v_new_status text;
  v_tolerance constant numeric := 1.0;
begin
  if p_quote_id is null then
    return;
  end if;

  select coalesce(final_total_gross, total_gross) into v_due
  from public.quotes
  where id = p_quote_id;

  if v_due is null then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
  from public.quote_payments
  where quote_id = p_quote_id
    and deleted_at is null;

  if v_total_paid = 0 then
    v_new_status := 'not_paid';
  elsif v_total_paid >= v_due - v_tolerance then
    v_new_status := 'paid';
  else
    v_new_status := 'partial';
  end if;

  update public.quotes
  set payment_status = v_new_status,
      updated_at = now()
  where id = p_quote_id
    and payment_status is distinct from v_new_status;
end;
$$;

comment on function public.sync_quote_payment_status(uuid) is
  'payment_status újraszámolás final_total_gross (fallback: total_gross) alapján.';

revoke all on function public.sync_quote_payment_status(uuid) from public;

create or replace function public.update_quote_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
begin
  if tg_op = 'DELETE' then
    v_quote_id := old.quote_id;
  else
    v_quote_id := new.quote_id;
  end if;

  perform public.sync_quote_payment_status(v_quote_id);
  return null;
end;
$$;

comment on function public.update_quote_payment_status() is
  'quote_payments INSERT/UPDATE/DELETE → payment_status (final_total_gross).';

-- final / lapszabászat / díj / termék változáskor is újraszámol
create or replace function public.trigger_quotes_final_total_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.final_total_gross is distinct from old.final_total_gross then
    perform public.sync_quote_payment_status(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists trigger_quotes_final_total_payment_status on public.quotes;
create trigger trigger_quotes_final_total_payment_status
  after update of total_gross, fees_total_gross, accessories_total_gross, final_total_gross
  on public.quotes
  for each row
  when (new.final_total_gross is distinct from old.final_total_gross)
  execute function public.trigger_quotes_final_total_payment_status();

-- ---------------------------------------------------------------------------
-- convert_quote_to_order: limit = final_total_gross
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
  v_due numeric(14, 2);
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

revoke all on function public.convert_quote_to_order(uuid, uuid, numeric, uuid, text) from public;
grant execute on function public.convert_quote_to_order(uuid, uuid, numeric, uuid, text) to authenticated;

comment on function public.convert_quote_to_order(uuid, uuid, numeric, uuid, text) is
  'Draft → megrendelés (+ ordered_at); előleg limit = final_total_gross.';

comment on column public.quotes.payment_status is
  'Auto: not_paid | partial | paid — Σ quote_payments vs final_total_gross (±1 Ft).';

-- ---------------------------------------------------------------------------
-- Backfill: stale final + payment_status helyreállítása
-- ---------------------------------------------------------------------------
update public.quotes
set final_total_gross = greatest(
  0::numeric,
  round(
    coalesce(total_gross, 0)
    + coalesce(fees_total_gross, 0)
    + coalesce(accessories_total_gross, 0)
  , 2)
)
where deleted_at is null
  and final_total_gross is distinct from greatest(
    0::numeric,
    round(
      coalesce(total_gross, 0)
      + coalesce(fees_total_gross, 0)
      + coalesce(accessories_total_gross, 0)
    , 2)
  );

do $$
declare
  r record;
begin
  for r in
    select q.id
    from public.quotes q
    where q.deleted_at is null
      and (
        q.order_number is not null
        or exists (
          select 1
          from public.quote_payments p
          where p.quote_id = q.id
            and p.deleted_at is null
        )
      )
  loop
    perform public.sync_quote_payment_status(r.id);
  end loop;
end;
$$;
