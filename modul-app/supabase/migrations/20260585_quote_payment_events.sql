-- Quote fizetési tevékenységnapló + void/korrekció (értékesítés parity, lean).
-- Depends on: 20260322_quote_payments, 20260514_pos_shifts (pos_user_label)

-- ---------------------------------------------------------------------------
-- Columns on quote_payments
-- ---------------------------------------------------------------------------
alter table public.quote_payments
  add column if not exists created_by_label text,
  add column if not exists voided_by uuid references auth.users (id) on delete set null,
  add column if not exists void_reason text;

-- ---------------------------------------------------------------------------
-- quote_payment_events (immutable journal)
-- ---------------------------------------------------------------------------
create table if not exists public.quote_payment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  quote_payment_id uuid references public.quote_payments (id) on delete set null,

  event_type text not null
    check (event_type in ('recorded', 'voided', 'corrected', 'note')),
  source text not null default 'record'
    check (source in ('convert', 'record', 'edit', 'void', 'note', 'backfill')),

  amount numeric(14, 2),
  payment_method_id uuid,
  payment_method_name text,

  previous_amount numeric(14, 2),
  previous_payment_method_id uuid,
  previous_payment_method_name text,

  note text,

  created_by uuid references auth.users (id) on delete set null,
  created_by_label text,
  created_at timestamptz not null default now()
);

create index if not exists quote_payment_events_quote_idx
  on public.quote_payment_events (quote_id, created_at desc);

create index if not exists quote_payment_events_payment_idx
  on public.quote_payment_events (quote_payment_id)
  where quote_payment_id is not null;

alter table public.quote_payment_events enable row level security;

drop policy if exists quote_payment_events_select_member on public.quote_payment_events;
create policy quote_payment_events_select_member
  on public.quote_payment_events for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists quote_payment_events_select_own_partner on public.quote_payment_events;
create policy quote_payment_events_select_own_partner
  on public.quote_payment_events
  for select
  to authenticated
  using (
    public.is_partner()
    and exists (
      select 1
      from public.quotes q
      where q.id = quote_payment_events.quote_id
        and q.tenant_id = quote_payment_events.tenant_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.portal_submitted_at is not null
        and q.deleted_at is null
    )
  );

comment on table public.quote_payment_events is
  'Append-only quote befizetés napló; egyenleg = quote_payments (deleted_at null).';

