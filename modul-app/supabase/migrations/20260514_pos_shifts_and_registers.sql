-- POS műszak + pénztárak + sale audit (S6 P0)
-- Belsős elszámolás — NEM NAV adóügyi zárás.

-- ---------------------------------------------------------------------------
-- pos_registers
-- ---------------------------------------------------------------------------
create table if not exists public.pos_registers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  name text not null,
  code text not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists pos_registers_tenant_code_alive_uidx
  on public.pos_registers (tenant_id, code)
  where deleted_at is null;

create index if not exists pos_registers_tenant_wh_idx
  on public.pos_registers (tenant_id, warehouse_id)
  where deleted_at is null;

create unique index if not exists pos_registers_one_default_per_wh_uidx
  on public.pos_registers (tenant_id, warehouse_id)
  where deleted_at is null and is_default = true and is_active = true;

alter table public.pos_registers enable row level security;

drop policy if exists pos_registers_select_member on public.pos_registers;
create policy pos_registers_select_member
  on public.pos_registers for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists pos_registers_write on public.pos_registers;
create policy pos_registers_write
  on public.pos_registers for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- Seed: 1 default register per active warehouse (idempotent; code unique per tenant)
insert into public.pos_registers (tenant_id, warehouse_id, name, code, is_active, is_default)
select
  w.tenant_id,
  w.id,
  'Főpénztár',
  'K-' || left(replace(w.id::text, '-', ''), 8),
  true,
  true
from public.warehouses w
where w.deleted_at is null
  and w.is_active = true
  and not exists (
    select 1
    from public.pos_registers r
    where r.warehouse_id = w.id
      and r.deleted_at is null
  )
  and not exists (
    select 1
    from public.pos_registers r
    where r.tenant_id = w.tenant_id
      and r.code = 'K-' || left(replace(w.id::text, '-', ''), 8)
      and r.deleted_at is null
  );

-- ---------------------------------------------------------------------------
-- pos_shifts
-- ---------------------------------------------------------------------------
create table if not exists public.pos_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  pos_register_id uuid not null references public.pos_registers (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  opened_by uuid references auth.users (id) on delete set null,
  opened_by_label text,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  closed_by_label text,
  opening_cash numeric(12, 0) not null default 0 check (opening_cash >= 0),
  expected_cash numeric(12, 0),
  counted_cash numeric(12, 0),
  cash_difference numeric(12, 0),
  expected_card numeric(12, 0),
  counted_card numeric(12, 0),
  card_difference numeric(12, 0),
  sales_count integer not null default 0,
  returns_count integer not null default 0,
  sales_gross_sum numeric(12, 0) not null default 0,
  note text,
  denomination_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pos_shifts_one_open_per_register_uidx
  on public.pos_shifts (tenant_id, pos_register_id)
  where status = 'open';

create index if not exists pos_shifts_tenant_opened_idx
  on public.pos_shifts (tenant_id, opened_at desc);

create index if not exists pos_shifts_tenant_status_idx
  on public.pos_shifts (tenant_id, status);

alter table public.pos_shifts enable row level security;

drop policy if exists pos_shifts_select_member on public.pos_shifts;
create policy pos_shifts_select_member
  on public.pos_shifts for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists pos_shifts_write on public.pos_shifts;
create policy pos_shifts_write
  on public.pos_shifts for all to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- pos_shift_cash_moves
-- ---------------------------------------------------------------------------
create table if not exists public.pos_shift_cash_moves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  pos_shift_id uuid not null references public.pos_shifts (id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  amount numeric(12, 0) not null check (amount > 0),
  note text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_by_label text,
  created_at timestamptz not null default now()
);

create index if not exists pos_shift_cash_moves_shift_idx
  on public.pos_shift_cash_moves (pos_shift_id);

alter table public.pos_shift_cash_moves enable row level security;

drop policy if exists pos_shift_cash_moves_select on public.pos_shift_cash_moves;
create policy pos_shift_cash_moves_select
  on public.pos_shift_cash_moves for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists pos_shift_cash_moves_insert on public.pos_shift_cash_moves;
create policy pos_shift_cash_moves_insert
  on public.pos_shift_cash_moves for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Sale / return columns
-- ---------------------------------------------------------------------------
alter table public.sales_orders
  add column if not exists pos_shift_id uuid references public.pos_shifts (id) on delete set null,
  add column if not exists pos_register_id uuid references public.pos_registers (id) on delete set null,
  add column if not exists created_by_label_snapshot text;

create index if not exists sales_orders_pos_shift_idx
  on public.sales_orders (pos_shift_id)
  where deleted_at is null and pos_shift_id is not null;

alter table public.sales_returns
  add column if not exists pos_shift_id uuid references public.pos_shifts (id) on delete set null,
  add column if not exists pos_register_id uuid references public.pos_registers (id) on delete set null;

create index if not exists sales_returns_pos_shift_idx
  on public.sales_returns (pos_shift_id)
  where deleted_at is null and pos_shift_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.pos_is_cash_method(p_name text)
returns boolean
language sql
immutable
as $$
  select
    lower(coalesce(p_name, '')) like '%készpénz%'
    or lower(coalesce(p_name, '')) like '%keszpenz%'
    or lower(coalesce(p_name, '')) = 'cash';
$$;

create or replace function public.pos_is_card_method(p_name text)
returns boolean
language sql
immutable
as $$
  select
    lower(coalesce(p_name, '')) like '%kártya%'
    or lower(coalesce(p_name, '')) like '%kartya%'
    or lower(coalesce(p_name, '')) like '%card%'
    or lower(coalesce(p_name, '')) like '%bankkártya%'
    or lower(coalesce(p_name, '')) like '%bankkartya%';
$$;

create or replace function public.pos_user_label(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select email from auth.users where id = p_user_id),
    p_user_id::text
  );
