-- Sale payment edit/void: elütés javítás + payment_status újraszámolás.
-- Edge: aktív végszámla, refund sor, provider_ref, zárt POS műszak, refunded status.

-- ---------------------------------------------------------------------------
-- recompute_sale_payment_status
-- ---------------------------------------------------------------------------
create or replace function public.recompute_sale_payment_status(p_sales_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales_orders%rowtype;
  v_due numeric;
  v_paid_sum numeric;
  v_refund_sum numeric;
  v_net numeric;
  v_has_refund boolean;
  v_new_status text;
begin
  select * into v_sale
  from public.sales_orders
  where id = p_sales_order_id and deleted_at is null
  for update;

  if not found then
    return null;
  end if;

  select
    coalesce(sum(case
      when coalesce(sp.kind, 'payment') = 'refund' then sp.amount
      else 0 end), 0),
    coalesce(sum(case
      when coalesce(sp.kind, 'payment') = 'payment' then sp.amount
      else 0 end), 0)
  into v_refund_sum, v_paid_sum
  from public.sales_payments sp
  where sp.sales_order_id = v_sale.id
    and sp.deleted_at is null
    and sp.status = 'completed';

  v_has_refund := coalesce(v_refund_sum, 0) > 0;

  -- Visszáru utáni státuszokat ne írjuk felül egyszerű paid/partial/unpaid-re
  if v_has_refund then
    if v_paid_sum <= 0 then
      v_new_status := coalesce(v_sale.payment_status, 'unpaid');
    elsif v_refund_sum >= v_paid_sum - 1 then
      v_new_status := 'refunded';
    elsif v_refund_sum > 0 then
      v_new_status := 'partially_refunded';
    else
      v_new_status := v_sale.payment_status;
    end if;

    update public.sales_orders
    set payment_status = v_new_status, updated_at = now()
    where id = v_sale.id;

    return v_new_status;
  end if;

  v_due := coalesce(v_sale.total_gross, 0) + coalesce(v_sale.cash_rounding_amount, 0);
  v_net := v_paid_sum - v_refund_sum;

  if v_net >= v_due - 1 then
    v_new_status := 'paid';
  elsif v_net > 0 then
    v_new_status := 'partial';
  else
    v_new_status := 'unpaid';
  end if;

  update public.sales_orders
  set payment_status = v_new_status, updated_at = now()
  where id = v_sale.id;

  return v_new_status;
end;
$$;

revoke all on function public.recompute_sale_payment_status(uuid) from public;
grant execute on function public.recompute_sale_payment_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Shared gates helper (inline in each RPC for clarity)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- void_sale_payment
-- ---------------------------------------------------------------------------
create or replace function public.void_sale_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_pay public.sales_payments%rowtype;
  v_sale public.sales_orders%rowtype;
  v_shift_status text;
  v_has_final boolean;
  v_new_status text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs bejelentkezés.');
  end if;

  select * into v_pay
  from public.sales_payments
  where id = p_payment_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A fizetés nem található.');
  end if;

  if coalesce(v_pay.kind, 'payment') <> 'payment' or v_pay.sales_return_id is not null then
    return jsonb_build_object('ok', false, 'message', 'Visszatérítés nem törölhető innen.');
  end if;

  if v_pay.provider_ref is not null and length(trim(v_pay.provider_ref)) > 0 then
    return jsonb_build_object('ok', false, 'message', 'Terminálos fizetés nem törölhető.');
  end if;

  if v_pay.status <> 'completed' then
    return jsonb_build_object('ok', false, 'message', 'Ez a fizetés már érvénytelen.');
  end if;

  select * into v_sale
  from public.sales_orders
  where id = v_pay.sales_order_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Az eladás nem található.');
  end if;

  if not public.can_write_tenant(v_sale.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  if v_sale.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'message', 'Törölt eladáson nem módosítható a fizetés.');
  end if;

  if v_sale.payment_status in ('refunded', 'partially_refunded') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Visszáru után a fizetések nem módosíthatók.'
    );
  end if;

  select exists (
    select 1
    from public.invoices i
    where i.tenant_id = v_sale.tenant_id
      and i.related_source_type = 'sale'
      and i.related_source_id = v_sale.id
      and i.deleted_at is null
      and i.invoice_type = 'szamla'
      and i.is_storno_of_invoice_id is null
      and not exists (
        select 1 from public.invoices s
        where s.is_storno_of_invoice_id = i.id
          and s.deleted_at is null
          and s.invoice_type = 'sztorno'
      )
  ) into v_has_final;

  if v_has_final then
    return jsonb_build_object(
      'ok', false,
      'message', 'Aktív számla mellett a fizetés nem törölhető. Előbb sztornózd a számlát.'
    );
  end if;

  if v_sale.pos_shift_id is not null then
    select status into v_shift_status
    from public.pos_shifts
    where id = v_sale.pos_shift_id;

    if v_shift_status is distinct from 'open' then
      return jsonb_build_object(
        'ok', false,
        'message', 'Zárt műszakhoz tartozó fizetés nem törölhető.'
      );
    end if;
  end if;

  update public.sales_payments
  set status = 'voided',
      deleted_at = now()
  where id = v_pay.id;

  v_new_status := public.recompute_sale_payment_status(v_sale.id);

  return jsonb_build_object(
    'ok', true,
    'id', v_sale.id,
    'payment_status', v_new_status
  );
