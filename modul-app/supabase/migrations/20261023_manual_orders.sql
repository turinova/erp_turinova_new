-- Kézi rendelés + kézi várólista (docs/64)
-- Beszerzés nélküli, egyszerűsített rendelés: nincs PO, nincs készletmozgás, nincs eladás.
-- Tétel: Nyitott → Megrendelve → Megérkezett → Átadva (+ Törölve).
-- Teljesen külön az ügyfélrendeléstől (customer_special_orders) — közös: ügyfél, katalógus, beszállító.

-- ---------------------------------------------------------------------------
-- Beszállítói jelölőszín (várólista, tételsorok). Null = automatikus (id-hash).
-- ---------------------------------------------------------------------------
alter table public.suppliers
  add column if not exists color text
    check (color is null or color in ('blue', 'teal', 'green', 'lime', 'amber', 'orange', 'rose', 'pink', 'violet', 'slate'));

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.manual_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_number text not null,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text not null,
  customer_mobile text,
  status text not null default 'nyitott'
    check (status in ('nyitott', 'megrendelve', 'megerkezett', 'atadva', 'torolve')),
  promised_date date,
  note text,
  sms_sent_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, order_number)
);

create index if not exists manual_orders_tenant_created_idx
  on public.manual_orders (tenant_id, created_at desc)
  where deleted_at is null;

create index if not exists manual_orders_tenant_status_idx
  on public.manual_orders (tenant_id, status)
  where deleted_at is null;

