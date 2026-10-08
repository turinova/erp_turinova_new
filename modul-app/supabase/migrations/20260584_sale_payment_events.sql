-- Fizetési tevékenységnapló (append-only) + void indok + korrekció (void+új) + kapuk.
-- Edge: returned tiltás recordnál, late_settlement, provider_ref create_sale-ből.

-- ---------------------------------------------------------------------------
-- Columns on sales_payments
-- ---------------------------------------------------------------------------
alter table public.sales_payments
  add column if not exists created_by_label text,
  add column if not exists voided_by uuid references auth.users (id) on delete set null,
  add column if not exists void_reason text;

-- ---------------------------------------------------------------------------
-- sales_payment_events (immutable journal)
-- ---------------------------------------------------------------------------
create table if not exists public.sales_payment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders (id) on delete cascade,
  sales_payment_id uuid references public.sales_payments (id) on delete set null,

  event_type text not null
    check (event_type in ('recorded', 'voided', 'corrected', 'refunded', 'note')),
  source text not null default 'record'
    check (source in ('create_sale', 'record', 'edit', 'void', 'return', 'note', 'backfill')),

  amount numeric(12, 0),
  payment_method_id uuid,
  payment_method_name text,

  previous_amount numeric(12, 0),
  previous_payment_method_id uuid,
  previous_payment_method_name text,

  note text,
  late_settlement boolean not null default false,

  created_by uuid references auth.users (id) on delete set null,
  created_by_label text,
  created_at timestamptz not null default now()
);

create index if not exists sales_payment_events_sale_idx
  on public.sales_payment_events (sales_order_id, created_at desc);

create index if not exists sales_payment_events_payment_idx
  on public.sales_payment_events (sales_payment_id)
  where sales_payment_id is not null;

alter table public.sales_payment_events enable row level security;

drop policy if exists sales_payment_events_select_member on public.sales_payment_events;
create policy sales_payment_events_select_member
  on public.sales_payment_events for select to authenticated
  using (public.is_tenant_member(tenant_id));

-- Nincs update/delete policy — append-only (írás security definer RPC / trigger).

comment on table public.sales_payment_events is
  'Append-only fizetési tevékenység: ki/mikor/mit; egyenleg továbbra is sales_payments.';