$$;

-- Trigger: attach return to open shift on WH (prefer sale register)
create or replace function public.trg_sales_return_attach_shift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_reg uuid;
  v_wh uuid;
  v_shift_id uuid;
  v_reg_id uuid;
begin
  if NEW.pos_shift_id is not null then
    return NEW;
  end if;

  select pos_register_id, warehouse_id
  into v_sale_reg, v_wh
  from public.sales_orders
  where id = NEW.sales_order_id;

  if v_sale_reg is not null then
    select s.id, s.pos_register_id into v_shift_id, v_reg_id
    from public.pos_shifts s
    where s.pos_register_id = v_sale_reg
      and s.tenant_id = NEW.tenant_id
      and s.status = 'open'
    limit 1;
  end if;

  if v_shift_id is null and v_wh is not null then
    select s.id, s.pos_register_id into v_shift_id, v_reg_id
    from public.pos_shifts s
    where s.warehouse_id = v_wh
      and s.tenant_id = NEW.tenant_id
      and s.status = 'open'
    order by s.opened_at desc
    limit 1;
  end if;

  if v_shift_id is not null then
    NEW.pos_shift_id := v_shift_id;
    NEW.pos_register_id := coalesce(NEW.pos_register_id, v_reg_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists sales_return_attach_shift on public.sales_returns;
create trigger sales_return_attach_shift
  before insert on public.sales_returns
  for each row
  execute function public.trg_sales_return_attach_shift();

-- ---------------------------------------------------------------------------
-- open_pos_shift
-- ---------------------------------------------------------------------------
create or replace function public.open_pos_shift(
  p_pos_register_id uuid,
  p_opening_cash numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reg public.pos_registers%rowtype;
  v_shift_id uuid;
  v_opening numeric(12, 0);
  v_label text;
begin
  if p_pos_register_id is null then
    return jsonb_build_object('ok', false, 'message', 'Válaszd ki a pénztárat.');
  end if;

  v_opening := greatest(0, round(coalesce(p_opening_cash, 0)));

  select * into v_reg
  from public.pos_registers
  where id = p_pos_register_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A pénztár nem található.');
  end if;
  if not v_reg.is_active then
    return jsonb_build_object('ok', false, 'message', 'A pénztár inaktív.');
  end if;
  if not public.can_write_tenant(v_reg.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  if exists (
    select 1 from public.pos_shifts
    where pos_register_id = v_reg.id and status = 'open'
  ) then
    return jsonb_build_object('ok', false, 'message', 'Ezen a pénztáron már van nyitott műszak.');
  end if;

  v_label := public.pos_user_label(v_user_id);
  v_shift_id := gen_random_uuid();

  insert into public.pos_shifts (
    id, tenant_id, pos_register_id, warehouse_id, status,
    opened_at, opened_by, opened_by_label, opening_cash
  ) values (
    v_shift_id, v_reg.tenant_id, v_reg.id, v_reg.warehouse_id, 'open',
    now(), v_user_id, v_label, v_opening
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_shift_id,
    'opening_cash', v_opening,
    'pos_register_id', v_reg.id,
    'warehouse_id', v_reg.warehouse_id
  );
end;
$$;

revoke all on function public.open_pos_shift(uuid, numeric) from public;
grant execute on function public.open_pos_shift(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- add_pos_shift_cash_move
-- ---------------------------------------------------------------------------
create or replace function public.add_pos_shift_cash_move(
  p_pos_shift_id uuid,
  p_kind text,
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
  v_shift public.pos_shifts%rowtype;
  v_amt numeric(12, 0);
  v_note text;
  v_kind text;
begin
  v_kind := lower(trim(coalesce(p_kind, '')));
  if v_kind not in ('in', 'out') then
    return jsonb_build_object('ok', false, 'message', 'Érvénytelen mozgás típus.');
  end if;
  v_amt := round(coalesce(p_amount, 0));
  if v_amt <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Az összeg legyen pozitív.');
  end if;
  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is null then
    return jsonb_build_object('ok', false, 'message', 'A megjegyzés kötelező (pl. széf feladás).');
  end if;

  select * into v_shift
  from public.pos_shifts
  where id = p_pos_shift_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A műszak nem található.');
  end if;
  if v_shift.status <> 'open' then
    return jsonb_build_object('ok', false, 'message', 'Csak nyitott műszakon rögzíthető.');
  end if;
  if not public.can_write_tenant(v_shift.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  insert into public.pos_shift_cash_moves (
    tenant_id, pos_shift_id, kind, amount, note, created_by, created_by_label
  ) values (
    v_shift.tenant_id, v_shift.id, v_kind, v_amt, v_note,
    v_user_id, public.pos_user_label(v_user_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.add_pos_shift_cash_move(uuid, text, numeric, text) from public;
grant execute on function public.add_pos_shift_cash_move(uuid, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- preview / close helpers — compute expected
-- ---------------------------------------------------------------------------
create or replace function public.compute_pos_shift_expected(p_shift_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shift public.pos_shifts%rowtype;
  v_cash_pay numeric(12, 0) := 0;
  v_cash_ref numeric(12, 0) := 0;
  v_card_pay numeric(12, 0) := 0;
  v_card_ref numeric(12, 0) := 0;
  v_move_in numeric(12, 0) := 0;
  v_move_out numeric(12, 0) := 0;
  v_sales_count integer := 0;
  v_returns_count integer := 0;
  v_sales_gross numeric(12, 0) := 0;
begin
  select * into v_shift from public.pos_shifts where id = p_shift_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Műszak nem található.');
  end if;

  -- Payments on sales belonging to this shift
  select
    coalesce(sum(case
      when public.pos_is_cash_method(p.payment_method_name)
        and coalesce(p.kind, 'payment') = 'payment'
      then p.amount else 0 end), 0),
    coalesce(sum(case
      when public.pos_is_card_method(p.payment_method_name)
        and coalesce(p.kind, 'payment') = 'payment'
      then p.amount else 0 end), 0)
  into v_cash_pay, v_card_pay
  from public.sales_payments p
  join public.sales_orders o on o.id = p.sales_order_id
  where o.pos_shift_id = p_shift_id
    and p.deleted_at is null
    and o.deleted_at is null
    and p.status = 'completed';

  -- Refunds whose return was recorded on this shift
  select
    coalesce(sum(case when public.pos_is_cash_method(p.payment_method_name) then p.amount else 0 end), 0),
    coalesce(sum(case when public.pos_is_card_method(p.payment_method_name) then p.amount else 0 end), 0)
  into v_cash_ref, v_card_ref
  from public.sales_payments p
  join public.sales_returns r on r.id = p.sales_return_id
  where r.pos_shift_id = p_shift_id
    and p.kind = 'refund'
    and p.status = 'completed'
    and p.deleted_at is null
    and r.deleted_at is null;

  select
    coalesce(sum(case when kind = 'in' then amount else 0 end), 0),
    coalesce(sum(case when kind = 'out' then amount else 0 end), 0)
  into v_move_in, v_move_out
  from public.pos_shift_cash_moves
  where pos_shift_id = p_shift_id;

  select count(*), coalesce(sum(total_gross), 0)
  into v_sales_count, v_sales_gross
  from public.sales_orders
  where pos_shift_id = p_shift_id and deleted_at is null;

  select count(*) into v_returns_count
  from public.sales_returns
  where pos_shift_id = p_shift_id and deleted_at is null;

  return jsonb_build_object(
    'ok', true,
    'opening_cash', v_shift.opening_cash,
    'expected_cash', v_shift.opening_cash + v_cash_pay - v_cash_ref + v_move_in - v_move_out,
    'expected_card', v_card_pay - v_card_ref,
    'cash_payments', v_cash_pay,
    'cash_refunds', v_cash_ref,
    'card_payments', v_card_pay,
    'card_refunds', v_card_ref,
    'cash_in', v_move_in,
    'cash_out', v_move_out,
    'sales_count', v_sales_count,
    'returns_count', v_returns_count,
    'sales_gross_sum', v_sales_gross
  );
end;
$$;

revoke all on function public.compute_pos_shift_expected(uuid) from public;
grant execute on function public.compute_pos_shift_expected(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- close_pos_shift
-- ---------------------------------------------------------------------------
create or replace function public.close_pos_shift(
  p_pos_shift_id uuid,
  p_counted_cash numeric,
  p_counted_card numeric,
  p_note text,
  p_denomination_json jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_shift public.pos_shifts%rowtype;
  v_exp jsonb;
  v_expected_cash numeric(12, 0);
  v_expected_card numeric(12, 0);
  v_counted_cash numeric(12, 0);
  v_counted_card numeric(12, 0);
  v_cash_diff numeric(12, 0);
  v_card_diff numeric(12, 0);
  v_note text;
begin
  select * into v_shift
  from public.pos_shifts
  where id = p_pos_shift_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'A műszak nem található.');
  end if;
  if v_shift.status <> 'open' then
    return jsonb_build_object('ok', false, 'message', 'A műszak már le van zárva.');
  end if;
  if not public.can_write_tenant(v_shift.tenant_id) then
    return jsonb_build_object('ok', false, 'message', 'Nincs írási jogosultság.');
  end if;

  v_exp := public.compute_pos_shift_expected(v_shift.id);
  if coalesce((v_exp ->> 'ok')::boolean, false) is not true then
    return v_exp;
  end if;

  v_expected_cash := (v_exp ->> 'expected_cash')::numeric;
  v_expected_card := (v_exp ->> 'expected_card')::numeric;
  v_counted_cash := round(coalesce(p_counted_cash, 0));
  v_counted_card := round(coalesce(p_counted_card, v_expected_card));
  v_cash_diff := v_counted_cash - v_expected_cash;
  v_card_diff := v_counted_card - v_expected_card;
  v_note := nullif(trim(coalesce(p_note, '')), '');

  if abs(v_cash_diff) >= 1 and (v_note is null or length(v_note) < 3) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Eltérés esetén írd meg az okot (min. 3 karakter).'
    );
  end if;

  update public.pos_shifts set
    status = 'closed',
    closed_at = now(),
    closed_by = v_user_id,
    closed_by_label = public.pos_user_label(v_user_id),
    expected_cash = v_expected_cash,
    counted_cash = v_counted_cash,
    cash_difference = v_cash_diff,
    expected_card = v_expected_card,
    counted_card = v_counted_card,
    card_difference = v_card_diff,
    sales_count = coalesce((v_exp ->> 'sales_count')::integer, 0),
    returns_count = coalesce((v_exp ->> 'returns_count')::integer, 0),
    sales_gross_sum = coalesce((v_exp ->> 'sales_gross_sum')::numeric, 0),
    note = v_note,
    denomination_json = p_denomination_json,
    updated_at = now()
  where id = v_shift.id;

  return jsonb_build_object(
    'ok', true,
    'id', v_shift.id,
    'cash_difference', v_cash_diff,
    'expected_cash', v_expected_cash,
    'counted_cash', v_counted_cash
  );
end;
$$;

revoke all on function public.close_pos_shift(uuid, numeric, numeric, text, jsonb) from public;
grant execute on function public.close_pos_shift(uuid, numeric, numeric, text, jsonb) to authenticated;

-- last closed counted for default opening
create or replace function public.get_last_closed_shift_cash(p_pos_register_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select counted_cash
  from public.pos_shifts
  where pos_register_id = p_pos_register_id
    and status = 'closed'
  order by closed_at desc nulls last
  limit 1;
$$;

revoke all on function public.get_last_closed_shift_cash(uuid) from public;
grant execute on function public.get_last_closed_shift_cash(uuid) to authenticated;

drop function if exists public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb);

create or replace function public.create_sale(
  p_warehouse_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_note text,
  p_items jsonb,
  p_fees jsonb,
  p_discount jsonb,
  p_payments jsonb,
  p_pos_register_id uuid default null
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

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Adj meg legalább egy fizetést.');
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

  -- Pass 1: products
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

    -- net from gross
    if v_tax_pct > 0 then
      v_unit_net := round(v_unit_gross / (1 + v_tax_pct / 100));
    else
      v_unit_net := v_unit_gross;
    end if;

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
    if v_item_disc_amt > v_line_gross_before then
      v_item_disc_amt := v_line_gross_before;
    end if;

    v_line_gross := greatest(0, round(v_line_gross_before - v_item_disc_amt));
    if v_line_gross_before > 0 and v_line_gross > 0 then
      v_line_vat := round(v_line_vat * (v_line_gross::numeric / v_line_gross_before));
      v_line_net := v_line_gross - v_line_vat;
    else
      v_line_vat := 0;
      v_line_net := 0;
    end if;

    -- Soft allow: 0 / negatív készlet is eladható (UI figyelmeztet).
    -- Az out mozgás így on_hand-ot negatívba viheti.

    v_prepared_items := v_prepared_items || jsonb_build_array(jsonb_build_object(
      'accessory_id', v_acc.id,
      'name', v_acc.name,
      'sku', v_acc.sku,
      'unit_shortform', coalesce(v_unit_shortform, 'db'),
      'quantity', v_qty,
      'unit_price_net', v_unit_net,
      'unit_price_gross', v_unit_gross,
      'tax_rate_percent', v_tax_pct,
      'discount_percentage', v_item_disc_pct,
      'discount_amount', v_item_disc_amt,
      'total_net', v_line_net,
      'total_vat', v_line_vat,
      'total_gross', v_line_gross
    ));

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

  if v_pay_sum + 1 < v_due then
    return jsonb_build_object(
      'ok', false,
      'message',
        'A fizetések összege kevesebb a végösszegnél (fizetendő: '
        || v_due::text || ' Ft, megadva: ' || v_pay_sum::text || ' Ft).'
    );
  end if;

  if v_pay_sum >= v_due - 1 then
    v_pay_status := 'paid';
  elsif v_pay_sum > 0 then
    v_pay_status := 'partial';
  else
    v_pay_status := 'unpaid';
  end if;

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
    v_sale_number, v_channel, 'fulfilled', v_pay_status,
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
    now(), v_user_id, v_user_id,
    v_seller_label, v_pos_shift_id, v_pos_register_id
  );

  for v_row in select * from jsonb_array_elements(v_prepared_items)
  loop
    insert into public.sales_order_items (
      tenant_id, sales_order_id, item_kind, accessory_id,
      name_snapshot, sku_snapshot, unit_shortform, quantity,
      unit_price_net, unit_price_gross, tax_rate_percent,
      discount_percentage, discount_amount,
      total_net, total_vat, total_gross, sort_order
    ) values (
      v_tenant_id, v_sale_id, 'product', (v_row ->> 'accessory_id')::uuid,
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

    v_sm_number := public.generate_stock_movement_number(v_tenant_id);
    insert into public.stock_movements (
      tenant_id, warehouse_id, product_type, accessory_id,
      quantity, movement_type, source_type, source_id,
      note, stock_movement_number, created_by
    ) values (
      v_tenant_id, p_warehouse_id, 'accessory', (v_row ->> 'accessory_id')::uuid,
      (v_row ->> 'quantity')::numeric, 'out', 'sale', v_sale_id,
      v_row ->> 'name', v_sm_number, v_user_id
    );

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

    insert into public.sales_payments (
      tenant_id, sales_order_id, payment_method_id,
      payment_method_name, amount, status, created_by
    ) values (
      v_tenant_id, v_sale_id, v_pm_id,
      v_pm_name, v_pay_amt, 'completed', v_user_id
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'id', v_sale_id,
    'sale_number', v_sale_number,
    'total_gross', v_total_gross,
    'payment_status', v_pay_status
  );
end;
$$;

revoke all on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid) from public;
grant execute on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid) to authenticated;


comment on function public.create_sale(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid) is
  'Azonnali értékesítés + opcionális POS pénztár/műszak kötés.';