-- ---------------------------------------------------------------------------
-- Helper: insert event
-- ---------------------------------------------------------------------------
create or replace function public.insert_quote_payment_event(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_quote_payment_id uuid,
  p_event_type text,
  p_source text,
  p_amount numeric,
  p_payment_method_id uuid,
  p_payment_method_name text,
  p_previous_amount numeric,
  p_previous_payment_method_id uuid,
  p_previous_payment_method_name text,
  p_note text,
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

  insert into public.quote_payment_events (
    tenant_id, quote_id, quote_payment_id,
    event_type, source,
    amount, payment_method_id, payment_method_name,
    previous_amount, previous_payment_method_id, previous_payment_method_name,
    note, created_by, created_by_label
  ) values (
    p_tenant_id, p_quote_id, p_quote_payment_id,
    p_event_type, coalesce(nullif(p_source, ''), 'record'),
    p_amount, p_payment_method_id, p_payment_method_name,
    p_previous_amount, p_previous_payment_method_id, p_previous_payment_method_name,
    nullif(trim(coalesce(p_note, '')), ''),
    p_created_by, v_label
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_quote_payment_event(
  uuid, uuid, uuid, text, text, numeric, uuid, text, numeric, uuid, text, text, uuid
) from public;

-- ---------------------------------------------------------------------------
-- BEFORE INSERT: created_by_label
-- ---------------------------------------------------------------------------
create or replace function public.trg_quote_payments_set_label()
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

drop trigger if exists trg_quote_payments_set_label on public.quote_payments;
create trigger trg_quote_payments_set_label
  before insert on public.quote_payments
  for each row
  execute function public.trg_quote_payments_set_label();

-- ---------------------------------------------------------------------------
-- AFTER INSERT: journal (skip if correction path)
-- ---------------------------------------------------------------------------
create or replace function public.trg_quote_payments_journal_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := coalesce(nullif(current_setting('app.quote_payment_event_source', true), ''), 'record');
  v_skip text := coalesce(current_setting('app.quote_payment_skip_journal', true), '0');
begin
  if v_skip = '1' then
    return NEW;
  end if;

  perform public.insert_quote_payment_event(
    NEW.tenant_id,
    NEW.quote_id,
    NEW.id,
    'recorded',
    v_source,
    NEW.amount,
    NEW.payment_method_id,
    NEW.payment_method_name,
    null, null, null,
    NEW.comment,
    NEW.created_by
  );

  return NEW;
end;
$$;

drop trigger if exists trg_quote_payments_journal_insert on public.quote_payments;
create trigger trg_quote_payments_journal_insert
  after insert on public.quote_payments
  for each row
  execute function public.trg_quote_payments_journal_insert();

-- ---------------------------------------------------------------------------
-- payment_status trigger: use final_total_gross when set
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

  select coalesce(final_total_gross, total_gross) into v_total_gross
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

-- ---------------------------------------------------------------------------
-- Backfill events for existing alive payments
-- ---------------------------------------------------------------------------
insert into public.quote_payment_events (
  tenant_id, quote_id, quote_payment_id,
  event_type, source, amount, payment_method_id, payment_method_name,
  note, created_by, created_by_label, created_at
)
select
  p.tenant_id,
  p.quote_id,
  p.id,
  'recorded',
  'backfill',
  p.amount,
  p.payment_method_id,
  p.payment_method_name,
  p.comment,
  p.created_by,
  coalesce(p.created_by_label, public.pos_user_label(p.created_by)),
  p.payment_date
from public.quote_payments p
where p.deleted_at is null
  and not exists (
    select 1 from public.quote_payment_events e
    where e.quote_payment_id = p.id and e.event_type = 'recorded'
  );

update public.quote_payments p
set created_by_label = public.pos_user_label(p.created_by)
where p.created_by_label is null
  and p.created_by is not null;

-- ---------------------------------------------------------------------------
-- Helper: active final invoice on opti_order
-- ---------------------------------------------------------------------------
create or replace function public.quote_has_active_final_invoice(p_quote_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invoices i
    where i.tenant_id = p_tenant_id
      and i.related_source_type = 'opti_order'
      and i.related_source_id = p_quote_id
      and i.deleted_at is null
      and i.invoice_type = 'szamla'
      and i.is_storno_of_invoice_id is null
      and not exists (
        select 1 from public.invoices s
        where s.is_storno_of_invoice_id = i.id
          and s.deleted_at is null
          and s.invoice_type = 'sztorno'
      )
  );
$$;

revoke all on function public.quote_has_active_final_invoice(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- void_quote_payment
-- ---------------------------------------------------------------------------
create or replace function public.void_quote_payment(
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
  v_pay public.quote_payments%rowtype;
  v_quote public.quotes%rowtype;
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
  from public.quote_payments
  where id = p_payment_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A befizetés nem található.');
  end if;

  select * into v_quote
  from public.quotes
  where id = v_pay.quote_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Az ajánlat nem található.');
  end if;

  if not public.can_write_tenant(v_quote.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  if v_quote.status in ('draft', 'cancelled') then
    return jsonb_build_object('ok', false, 'message', 'Ehhez a státuszhoz nem módosítható a befizetés.');
  end if;

  if v_quote.order_number is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs megrendelésszám.');
  end if;

  if public.quote_has_active_final_invoice(v_quote.id, v_quote.tenant_id) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Aktív számla mellett a befizetés nem érvényteleníthető. Előbb sztornózd a számlát.'
    );
  end if;

  update public.quote_payments
  set deleted_at = now(),
      voided_by = v_user_id,
      void_reason = v_note
  where id = v_pay.id;

  perform public.insert_quote_payment_event(
    v_quote.tenant_id,
    v_quote.id,
    v_pay.id,
    'voided',
    'void',
    v_pay.amount,
    v_pay.payment_method_id,
    v_pay.payment_method_name,
    null, null, null,
    v_note,
    v_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_quote.id,
    'payment_status', (select payment_status from public.quotes where id = v_quote.id)
  );
end;
$$;

revoke all on function public.void_quote_payment(uuid, text) from public;
grant execute on function public.void_quote_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_quote_payment → void + új insert (korrekció)
-- ---------------------------------------------------------------------------
create or replace function public.update_quote_payment(
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
  v_pay public.quote_payments%rowtype;
  v_quote public.quotes%rowtype;
  v_amt numeric(14, 2);
  v_pm_name text;
  v_due numeric(14, 2);
  v_other numeric(14, 2);
  v_note text;
  v_new_id uuid;
  v_tolerance constant numeric := 1.0;
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
    v_amt := round(p_amount::numeric, 2);
  exception when others then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen összeg.');
  end;

  if v_amt is null or v_amt <= 0 then
    return jsonb_build_object('ok', false, 'message', 'A befizetés legyen pozitív összeg.');
  end if;

  if p_payment_method_id is null then
    return jsonb_build_object('ok', false, 'message', 'Válaszd ki a fizetési módot.');
  end if;

  select * into v_pay
  from public.quote_payments
  where id = p_payment_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A befizetés nem található.');
  end if;

  select * into v_quote
  from public.quotes
  where id = v_pay.quote_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Az ajánlat nem található.');
  end if;

  if not public.can_write_tenant(v_quote.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  if v_quote.status in ('draft', 'cancelled') then
    return jsonb_build_object('ok', false, 'message', 'Ehhez a státuszhoz nem módosítható a befizetés.');
  end if;

  if v_quote.order_number is null then
    return jsonb_build_object('ok', false, 'message', 'Nincs megrendelésszám.');
  end if;

  if public.quote_has_active_final_invoice(v_quote.id, v_quote.tenant_id) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Aktív számla mellett a befizetés nem módosítható. Előbb sztornózd a számlát.'
    );
  end if;

  select name into v_pm_name
  from public.payment_methods
  where id = p_payment_method_id
    and tenant_id = v_quote.tenant_id
    and deleted_at is null
    and active = true;

  if v_pm_name is null then
    return jsonb_build_object('ok', false, 'message', 'Ismeretlen vagy inaktív fizetési mód.');
  end if;

  v_due := coalesce(v_quote.final_total_gross, v_quote.total_gross, 0);

  select coalesce(sum(amount), 0) into v_other
  from public.quote_payments
  where quote_id = v_quote.id
    and deleted_at is null
    and id <> v_pay.id;

  if v_other + v_amt > v_due + v_tolerance then
    return jsonb_build_object(
      'ok', false,
      'message',
        'A befizetés meghaladja a hátralékot (max: '
        || greatest(0, v_due - v_other)::text || ' Ft).'
    );
  end if;

  update public.quote_payments
  set deleted_at = now(),
      voided_by = v_user_id,
      void_reason = v_note
  where id = v_pay.id;

  perform public.insert_quote_payment_event(
    v_quote.tenant_id,
    v_quote.id,
    v_pay.id,
    'voided',
    'edit',
    v_pay.amount,
    v_pay.payment_method_id,
    v_pay.payment_method_name,
    null, null, null,
    v_note,
    v_user_id
  );

  perform set_config('app.quote_payment_event_source', 'edit', true);
  perform set_config('app.quote_payment_skip_journal', '1', true);

  insert into public.quote_payments (
    tenant_id, quote_id, amount,
    payment_method_id, payment_method_name,
    comment, payment_date, created_by, created_by_label
  ) values (
    v_quote.tenant_id, v_quote.id, v_amt,
    p_payment_method_id, v_pm_name,
    null, now(), v_user_id, public.pos_user_label(v_user_id)
  )
  returning id into v_new_id;

  perform set_config('app.quote_payment_skip_journal', '0', true);

  perform public.insert_quote_payment_event(
    v_quote.tenant_id,
    v_quote.id,
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
    v_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_quote.id,
    'payment_status', (select payment_status from public.quotes where id = v_quote.id),
    'payment_id', v_new_id
  );
end;
$$;

revoke all on function public.update_quote_payment(uuid, uuid, numeric, text) from public;
grant execute on function public.update_quote_payment(uuid, uuid, numeric, text) to authenticated;

comment on function public.void_quote_payment(uuid, text) is
  'Befizetés soft-delete + voided event; kötelező indok.';
comment on function public.update_quote_payment(uuid, uuid, numeric, text) is
  'Korrekció: void + új sor + corrected event; kötelező indok.';

-- ---------------------------------------------------------------------------
-- convert_quote_to_order: journal source = convert (20260534 body + set_config)
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
    perform set_config('app.quote_payment_event_source', 'convert', true);
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