-- ---------------------------------------------------------------------------
-- Helper: insert event
-- ---------------------------------------------------------------------------
create or replace function public.insert_sales_payment_event(
  p_tenant_id uuid,
  p_sales_order_id uuid,
  p_sales_payment_id uuid,
  p_event_type text,
  p_source text,
  p_amount numeric,
  p_payment_method_id uuid,
  p_payment_method_name text,
  p_previous_amount numeric,
  p_previous_payment_method_id uuid,
  p_previous_payment_method_name text,
  p_note text,
  p_late_settlement boolean,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_label text;
begin
  v_label := case
    when p_created_by is null then null
    else public.pos_user_label(p_created_by)
  end;

  insert into public.sales_payment_events (
    tenant_id, sales_order_id, sales_payment_id,
    event_type, source,
    amount, payment_method_id, payment_method_name,
    previous_amount, previous_payment_method_id, previous_payment_method_name,
    note, late_settlement, created_by, created_by_label
  ) values (
    p_tenant_id, p_sales_order_id, p_sales_payment_id,
    p_event_type, coalesce(nullif(p_source, ''), 'record'),
    p_amount, p_payment_method_id, p_payment_method_name,
    p_previous_amount, p_previous_payment_method_id, p_previous_payment_method_name,
    nullif(trim(coalesce(p_note, '')), ''),
    coalesce(p_late_settlement, false),
    p_created_by, v_label
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_sales_payment_event(
  uuid, uuid, uuid, text, text, numeric, uuid, text, numeric, uuid, text, text, boolean, uuid
) from public;

-- ---------------------------------------------------------------------------
-- Trigger: auto journal on payment INSERT
-- ---------------------------------------------------------------------------
create or replace function public.trg_sales_payments_journal_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := coalesce(nullif(current_setting('app.payment_event_source', true), ''), 'record');
  v_late boolean := coalesce(current_setting('app.payment_late_settlement', true), '0') = '1';
  v_skip text := coalesce(current_setting('app.payment_skip_journal', true), '0');
  v_type text;
begin
  -- Korrekció (update RPC) saját corrected eventet ír — ne duplázzuk.
  if v_skip = '1' then
    return NEW;
  end if;

  v_type := case
    when coalesce(NEW.kind, 'payment') = 'refund' then 'refunded'
    else 'recorded'
  end;

  if v_source = 'return' or coalesce(NEW.kind, 'payment') = 'refund' then
    v_source := 'return';
    v_type := 'refunded';
  end if;

  perform public.insert_sales_payment_event(
    NEW.tenant_id,
    NEW.sales_order_id,
    NEW.id,
    v_type,
    v_source,
    NEW.amount,
    NEW.payment_method_id,
    NEW.payment_method_name,
    null, null, null,
    null,
    v_late,
    NEW.created_by
  );

  return NEW;
end;
$$;

drop trigger if exists trg_sales_payments_journal_insert on public.sales_payments;
create trigger trg_sales_payments_journal_insert
  after insert on public.sales_payments
  for each row
  execute function public.trg_sales_payments_journal_insert();

-- BEFORE INSERT: fill created_by_label
create or replace function public.trg_sales_payments_set_label()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.created_by_label is null and NEW.created_by is not null then
    NEW.created_by_label := public.pos_user_label(NEW.created_by);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sales_payments_set_label on public.sales_payments;
create trigger trg_sales_payments_set_label
  before insert on public.sales_payments
  for each row
  execute function public.trg_sales_payments_set_label();

-- ---------------------------------------------------------------------------
-- Backfill events for existing payments
-- ---------------------------------------------------------------------------
insert into public.sales_payment_events (
  tenant_id, sales_order_id, sales_payment_id,
  event_type, source, amount, payment_method_id, payment_method_name,
  note, late_settlement, created_by, created_by_label, created_at
)
select
  sp.tenant_id,
  sp.sales_order_id,
  sp.id,
  case
    when coalesce(sp.kind, 'payment') = 'refund' then 'refunded'
    when sp.status = 'voided' then 'voided'
    else 'recorded'
  end,
  'backfill',
  sp.amount,
  sp.payment_method_id,
  sp.payment_method_name,
  sp.void_reason,
  false,
  sp.created_by,
  coalesce(sp.created_by_label, case when sp.created_by is not null then public.pos_user_label(sp.created_by) end),
  coalesce(sp.paid_at, sp.created_at)
from public.sales_payments sp
where not exists (
  select 1 from public.sales_payment_events e where e.sales_payment_id = sp.id
);

update public.sales_payments sp
set created_by_label = public.pos_user_label(sp.created_by)
where sp.created_by is not null
  and (sp.created_by_label is null or sp.created_by_label = '');

-- ---------------------------------------------------------------------------
-- void_sale_payment(payment_id, note) — kötelező indok
-- ---------------------------------------------------------------------------
drop function if exists public.void_sale_payment(uuid);

create or replace function public.void_sale_payment(
  p_payment_id uuid,
  p_note text
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
  v_new_status text;
  v_note text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs bejelentkezés.');
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is null then
    return jsonb_build_object('ok', false, 'message', 'Az érvénytelenítés indoka kötelező.');
  end if;
  if length(v_note) > 500 then
    return jsonb_build_object('ok', false, 'message', 'Az indok legfeljebb 500 karakter.');
  end if;

  select * into v_pay
  from public.sales_payments
  where id = p_payment_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A fizetés nem található.');
  end if;

  if coalesce(v_pay.kind, 'payment') <> 'payment' or v_pay.sales_return_id is not null then
    return jsonb_build_object('ok', false, 'message', 'Visszatérítés nem érvényteleníthető innen.');
  end if;

  if v_pay.provider_ref is not null and length(trim(v_pay.provider_ref)) > 0 then
    return jsonb_build_object('ok', false, 'message', 'Terminálos fizetés nem érvényteleníthető.');
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

  if v_sale.status = 'returned' then
    return jsonb_build_object('ok', false, 'message', 'Visszáruzott eladáson a fizetés nem módosítható.');
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
      'message', 'Aktív számla mellett a fizetés nem érvényteleníthető. Előbb sztornózd a számlát.'
    );
  end if;

  if v_sale.pos_shift_id is not null then
    select status into v_shift_status
    from public.pos_shifts
    where id = v_sale.pos_shift_id;

    if v_shift_status is distinct from 'open' then
      return jsonb_build_object(
        'ok', false,
        'message', 'Zárt műszakhoz tartozó fizetés nem érvényteleníthető.'
      );
    end if;
  end if;

  update public.sales_payments
  set status = 'voided',
      deleted_at = now(),
      voided_by = v_user_id,
      void_reason = v_note
  where id = v_pay.id;

  perform public.insert_sales_payment_event(
    v_sale.tenant_id,
    v_sale.id,
    v_pay.id,
    'voided',
    'void',
    v_pay.amount,
    v_pay.payment_method_id,
    v_pay.payment_method_name,
    null, null, null,
    v_note,
    false,
    v_user_id
  );

  v_new_status := public.recompute_sale_payment_status(v_sale.id);

  return jsonb_build_object(
    'ok', true,
    'id', v_sale.id,
    'payment_status', v_new_status
  );
end;
$$;

revoke all on function public.void_sale_payment(uuid, text) from public;
grant execute on function public.void_sale_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_sale_payment → void + új insert (korrekció) + kötelező note
-- ---------------------------------------------------------------------------
drop function if exists public.update_sale_payment(uuid, uuid, numeric);

create or replace function public.update_sale_payment(
  p_payment_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_note text
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
  v_note text;
  v_new_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs bejelentkezés.');
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is null then
    return jsonb_build_object('ok', false, 'message', 'A korrekció indoka kötelező.');
  end if;
  if length(v_note) > 500 then
    return jsonb_build_object('ok', false, 'message', 'Az indok legfeljebb 500 karakter.');
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

  if v_sale.status = 'returned' then
    return jsonb_build_object('ok', false, 'message', 'Visszáruzott eladáson a fizetés nem módosítható.');
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

  -- 1) void régi
  update public.sales_payments
  set status = 'voided',
      deleted_at = now(),
      voided_by = v_user_id,
      void_reason = v_note
  where id = v_pay.id;

  perform public.insert_sales_payment_event(
    v_sale.tenant_id,
    v_sale.id,
    v_pay.id,
    'voided',
    'edit',
    v_pay.amount,
    v_pay.payment_method_id,
    v_pay.payment_method_name,
    null, null, null,
    v_note,
    false,
    v_user_id
  );

  -- 2) új sor (trigger skip → egy corrected event)
  perform set_config('app.payment_event_source', 'edit', true);
  perform set_config('app.payment_late_settlement', '0', true);
  perform set_config('app.payment_skip_journal', '1', true);

  insert into public.sales_payments (
    tenant_id, sales_order_id, payment_method_id,
    payment_method_name, amount, status, kind, created_by, created_by_label
  ) values (
    v_sale.tenant_id, v_sale.id, p_payment_method_id,
    v_pm_name, v_amt, 'completed', 'payment', v_user_id,
    public.pos_user_label(v_user_id)
  )
  returning id into v_new_id;

  perform set_config('app.payment_skip_journal', '0', true);

  perform public.insert_sales_payment_event(
    v_sale.tenant_id,
    v_sale.id,
    v_new_id,
    'corrected',
    'edit',
    v_amt,
    p_payment_method_id,
    v_pm_name,
    v_pay.amount,
    v_pay.payment_method_id,
    v_pay.payment_method_name,
    v_note,
    false,
    v_user_id
  );

  v_new_status := public.recompute_sale_payment_status(v_sale.id);

  return jsonb_build_object(
    'ok', true,
    'id', v_sale.id,
    'payment_status', v_new_status,
    'payment_id', v_new_id
  );
end;
$$;

revoke all on function public.update_sale_payment(uuid, uuid, numeric, text) from public;
grant execute on function public.update_sale_payment(uuid, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- record_sale_payment: returned tiltás + late_settlement
-- ---------------------------------------------------------------------------
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
  v_shift_status text;
  v_late boolean := false;
  v_pay_id uuid;
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

  if v_sale.status = 'returned' then
    return jsonb_build_object('ok', false, 'message', 'Visszáruzott eladáson nem rögzíthető fizetés.');
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

  if v_sale.pos_shift_id is not null then
    select status into v_shift_status
    from public.pos_shifts
    where id = v_sale.pos_shift_id;
    if v_shift_status is distinct from 'open' then
      v_late := true;
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

  perform set_config('app.payment_event_source', 'record', true);
  perform set_config('app.payment_late_settlement', case when v_late then '1' else '0' end, true);

  insert into public.sales_payments (
    tenant_id, sales_order_id, payment_method_id,
    payment_method_name, amount, status, kind, created_by, created_by_label
  ) values (
    v_sale.tenant_id, v_sale.id, p_payment_method_id,
    v_pm_name, v_amt, 'completed', 'payment', v_user_id,
    public.pos_user_label(v_user_id)
  )
  returning id into v_pay_id;

  v_new_status := public.recompute_sale_payment_status(v_sale.id);

  return jsonb_build_object(
    'ok', true,
    'id', v_sale.id,
    'payment_status', v_new_status,
    'paid_sum', v_paid_sum + v_amt,
    'due', v_due,
    'late_settlement', v_late,
    'payment_id', v_pay_id
  );
end;
$$;

revoke all on function public.record_sale_payment(uuid, uuid, numeric) from public;
grant execute on function public.record_sale_payment(uuid, uuid, numeric) to authenticated;

comment on function public.void_sale_payment(uuid, text) is
  'Fizetés érvénytelenítése kötelező indokkal + naplóbejegyzés.';
comment on function public.update_sale_payment(uuid, uuid, numeric, text) is
  'Fizetés korrekció: void + új sor + kötelező indok + napló.';
comment on function public.record_sale_payment(uuid, uuid, numeric) is
  'Új fizetés; returned tiltva; zárt műszaknál late_settlement flag.';
create or replace function public.create_sale(
  p_warehouse_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_note text,
  p_items jsonb,
  p_fees jsonb,
  p_discount jsonb,
  p_payments jsonb,
  p_pos_register_id uuid default null,
  p_fulfill_now boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wh public.warehouses%rowtype;
  v_tenant_id uuid;
  v_user_id uuid := auth.uid();
  v_seller_label text;
  v_pos_register_id uuid;
  v_pos_shift_id uuid;
  v_sale_id uuid;
  v_sale_number text;
  v_channel text;
  v_customer_name text;
  v_customer_email text;
  v_customer_mobile text;
  v_billing_name text;
  v_billing_country text;
  v_billing_city text;
  v_billing_postal_code text;
  v_billing_street text;
  v_billing_house_number text;
  v_billing_tax_number text;
  v_item jsonb;
  v_fee jsonb;
  v_pay jsonb;
  v_acc public.accessories%rowtype;
  v_tax_pct numeric(5, 2);
  v_unit_shortform text;
  v_qty numeric(14, 3);
  v_unit_net numeric(12, 0);
  v_unit_gross numeric(12, 0);
  v_line_net numeric(12, 0);
  v_line_vat numeric(12, 0);
  v_line_gross_before numeric(12, 0);
  v_line_gross numeric(12, 0);
  v_item_disc_pct numeric(5, 2);
  v_item_disc_amt numeric(12, 0);
  v_sub_net numeric(12, 0) := 0;
  v_sub_vat numeric(12, 0) := 0;
  v_sub_gross numeric(12, 0) := 0;
  v_glob_disc_pct numeric(5, 2);
  v_glob_disc_amt numeric(12, 0);
  v_total_net numeric(12, 0);
  v_total_vat numeric(12, 0);
  v_total_gross numeric(12, 0);
  v_cash_round numeric(12, 0) := 0;
  v_pay_sum numeric(12, 0) := 0;
  v_due numeric(12, 0);
  v_sort integer := 0;
  v_sm_number text;
  v_pm_name text;
  v_pm_id uuid;
  v_pay_amt numeric(12, 0);
  v_pay_status text;
  v_prepared_items jsonb := '[]'::jsonb;
  v_prepared_fees jsonb := '[]'::jsonb;
  v_row jsonb;
  v_fee_name text;
  v_has_cash boolean := false;
  v_do_fulfill boolean := false;
  v_sale_status text;
  v_line_kind text;
  v_sheet public.sheet_materials%rowtype;
  v_linear public.linear_materials%rowtype;
  v_area_m2 numeric(14, 6);
  v_piece_m numeric(14, 6);
  v_stock_qty numeric(14, 6);
  v_sku_snap text;
  v_has_lapszab boolean;
begin
  v_channel := coalesce(nullif(trim(p_channel), ''), 'manual');
  if v_channel not in ('manual', 'pos', 'webshop') then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen csatorna.');
  end if;

  if p_warehouse_id is null then
    return jsonb_build_object('ok', false, 'message', 'Válaszd ki a raktárat.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Adj hozzá legalább egy terméket.');
  end if;

  -- Üres tömb = unpaid (utalás / későbbi settlement). Null / nem tömb = hiba.
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen fizetés lista.');
  end if;

  select * into v_wh
  from public.warehouses
  where id = p_warehouse_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A raktár nem található.');
  end if;

  if not v_wh.is_active then
    return jsonb_build_object('ok', false, 'message', 'A raktár inaktív.');
  end if;

  if not public.can_write_tenant(v_wh.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  v_tenant_id := v_wh.tenant_id;

  select coalesce(u.email, u.id::text) into v_seller_label
  from auth.users u where u.id = v_user_id;

  v_pos_register_id := null;
  v_pos_shift_id := null;
  if v_channel = 'pos' then
    if p_pos_register_id is null then
      return jsonb_build_object('ok', false, 'message', 'Válaszd ki a pénztárat.');
    end if;
    select r.id into v_pos_register_id
    from public.pos_registers r
    where r.id = p_pos_register_id
      and r.tenant_id = v_tenant_id
      and r.warehouse_id = p_warehouse_id
      and r.is_active = true
      and r.deleted_at is null;
    if v_pos_register_id is null then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen vagy inaktív pénztár.');
    end if;
    select s.id into v_pos_shift_id
    from public.pos_shifts s
    where s.pos_register_id = v_pos_register_id
      and s.tenant_id = v_tenant_id
      and s.status = 'open'
    for update;
    if v_pos_shift_id is null then
      return jsonb_build_object('ok', false, 'message', 'Előbb nyisd meg a műszakot.');
    end if;
  end if;

  if p_customer_id is not null then
    select
      c.name,
      c.email,
      c.mobile,
      c.billing_name,
      coalesce(nullif(trim(c.billing_country), ''), 'Magyarország'),
      c.billing_city,
      c.billing_postal_code,
      c.billing_street,
      c.billing_house_number,
      c.billing_tax_number
    into
      v_customer_name,
      v_customer_email,
      v_customer_mobile,
      v_billing_name,
      v_billing_country,
      v_billing_city,
      v_billing_postal_code,
      v_billing_street,
      v_billing_house_number,
      v_billing_tax_number
    from public.customers c
    where c.id = p_customer_id and c.tenant_id = v_tenant_id and c.deleted_at is null;
    if v_customer_name is null then
      return jsonb_build_object('ok', false, 'message', 'Az ügyfél nem található.');
    end if;
  end if;

  -- Pass 1: products + materials (sheet m2 / linear m)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_qty := (v_item ->> 'quantity')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen mennyiség.');
    end;

    if v_qty is null or v_qty <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Minden tételnél legyen pozitív mennyiség.');
    end if;

    v_line_kind := coalesce(
      nullif(trim(v_item ->> 'line_kind'), ''),
      case
        when nullif(v_item ->> 'sheet_material_id', '') is not null then 'sheet_material'
        when nullif(v_item ->> 'linear_material_id', '') is not null then 'linear_material'
        else 'product'
      end
    );

    if v_line_kind in ('sheet_material', 'linear_material') then
      v_qty := round(v_qty::numeric, 1);
      if v_qty <= 0 then
        return jsonb_build_object('ok', false, 'message', 'Anyag mennyiség legyen legalább 0,1.');
      end if;

      select exists(
        select 1 from public.tenant_entitlements te
        where te.tenant_id = v_tenant_id and te.feature_key = 'lapszabaszat'
      ) into v_has_lapszab;
      if not coalesce(v_has_lapszab, false) then
        return jsonb_build_object('ok', false, 'message', 'Anyag eladáshoz Lapszabászat add-on kell.');
      end if;
    end if;

    if v_line_kind = 'product' then
      select * into v_acc
      from public.accessories
      where id = (v_item ->> 'accessory_id')::uuid
        and tenant_id = v_tenant_id
        and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen termék a listában.');
      end if;
      select coalesce(u.shortform, 'db') into v_unit_shortform
      from public.units u where u.id = v_acc.unit_id;
      select coalesce(t.rate_percent, 0)::numeric into v_tax_pct
      from public.tax_rates t where t.id = v_acc.tax_rate_id;
      if v_item ? 'unit_price_gross' and nullif(v_item ->> 'unit_price_gross', '') is not null then
        v_unit_gross := round((v_item ->> 'unit_price_gross')::numeric);
      else
        v_unit_gross := round(coalesce(v_acc.price_net, 0) * (1 + coalesce(v_tax_pct, 0) / 100.0));
      end if;
      v_sku_snap := v_acc.sku;
      v_stock_qty := v_qty;
      if v_tax_pct > 0 then v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100)); else v_unit_net := v_unit_gross; end if;
      v_line_net := round(v_qty * v_unit_net);
      v_line_vat := round(v_line_net * v_tax_pct / 100);
      v_line_gross_before := v_line_net + v_line_vat;
      v_item_disc_pct := coalesce((v_item ->> 'discount_percentage')::numeric, 0);
      v_item_disc_amt := coalesce((v_item ->> 'discount_amount')::numeric, 0);
      if v_item_disc_amt = 0 and v_item_disc_pct > 0 then
        v_item_disc_amt := round(v_line_gross_before * v_item_disc_pct / 100);
      else
        v_item_disc_amt := round(v_item_disc_amt);
      end if;
      if v_item_disc_amt > v_line_gross_before then v_item_disc_amt := v_line_gross_before; end if;
      v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
      if v_line_gross_before > 0 and v_line_gross > 0 then
        v_line_vat := round(v_line_vat * (v_line_gross::numeric / v_line_gross_before));
        v_line_net := v_line_gross - v_line_vat;
      else
        v_line_vat := 0; v_line_net := 0;
      end if;
      v_prepared_items := v_prepared_items || jsonb_build_array(jsonb_build_object(
        'item_kind', 'product', 'accessory_id', v_acc.id,
        'sheet_material_id', null, 'linear_material_id', null,
        'name', v_acc.name, 'sku', v_sku_snap,
        'unit_shortform', coalesce(v_unit_shortform, 'db'),
        'quantity', v_qty, 'stock_qty', v_stock_qty,
        'unit_price_net', v_unit_net, 'unit_price_gross', v_unit_gross,
        'tax_rate_percent', v_tax_pct,
        'discount_percentage', v_item_disc_pct, 'discount_amount', v_item_disc_amt,
        'total_net', v_line_net, 'total_vat', v_line_vat, 'total_gross', v_line_gross
      ));

    elsif v_line_kind = 'sheet_material' then
      select * into v_sheet from public.sheet_materials
      where id = (v_item ->> 'sheet_material_id')::uuid and tenant_id = v_tenant_id and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen táblás anyag a listában.');
      end if;
      if not v_sheet.active then
        return jsonb_build_object('ok', false, 'message', 'Inaktív táblás anyag nem adható el.');
      end if;
      v_area_m2 := (v_sheet.length_mm::numeric * v_sheet.width_mm::numeric) / 1000000.0;
      if v_area_m2 <= 0 then
        return jsonb_build_object('ok', false, 'message', 'Érvénytelen tábla méret.');
      end if;
      select coalesce(t.rate_percent, 0)::numeric into v_tax_pct from public.tax_rates t where t.id = v_sheet.tax_rate_id;
      if v_item ? 'unit_price_gross' and nullif(v_item ->> 'unit_price_gross', '') is not null then
        v_unit_gross := round((v_item ->> 'unit_price_gross')::numeric);
      else
        v_unit_gross := round(coalesce(v_sheet.price_net, 0) * (1 + coalesce(v_tax_pct, 0) / 100.0));
      end if;
      v_unit_shortform := 'm2';
      v_sku_snap := v_sheet.length_mm::text || '×' || v_sheet.width_mm::text || '×' || trim(to_char(v_sheet.thickness_mm, 'FM999990.99'));
      v_stock_qty := round(v_qty / v_area_m2, 6);
      if v_tax_pct > 0 then v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100)); else v_unit_net := v_unit_gross; end if;
      v_line_net := round(v_qty * v_unit_net);
      v_line_vat := round(v_line_net * v_tax_pct / 100);
      v_line_gross_before := v_line_net + v_line_vat;
      v_item_disc_pct := coalesce((v_item ->> 'discount_percentage')::numeric, 0);
      v_item_disc_amt := coalesce((v_item ->> 'discount_amount')::numeric, 0);
      if v_item_disc_amt = 0 and v_item_disc_pct > 0 then
        v_item_disc_amt := round(v_line_gross_before * v_item_disc_pct / 100);
      else v_item_disc_amt := round(v_item_disc_amt); end if;
      if v_item_disc_amt > v_line_gross_before then v_item_disc_amt := v_line_gross_before; end if;
      v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
      if v_line_gross_before > 0 and v_line_gross > 0 then
        v_line_vat := round(v_line_vat * (v_line_gross::numeric / v_line_gross_before));
        v_line_net := v_line_gross - v_line_vat;
      else v_line_vat := 0; v_line_net := 0; end if;
      v_prepared_items := v_prepared_items || jsonb_build_array(jsonb_build_object(
        'item_kind', 'sheet_material', 'accessory_id', null,
        'sheet_material_id', v_sheet.id, 'linear_material_id', null,
        'name', v_sheet.name, 'sku', v_sku_snap, 'unit_shortform', v_unit_shortform,
        'quantity', v_qty, 'stock_qty', v_stock_qty,
        'unit_price_net', v_unit_net, 'unit_price_gross', v_unit_gross,
        'tax_rate_percent', v_tax_pct,
        'discount_percentage', v_item_disc_pct, 'discount_amount', v_item_disc_amt,
        'total_net', v_line_net, 'total_vat', v_line_vat, 'total_gross', v_line_gross
      ));

    elsif v_line_kind = 'linear_material' then
      select * into v_linear from public.linear_materials
      where id = (v_item ->> 'linear_material_id')::uuid and tenant_id = v_tenant_id and deleted_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen szálas anyag a listában.');
      end if;
      if not v_linear.active then
        return jsonb_build_object('ok', false, 'message', 'Inaktív szálas anyag nem adható el.');
      end if;
      select coalesce(t.rate_percent, 0)::numeric into v_tax_pct from public.tax_rates t where t.id = v_linear.tax_rate_id;
      if v_item ? 'unit_price_gross' and nullif(v_item ->> 'unit_price_gross', '') is not null then
        v_unit_gross := round((v_item ->> 'unit_price_gross')::numeric);
      else
        v_unit_gross := round(coalesce(v_linear.price_net, 0) * (1 + coalesce(v_tax_pct, 0) / 100.0));
      end if;
      v_unit_shortform := 'm';
      v_sku_snap := v_linear.material_type || ' · ' || v_linear.length_mm::text || ' mm';
      v_piece_m := v_linear.length_mm::numeric / 1000.0;
      if coalesce(v_linear.stock_unit, 'db') = 'fm' then
        v_stock_qty := v_qty;
      else
        if v_piece_m <= 0 then
          return jsonb_build_object('ok', false, 'message', 'Érvénytelen szál hossz.');
        end if;
        v_stock_qty := round(v_qty / v_piece_m, 6);
      end if;
      if v_tax_pct > 0 then v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100)); else v_unit_net := v_unit_gross; end if;
      v_line_net := round(v_qty * v_unit_net);
      v_line_vat := round(v_line_net * v_tax_pct / 100);
      v_line_gross_before := v_line_net + v_line_vat;
      v_item_disc_pct := coalesce((v_item ->> 'discount_percentage')::numeric, 0);
      v_item_disc_amt := coalesce((v_item ->> 'discount_amount')::numeric, 0);
      if v_item_disc_amt = 0 and v_item_disc_pct > 0 then
        v_item_disc_amt := round(v_line_gross_before * v_item_disc_pct / 100);
      else v_item_disc_amt := round(v_item_disc_amt); end if;
      if v_item_disc_amt > v_line_gross_before then v_item_disc_amt := v_line_gross_before; end if;
      v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
      if v_line_gross_before > 0 and v_line_gross > 0 then
        v_line_vat := round(v_line_vat * (v_line_gross::numeric / v_line_gross_before));
        v_line_net := v_line_gross - v_line_vat;
      else v_line_vat := 0; v_line_net := 0; end if;
      v_prepared_items := v_prepared_items || jsonb_build_array(jsonb_build_object(
        'item_kind', 'linear_material', 'accessory_id', null,
        'sheet_material_id', null, 'linear_material_id', v_linear.id,
        'name', v_linear.name, 'sku', v_sku_snap, 'unit_shortform', v_unit_shortform,
        'quantity', v_qty, 'stock_qty', v_stock_qty,
        'unit_price_net', v_unit_net, 'unit_price_gross', v_unit_gross,
        'tax_rate_percent', v_tax_pct,
        'discount_percentage', v_item_disc_pct, 'discount_amount', v_item_disc_amt,
        'total_net', v_line_net, 'total_vat', v_line_vat, 'total_gross', v_line_gross
      ));
    else
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen tétel típus.');
    end if;

    v_sub_net := v_sub_net + v_line_net;
    v_sub_vat := v_sub_vat + v_line_vat;
    v_sub_gross := v_sub_gross + v_line_gross;
  end loop;

  -- Fees (optional)
  if p_fees is not null and jsonb_typeof(p_fees) = 'array' then
    for v_fee in select * from jsonb_array_elements(p_fees)
    loop
      v_fee_name := nullif(trim(coalesce(v_fee ->> 'name', '')), '');
      if v_fee_name is null then
        return jsonb_build_object('ok', false, 'message', 'A díj neve kötelező.');
      end if;
      begin
        v_qty := coalesce((v_fee ->> 'quantity')::numeric, 1);
        v_unit_gross := round((v_fee ->> 'unit_price_gross')::numeric);
      exception when others then
        return jsonb_build_object('ok', false, 'message', 'Érvénytelen díj összeg.');
      end;
      if v_qty <= 0 or v_unit_gross < 0 then
        return jsonb_build_object('ok', false, 'message', 'Érvénytelen díj.');
      end if;
      v_tax_pct := coalesce((v_fee ->> 'tax_rate_percent')::numeric, 27);
      if v_tax_pct > 0 then
        v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100));
      else
        v_unit_net := v_unit_gross;
      end if;
      v_line_net := round(v_qty * v_unit_net);
      v_line_vat := round(v_line_net * v_tax_pct / 100);
      v_line_gross := v_line_net + v_line_vat;

      v_prepared_fees := v_prepared_fees || jsonb_build_array(jsonb_build_object(
        'fee_type_id', nullif(v_fee ->> 'fee_type_id', '')::uuid,
        'name', v_fee_name,
        'quantity', v_qty,
        'unit_price_net', v_unit_net,
        'unit_price_gross', v_unit_gross,
        'tax_rate_percent', v_tax_pct,
        'total_net', v_line_net,
        'total_vat', v_line_vat,
        'total_gross', v_line_gross
      ));

      v_sub_net := v_sub_net + v_line_net;
      v_sub_vat := v_sub_vat + v_line_vat;
      v_sub_gross := v_sub_gross + v_line_gross;
    end loop;
  end if;

  -- Global discount
  v_glob_disc_pct := coalesce((p_discount ->> 'percentage')::numeric, 0);
  v_glob_disc_amt := coalesce((p_discount ->> 'amount')::numeric, 0);
  if v_glob_disc_amt = 0 and v_glob_disc_pct > 0 then
    v_glob_disc_amt := round(v_sub_gross * v_glob_disc_pct / 100);
  else
    v_glob_disc_amt := round(v_glob_disc_amt);
  end if;
  if v_glob_disc_amt > v_sub_gross then
    v_glob_disc_amt := v_sub_gross;
  end if;

  v_total_gross := greatest(0, round(v_sub_gross - v_glob_disc_amt));
  if v_sub_gross > 0 and v_total_gross > 0 then
    v_total_vat := round(v_sub_vat * (v_total_gross::numeric / v_sub_gross));
    v_total_net := v_total_gross - v_total_vat;
  else
    v_total_vat := 0;
    v_total_net := 0;
  end if;

  -- Detect cash + validate payments (before any write)
  for v_pay in select * from jsonb_array_elements(p_payments)
  loop
    v_pm_id := nullif(v_pay ->> 'payment_method_id', '')::uuid;
    begin
      v_pay_amt := round((v_pay ->> 'amount')::numeric);
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Érvénytelen fizetési összeg.');
    end;
    if v_pay_amt is null or v_pay_amt <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Minden fizetés legyen pozitív összeg.');
    end if;
    if v_pm_id is not null then
      select name into v_pm_name
      from public.payment_methods
      where id = v_pm_id and tenant_id = v_tenant_id and deleted_at is null;
      if v_pm_name is null then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen fizetési mód.');
      end if;
      if lower(v_pm_name) like '%készpénz%'
        or lower(v_pm_name) like '%keszpenz%'
        or lower(v_pm_name) = 'cash' then
        v_has_cash := true;
      end if;
    end if;
    v_pay_sum := v_pay_sum + v_pay_amt;
  end loop;

  v_due := v_total_gross;
  if v_has_cash and jsonb_array_length(p_payments) = 1 then
    v_due := public.hungarian_cash_round(v_total_gross);
    v_cash_round := v_due - v_total_gross;
  end if;

  -- Üres payments: unpaid. Részfizetés (0 < pay_sum < due): partial. Túlfizetés tiltva.
  if jsonb_array_length(p_payments) > 0 and v_pay_sum > v_due + 1 then
    return jsonb_build_object(
      'ok', false,
      'message',
        'A fizetések összege meghaladja a végösszeget (fizetendő: '
        || v_due::text || ' Ft, megadva: ' || v_pay_sum::text || ' Ft).'
    );
  end if;

  -- Vendég: csak teljes fizetés (hitel / részfizetés csak névre).
  if p_customer_id is null
     and (
       jsonb_array_length(p_payments) = 0
       or v_pay_sum < v_due - 1
     )
  then
    return jsonb_build_object(
      'ok', false,
      'message',
        'Vendégnél csak teljes fizetés engedélyezett. Részfizetéshez vagy hitelhez válassz vevőt.'
    );
  end if;

  if v_pay_sum >= v_due - 1 then
    v_pay_status := 'paid';
  elsif v_pay_sum > 0 then
    v_pay_status := 'partial';
  else
    v_pay_status := 'unpaid';
  end if;

  -- Paid/partial: mindig teljesít (stock out). Unpaid: csak ha p_fulfill_now.
  v_do_fulfill := jsonb_array_length(p_payments) > 0 or coalesce(p_fulfill_now, false);
  v_sale_status := case when v_do_fulfill then 'fulfilled' else 'confirmed' end;

  -- Write
  v_sale_number := public.generate_sale_number(v_tenant_id);
  v_sale_id := gen_random_uuid();

  insert into public.sales_orders (
    id, tenant_id, warehouse_id, customer_id,
    sale_number, channel, status, payment_status,
    customer_name_snapshot,
    customer_email_snapshot,
    customer_mobile_snapshot,
    billing_name_snapshot,
    billing_country_snapshot,
    billing_city_snapshot,
    billing_postal_code_snapshot,
    billing_street_snapshot,
    billing_house_number_snapshot,
    billing_tax_number_snapshot,
    discount_percentage, discount_amount,
    subtotal_net, total_vat, total_gross, cash_rounding_amount,
    note, fulfilled_at, fulfilled_by, created_by,
    created_by_label_snapshot, pos_shift_id, pos_register_id
  ) values (
    v_sale_id, v_tenant_id, p_warehouse_id, p_customer_id,
    v_sale_number, v_channel, v_sale_status, v_pay_status,
    v_customer_name,
    v_customer_email,
    v_customer_mobile,
    v_billing_name,
    v_billing_country,
    v_billing_city,
    v_billing_postal_code,
    v_billing_street,
    v_billing_house_number,
    v_billing_tax_number,
    v_glob_disc_pct, v_glob_disc_amt,
    v_total_net, v_total_vat, v_total_gross, v_cash_round,
    nullif(trim(coalesce(p_note, '')), ''),
    case when v_do_fulfill then now() else null end,
    case when v_do_fulfill then v_user_id else null end,
    v_user_id,
    v_seller_label, v_pos_shift_id, v_pos_register_id
  );

  for v_row in select * from jsonb_array_elements(v_prepared_items)
  loop
    v_line_kind := coalesce(v_row ->> 'item_kind', 'product');
    insert into public.sales_order_items (
      tenant_id, sales_order_id, item_kind,
      accessory_id, sheet_material_id, linear_material_id,
      name_snapshot, sku_snapshot, unit_shortform, quantity,
      unit_price_net, unit_price_gross, tax_rate_percent,
      discount_percentage, discount_amount,
      total_net, total_vat, total_gross, sort_order
    ) values (
      v_tenant_id, v_sale_id, v_line_kind,
      nullif(v_row ->> 'accessory_id', '')::uuid,
      nullif(v_row ->> 'sheet_material_id', '')::uuid,
      nullif(v_row ->> 'linear_material_id', '')::uuid,
      v_row ->> 'name', v_row ->> 'sku', v_row ->> 'unit_shortform',
      (v_row ->> 'quantity')::numeric,
      (v_row ->> 'unit_price_net')::numeric,
      (v_row ->> 'unit_price_gross')::numeric,
      (v_row ->> 'tax_rate_percent')::numeric,
      (v_row ->> 'discount_percentage')::numeric,
      (v_row ->> 'discount_amount')::numeric,
      (v_row ->> 'total_net')::numeric,
      (v_row ->> 'total_vat')::numeric,
      (v_row ->> 'total_gross')::numeric,
      v_sort
    );

    if v_do_fulfill then
      v_stock_qty := coalesce((v_row ->> 'stock_qty')::numeric, (v_row ->> 'quantity')::numeric);
      if v_line_kind = 'product' then
        v_sm_number := public.generate_stock_movement_number(v_tenant_id);
        insert into public.stock_movements (
          tenant_id, warehouse_id, product_type, accessory_id,
          quantity, movement_type, source_type, source_id,
          note, stock_movement_number, created_by
        ) values (
          v_tenant_id, p_warehouse_id, 'accessory', (v_row ->> 'accessory_id')::uuid,
          v_stock_qty, 'out', 'sale', v_sale_id,
          v_row ->> 'name', v_sm_number, v_user_id
        );
      elsif v_line_kind = 'sheet_material' then
        v_sm_number := public.generate_sheet_stock_movement_number(v_tenant_id);
        insert into public.sheet_stock_movements (
          tenant_id, warehouse_id, sheet_material_id,
          quantity, movement_type, source_type, source_id,
          note, stock_movement_number, created_by
        ) values (
          v_tenant_id, p_warehouse_id, (v_row ->> 'sheet_material_id')::uuid,
          v_stock_qty, 'out', 'sale', v_sale_id,
          v_row ->> 'name', v_sm_number, v_user_id
        );
      elsif v_line_kind = 'linear_material' then
        v_sm_number := public.generate_linear_stock_movement_number(v_tenant_id);
        insert into public.linear_stock_movements (
          tenant_id, warehouse_id, linear_material_id,
          quantity, movement_type, source_type, source_id,
          note, stock_movement_number, created_by
        ) values (
          v_tenant_id, p_warehouse_id, (v_row ->> 'linear_material_id')::uuid,
          v_stock_qty, 'out', 'sale', v_sale_id,
          v_row ->> 'name', v_sm_number, v_user_id
        );
      end if;
    end if;

    v_sort := v_sort + 1;
  end loop;

  for v_row in select * from jsonb_array_elements(v_prepared_fees)
  loop
    insert into public.sales_order_items (
      tenant_id, sales_order_id, item_kind, fee_type_id,
      name_snapshot, sku_snapshot, unit_shortform, quantity,
      unit_price_net, unit_price_gross, tax_rate_percent,
      discount_percentage, discount_amount,
      total_net, total_vat, total_gross, sort_order
    ) values (
      v_tenant_id, v_sale_id, 'fee',
      nullif(v_row ->> 'fee_type_id', '')::uuid,
      v_row ->> 'name', null, 'db',
      (v_row ->> 'quantity')::numeric,
      (v_row ->> 'unit_price_net')::numeric,
      (v_row ->> 'unit_price_gross')::numeric,
      (v_row ->> 'tax_rate_percent')::numeric,
      0, 0,
      (v_row ->> 'total_net')::numeric,
      (v_row ->> 'total_vat')::numeric,
      (v_row ->> 'total_gross')::numeric,
      v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  for v_pay in select * from jsonb_array_elements(p_payments)
  loop
    v_pm_id := nullif(v_pay ->> 'payment_method_id', '')::uuid;
    v_pay_amt := round((v_pay ->> 'amount')::numeric);
    v_pm_name := coalesce(nullif(trim(v_pay ->> 'payment_method_name'), ''), 'Fizetés');
    if v_pm_id is not null then
      select name into v_pm_name
      from public.payment_methods
      where id = v_pm_id and tenant_id = v_tenant_id and deleted_at is null;
      if v_pm_name is null then
        return jsonb_build_object('ok', false, 'message', 'Ismeretlen fizetési mód.');
      end if;
    end if;

    perform set_config('app.payment_event_source', 'create_sale', true);
    perform set_config('app.payment_late_settlement', '0', true);

    insert into public.sales_payments (
      tenant_id, sales_order_id, payment_method_id,
      payment_method_name, amount, status, created_by, provider_ref, created_by_label
    ) values (
      v_tenant_id, v_sale_id, v_pm_id,
      v_pm_name, v_pay_amt, 'completed', v_user_id,
      nullif(trim(v_pay ->> 'provider_ref'), ''),
      public.pos_user_label(v_user_id)
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'id', v_sale_id,
    'sale_number', v_sale_number,
    'total_gross', v_total_gross,
    'payment_status', v_pay_status,
    'status', v_sale_status
  );
end;
$$;

revoke all on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid, boolean) from public;
grant execute on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid, boolean) to authenticated;

comment on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid, boolean) is
  'Eladás: provider_ref a payment JSON-ból; fizetésnapló triggerrel.';