create table if not exists public.manual_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id uuid not null references public.manual_orders (id) on delete cascade,
  name text not null,
  sku text,
  qty numeric(12, 3) not null check (qty > 0),
  unit_shortform text not null default 'db',
  unit_price_gross numeric(12, 2),
  accessory_id uuid references public.accessories (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  note text,
  status text not null default 'nyitott'
    check (status in ('nyitott', 'megrendelve', 'megerkezett', 'atadva', 'torolve')),
  ordered_at timestamptz,
  ordered_by_label text,
  arrived_at timestamptz,
  arrived_by_label text,
  handed_over_at timestamptz,
  handed_over_by_label text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists manual_order_items_order_idx
  on public.manual_order_items (order_id)
  where deleted_at is null;

create index if not exists manual_order_items_queue_idx
  on public.manual_order_items (tenant_id, status, supplier_id, created_at desc)
  where deleted_at is null;

create table if not exists public.manual_order_deposits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id uuid not null references public.manual_orders (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null default 'keszpenz'
    check (method in ('keszpenz', 'kartya', 'atutalas')),
  -- eloleg = felvételkor / közben; atadas = átadáskor fizetett hátralék
  kind text not null default 'eloleg' check (kind in ('eloleg', 'atadas')),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_by_label text,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by_label text
);

create index if not exists manual_order_deposits_order_idx
  on public.manual_order_deposits (order_id);

create table if not exists public.manual_order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id uuid not null references public.manual_orders (id) on delete cascade,
  kind text not null
    check (kind in ('created', 'status', 'sms', 'deposit', 'deposit_void', 'edited', 'items_added')),
  status text,
  item_count int,
  detail text,
  actor_label text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists manual_order_events_order_idx
  on public.manual_order_events (order_id, created_at desc);

comment on table public.manual_orders is
  'Kézi rendelés fej — beszerzés nélküli bolti rendelés (docs/64).';
comment on table public.manual_order_items is
  'Kézi rendelés tételek — státusz kézzel (várólista), nincs PO / készlet.';

-- ---------------------------------------------------------------------------
-- Order number KR-YYYY-NNN (soft-deleted rows included → no reuse)
-- ---------------------------------------------------------------------------
create or replace function public.generate_manual_order_number(p_tenant_id uuid)
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
      substring(order_number from length('KR-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.manual_orders
  where tenant_id = p_tenant_id
    and order_number like 'KR-' || current_year::text || '-%';

  return 'KR-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_manual_order_number(uuid) from public;
grant execute on function public.generate_manual_order_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Header status = most-behind live item
-- ---------------------------------------------------------------------------
create or replace function public.recompute_manual_order_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select case
    when bool_or(i.status = 'nyitott') then 'nyitott'
    when bool_or(i.status = 'megrendelve') then 'megrendelve'
    when bool_or(i.status = 'megerkezett') then 'megerkezett'
    when bool_or(i.status = 'atadva') then 'atadva'
    else 'torolve'
  end
  into v_status
  from public.manual_order_items i
  where i.order_id = p_order_id
    and i.deleted_at is null
    and i.status <> 'torolve';

  update public.manual_orders
  set status = coalesce(v_status, 'torolve'), updated_at = now()
  where id = p_order_id
    and status is distinct from coalesce(v_status, 'torolve');
end;
$$;

create or replace function public.trg_manual_order_items_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_manual_order_status(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists manual_order_items_recompute_trg on public.manual_order_items;
create trigger manual_order_items_recompute_trg
  after insert or update or delete on public.manual_order_items
  for each row
  execute function public.trg_manual_order_items_recompute();

-- ---------------------------------------------------------------------------
-- Bulk status change (one transaction) + event log
-- ---------------------------------------------------------------------------
create or replace function public.manual_order_items_set_status(
  p_item_ids uuid[],
  p_status text,
  p_actor_label text default null
)
returns table (order_id uuid, changed int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid;
  v_tenant_count int;
begin
  if p_status not in ('nyitott', 'megrendelve', 'megerkezett', 'atadva', 'torolve') then
    raise exception 'invalid status';
  end if;
  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    return;
  end if;

  select count(distinct i.tenant_id), min(i.tenant_id::text)::uuid
  into v_tenant_count, v_tenant
  from public.manual_order_items i
  where i.id = any (p_item_ids) and i.deleted_at is null;

  if v_tenant_count = 0 then
    return;
  end if;
  if v_tenant_count > 1 or not public.can_write_tenant(v_tenant) then
    raise exception 'not allowed';
  end if;

  return query
  with upd as (
    update public.manual_order_items i
    set
      status = p_status,
      ordered_at = case
        when p_status = 'nyitott' then null
        when p_status in ('megrendelve', 'megerkezett', 'atadva') then coalesce(i.ordered_at, now())
        else i.ordered_at
      end,
      ordered_by_label = case
        when p_status = 'nyitott' then null
        when p_status in ('megrendelve', 'megerkezett', 'atadva') and i.ordered_at is null then p_actor_label
        else i.ordered_by_label
      end,
      arrived_at = case
        when p_status in ('nyitott', 'megrendelve') then null
        when p_status in ('megerkezett', 'atadva') then coalesce(i.arrived_at, now())
        else i.arrived_at
      end,
      arrived_by_label = case
        when p_status in ('nyitott', 'megrendelve') then null
        when p_status in ('megerkezett', 'atadva') and i.arrived_at is null then p_actor_label
        else i.arrived_by_label
      end,
      handed_over_at = case when p_status = 'atadva' then coalesce(i.handed_over_at, now()) when p_status = 'torolve' then i.handed_over_at else null end,
      handed_over_by_label = case when p_status = 'atadva' and i.handed_over_at is null then p_actor_label when p_status = 'torolve' then i.handed_over_by_label else null end,
      updated_at = now()
    where i.id = any (p_item_ids)
      and i.deleted_at is null
      and i.status <> p_status
    returning i.order_id
  ),
  grouped as (
    select u.order_id, count(*)::int as n from upd u group by u.order_id
  ),
  ev as (
    insert into public.manual_order_events (tenant_id, order_id, kind, status, item_count, actor_label, created_by)
    select v_tenant, g.order_id, 'status', p_status, g.n, p_actor_label, auth.uid()
    from grouped g
    returning 1
  )
  select g.order_id, g.n from grouped g;
end;
$$;

revoke all on function public.manual_order_items_set_status(uuid[], text, text) from public;
grant execute on function public.manual_order_items_set_status(uuid[], text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.manual_orders enable row level security;
alter table public.manual_order_items enable row level security;
alter table public.manual_order_deposits enable row level security;
alter table public.manual_order_events enable row level security;

drop policy if exists mo_select_member on public.manual_orders;
create policy mo_select_member on public.manual_orders for select to authenticated
  using (public.is_tenant_member(tenant_id));
drop policy if exists mo_insert_writer on public.manual_orders;
create policy mo_insert_writer on public.manual_orders for insert to authenticated
  with check (public.can_write_tenant(tenant_id));
drop policy if exists mo_update_writer on public.manual_orders;
create policy mo_update_writer on public.manual_orders for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists moi_select_member on public.manual_order_items;
create policy moi_select_member on public.manual_order_items for select to authenticated
  using (public.is_tenant_member(tenant_id));
drop policy if exists moi_insert_writer on public.manual_order_items;
create policy moi_insert_writer on public.manual_order_items for insert to authenticated
  with check (public.can_write_tenant(tenant_id));
drop policy if exists moi_update_writer on public.manual_order_items;
create policy moi_update_writer on public.manual_order_items for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists mod_select_member on public.manual_order_deposits;
create policy mod_select_member on public.manual_order_deposits for select to authenticated
  using (public.is_tenant_member(tenant_id));
drop policy if exists mod_insert_writer on public.manual_order_deposits;
create policy mod_insert_writer on public.manual_order_deposits for insert to authenticated
  with check (public.can_write_tenant(tenant_id));
drop policy if exists mod_update_writer on public.manual_order_deposits;
create policy mod_update_writer on public.manual_order_deposits for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists moe_select_member on public.manual_order_events;
create policy moe_select_member on public.manual_order_events for select to authenticated
  using (public.is_tenant_member(tenant_id));
drop policy if exists moe_insert_writer on public.manual_order_events;
create policy moe_insert_writer on public.manual_order_events for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- SMS: manual_order_ready sablon + napló hivatkozás
-- ---------------------------------------------------------------------------
alter table public.sms_send_events
  add column if not exists manual_order_id uuid
    references public.manual_orders (id) on delete set null;

alter table public.tenant_sms_templates
  drop constraint if exists tenant_sms_templates_key_check;
alter table public.tenant_sms_templates
  add constraint tenant_sms_templates_key_check
  check (template_key in ('quote_ready', 'cso_ready', 'review_thanks', 'manual_order_ready'));

alter table public.sms_send_events
  drop constraint if exists sms_send_events_template_check;
alter table public.sms_send_events
  add constraint sms_send_events_template_check
  check (template_key in ('quote_ready', 'cso_ready', 'review_thanks', 'manual_order_ready'));

-- ---------------------------------------------------------------------------
-- Add-on: „Kézi rendelések” (nem csomagban — Platform → tenant → Add-onok)
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values
  ('kezi_rendelesek', 'Kézi rendelések', 'Add-on', null, 545, true),
  ('/kezi-rendelesek', 'Kézi rendelések', 'Ügyfél', '/kezi-rendelesek', 44, true),
  ('/kezi-varolista', 'Kézi várólista', 'Ügyfél', '/kezi-varolista', 45, true)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addons (
  key, name, description, active, price_monthly_huf, currency
)
values (
  'kezi_rendelesek',
  'Kézi rendelések',
  'Beszerzés nélküli bolti vevőrendelés: kézi várólista, Megjött + SMS, átadás a keresőből.',
  true,
  0,
  'HUF'
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true;

insert into public.product_addon_features (addon_id, feature_key)
select a.id, v.feature_key
from public.product_addons a
cross join (
  values ('kezi_rendelesek'), ('/kezi-rendelesek'), ('/kezi-varolista')
) as v(feature_key)
where a.key = 'kezi_rendelesek'
  and exists (select 1 from public.product_features f where f.key = v.feature_key)
on conflict do nothing;

-- Bekapcsolás: Platform → tenant → Add-onok → „Kézi rendelések” → Bekapcsolás.
-- Owner/admin (üres page_access) automatikusan látja; a többi usernek a
-- Beállítások → Jogosultságok oldalon kell pipálni. Opcionális gyorsítás —
-- aki látja az Ügyfélrendeléseket, kapja meg ezt is (slug cseréje után):
--
-- insert into public.tenant_membership_page_access (tenant_id, membership_id, page_key, can_access)
-- select a.tenant_id, a.membership_id, k.key, true
-- from public.tenant_membership_page_access a
-- join public.tenants t on t.id = a.tenant_id and t.slug = 'IDE_A_SLUG'
-- cross join (values ('/kezi-rendelesek'), ('/kezi-varolista')) as k(key)
-- where a.page_key = '/ugyfelrendelesek' and a.can_access = true
-- on conflict (membership_id, page_key) do update set can_access = true, updated_at = now();