end;
$$;

revoke all on function public.void_sale_payment(uuid) from public;
grant execute on function public.void_sale_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_sale_payment
-- ---------------------------------------------------------------------------
create or replace function public.update_sale_payment(
  p_payment_id uuid,
  p_payment_method_id uuid,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_pay public.sales_payments%rowtype;
  v_sale public.sales_orders%rowtype;
  v_shift_status text;
  v_has_final boolean;
  v_amt numeric;
  v_pm_name text;
  v_due numeric;
  v_other_net numeric;
  v_new_status text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs bejelentkezés.');
  end if;

  begin
    v_amt := round(p_amount);
  exception when others then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen összeg.');
  end;

  if v_amt is null or v_amt <= 0 then
    return jsonb_build_object('ok', false, 'message', 'A fizetés legyen pozitív összeg.');
  end if;

  if p_payment_method_id is null then
    return jsonb_build_object('ok', false, 'message', 'Válaszd ki a fizetési módot.');
  end if;

  select * into v_pay
  from public.sales_payments
  where id = p_payment_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A fizetés nem található.');
  end if;

  if coalesce(v_pay.kind, 'payment') <> 'payment' or v_pay.sales_return_id is not null then
    return jsonb_build_object('ok', false, 'message', 'Visszatérítés nem szerkeszthető.');
  end if;

  if v_pay.provider_ref is not null and length(trim(v_pay.provider_ref)) > 0 then
    return jsonb_build_object('ok', false, 'message', 'Terminálos fizetés nem szerkeszthető.');
  end if;

  if v_pay.status <> 'completed' then
    return jsonb_build_object('ok', false, 'message', 'Ez a fizetés már érvénytelen.');
  end if;

  select * into v_sale
  from public.sales_orders
  where id = v_pay.sales_order_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Az eladás nem található.');
  end if;

  if not public.can_write_tenant(v_sale.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  if v_sale.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'message', 'Törölt eladáson nem módosítható a fizetés.');
  end if;

  if v_sale.payment_status in ('refunded', 'partially_refunded') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Visszáru után a fizetések nem módosíthatók.'
    );
  end if;

  select exists (
    select 1
    from public.invoices i
    where i.tenant_id = v_sale.tenant_id
      and i.related_source_type = 'sale'
      and i.related_source_id = v_sale.id
      and i.deleted_at is null
      and i.invoice_type = 'szamla'
      and i.is_storno_of_invoice_id is null
      and not exists (
        select 1 from public.invoices s
        where s.is_storno_of_invoice_id = i.id
          and s.deleted_at is null
          and s.invoice_type = 'sztorno'
      )
  ) into v_has_final;

  if v_has_final then
    return jsonb_build_object(
      'ok', false,
      'message', 'Aktív számla mellett a fizetés nem módosítható. Előbb sztornózd a számlát.'
    );
  end if;

  if v_sale.pos_shift_id is not null then
    select status into v_shift_status
    from public.pos_shifts
    where id = v_sale.pos_shift_id;

    if v_shift_status is distinct from 'open' then
      return jsonb_build_object(
        'ok', false,
        'message', 'Zárt műszakhoz tartozó fizetés nem módosítható.'
      );
    end if;
  end if;

  select name into v_pm_name
  from public.payment_methods
  where id = p_payment_method_id
    and tenant_id = v_sale.tenant_id
    and deleted_at is null
    and active = true;

  if v_pm_name is null then
    return jsonb_build_object('ok', false, 'message', 'Ismeretlen vagy inaktív fizetési mód.');
  end if;

  v_due := coalesce(v_sale.total_gross, 0) + coalesce(v_sale.cash_rounding_amount, 0);

  select coalesce(sum(case
    when coalesce(sp.kind, 'payment') = 'refund' then -sp.amount
    else sp.amount
  end), 0)
  into v_other_net
  from public.sales_payments sp
  where sp.sales_order_id = v_sale.id
    and sp.deleted_at is null
    and sp.status = 'completed'
    and sp.id <> v_pay.id;

  if v_other_net + v_amt > v_due + 1 then
    return jsonb_build_object(
      'ok', false,
      'message',
        'A fizetés meghaladja a hátralékot (max: '
        || greatest(0, v_due - v_other_net)::text || ' Ft).'
    );
  end if;

  update public.sales_payments
  set payment_method_id = p_payment_method_id,
      payment_method_name = v_pm_name,
      amount = v_amt
  where id = v_pay.id;

  v_new_status := public.recompute_sale_payment_status(v_sale.id);

  return jsonb_build_object(
    'ok', true,
    'id', v_sale.id,
    'payment_status', v_new_status
  );
end;
$$;

revoke all on function public.update_sale_payment(uuid, uuid, numeric) from public;
grant execute on function public.update_sale_payment(uuid, uuid, numeric) to authenticated;

-- record_sale_payment: aktív végszámla tiltás
create or replace function public.record_sale_payment(
  p_sales_order_id uuid,
  p_payment_method_id uuid,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales_orders%rowtype;
  v_user_id uuid := auth.uid();
  v_pm_name text;
  v_amt numeric;
  v_paid_sum numeric;
  v_due numeric;
  v_new_status text;
  v_has_final boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs bejelentkezés.');
  end if;

  begin
    v_amt := round(p_amount);
  exception when others then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen összeg.');
  end;

  if v_amt is null or v_amt <= 0 then
    return jsonb_build_object('ok', false, 'message', 'A fizetés legyen pozitív összeg.');
  end if;

  if p_payment_method_id is null then
    return jsonb_build_object('ok', false, 'message', 'Válaszd ki a fizetési módot.');
  end if;

  select * into v_sale
  from public.sales_orders
  where id = p_sales_order_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Az eladás nem található.');
  end if;

  if not public.can_write_tenant(v_sale.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  if v_sale.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'message', 'Törölt eladáson nem rögzíthető fizetés.');
  end if;

  if v_sale.payment_status in ('paid', 'refunded', 'partially_refunded') then
    return jsonb_build_object('ok', false, 'message', 'Az eladás már teljesen kiegyenlítve vagy visszáru alatt van.');
  end if;

  select exists (
    select 1
    from public.invoices i
    where i.tenant_id = v_sale.tenant_id
      and i.related_source_type = 'sale'
      and i.related_source_id = v_sale.id
      and i.deleted_at is null
      and i.invoice_type = 'szamla'
      and i.is_storno_of_invoice_id is null
      and not exists (
        select 1 from public.invoices s
        where s.is_storno_of_invoice_id = i.id
          and s.deleted_at is null
          and s.invoice_type = 'sztorno'
      )
  ) into v_has_final;

  if v_has_final then
    return jsonb_build_object(
      'ok', false,
      'message', 'Aktív számla mellett nem rögzíthető fizetés. Előbb sztornózd a számlát.'
    );
  end if;

  select name into v_pm_name
  from public.payment_methods
  where id = p_payment_method_id
    and tenant_id = v_sale.tenant_id
    and deleted_at is null
    and active = true;

  if v_pm_name is null then
    return jsonb_build_object('ok', false, 'message', 'Ismeretlen vagy inaktív fizetési mód.');
  end if;

  v_due := coalesce(v_sale.total_gross, 0) + coalesce(v_sale.cash_rounding_amount, 0);

  select coalesce(sum(case
    when sp.kind = 'refund' then -sp.amount
    else sp.amount
  end), 0)
  into v_paid_sum
  from public.sales_payments sp
  where sp.sales_order_id = v_sale.id
    and sp.deleted_at is null
    and sp.status = 'completed';

  if v_paid_sum + v_amt > v_due + 1 then
    return jsonb_build_object(
      'ok', false,
      'message',
        'A fizetés meghaladja a hátralékot (hátralék: '
        || greatest(0, v_due - v_paid_sum)::text || ' Ft).'
    );
  end if;

  insert into public.sales_payments (
    tenant_id, sales_order_id, payment_method_id,
    payment_method_name, amount, status, kind, created_by
  ) values (
    v_sale.tenant_id, v_sale.id, p_payment_method_id,
    v_pm_name, v_amt, 'completed', 'payment', v_user_id
  );

  v_new_status := public.recompute_sale_payment_status(v_sale.id);

  return jsonb_build_object(
    'ok', true,
    'id', v_sale.id,
    'payment_status', v_new_status,
    'paid_sum', v_paid_sum + v_amt,
    'due', v_due
  );
end;
$$;

revoke all on function public.record_sale_payment(uuid, uuid, numeric) from public;
grant execute on function public.record_sale_payment(uuid, uuid, numeric) to authenticated;

comment on function public.void_sale_payment(uuid) is
  'Fizetési sor érvénytelenítése (elütés); payment_status újraszámolás.';
comment on function public.update_sale_payment(uuid, uuid, numeric) is
  'Fizetési sor szerkesztése (összeg/mód); payment_status újraszámolás.';
