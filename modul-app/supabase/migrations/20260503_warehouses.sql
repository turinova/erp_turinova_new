-- Raktárak törzs (MVP) + PO warehouse_id + Alap page access
-- Channel map (Shoprenter / Shopify / Magento) későbbi migráció — nincs channel ID a warehouses soron.

-- ---------------------------------------------------------------------------
-- warehouses
-- ---------------------------------------------------------------------------
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  name text not null,
  code text not null,

  is_default boolean not null default false,
  is_active boolean not null default true,

  country text,
  postal_code text,
  city text,
  street text,
  house_number text,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists warehouses_tenant_alive_idx
  on public.warehouses (tenant_id)
  where deleted_at is null;

create unique index if not exists warehouses_tenant_code_alive_uidx
  on public.warehouses (tenant_id, lower(code))
  where deleted_at is null;

create unique index if not exists warehouses_tenant_name_alive_uidx
  on public.warehouses (tenant_id, lower(name))
  where deleted_at is null;

create unique index if not exists warehouses_one_default_alive_uidx
  on public.warehouses (tenant_id)
  where is_default = true and deleted_at is null;

create index if not exists warehouses_tenant_active_alive_idx
  on public.warehouses (tenant_id, is_active)
  where deleted_at is null;

alter table public.warehouses enable row level security;

drop policy if exists warehouses_select_member on public.warehouses;
create policy warehouses_select_member
  on public.warehouses
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists warehouses_insert_writer on public.warehouses;
create policy warehouses_insert_writer
  on public.warehouses
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists warehouses_update_writer on public.warehouses;
create policy warehouses_update_writer
  on public.warehouses
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists warehouses_delete_writer on public.warehouses;
create policy warehouses_delete_writer
  on public.warehouses
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.warehouses is
  'Készlethelyek — beszerzés beérkezés / későbbi stock. Channel map külön tábla (P2).';

-- ---------------------------------------------------------------------------
-- Seed: minden meglévő tenant kap egy Fő raktárat
-- ---------------------------------------------------------------------------
insert into public.warehouses (
  tenant_id,
  name,
  code,
  is_default,
  is_active,
  country
)
select
  t.id,
  'Fő raktár',
  'FO',
  true,
  true,
  'Magyarország'
from public.tenants t
where not exists (
  select 1
  from public.warehouses w
  where w.tenant_id = t.id
    and w.deleted_at is null
);

-- Új tenant → automatikus Fő raktár
create or replace function public.seed_default_warehouse_for_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.warehouses (
    tenant_id,
    name,
    code,
    is_default,
    is_active,
    country
  )
  values (
    new.id,
    'Fő raktár',
    'FO',
    true,
    true,
    'Magyarország'
  );
  return new;
end;
$$;

drop trigger if exists tenants_seed_default_warehouse_trg on public.tenants;
create trigger tenants_seed_default_warehouse_trg
  after insert on public.tenants
  for each row
  execute function public.seed_default_warehouse_for_tenant();

-- ---------------------------------------------------------------------------
-- purchase_orders.warehouse_id
-- ---------------------------------------------------------------------------
alter table public.purchase_orders
  add column if not exists warehouse_id uuid
    references public.warehouses (id) on delete restrict;

update public.purchase_orders po
set warehouse_id = w.id
from public.warehouses w
where po.warehouse_id is null
  and w.tenant_id = po.tenant_id
  and w.is_default = true
  and w.deleted_at is null;

alter table public.purchase_orders
  alter column warehouse_id set not null;

create index if not exists purchase_orders_warehouse_alive_idx
  on public.purchase_orders (warehouse_id)
  where deleted_at is null;

comment on column public.purchase_orders.warehouse_id is
  'Célraktár — MVP: default; beérkezés / multi-WH később.';

-- ---------------------------------------------------------------------------
-- Page feature + Alap plan + backfill
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/torzsadatok/rendszer/raktarak',
  'Raktárak',
  'Törzsadatok',
  '/torzsadatok/rendszer/raktarak',
  58,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/torzsadatok/rendszer/raktarak'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/torzsadatok/rendszer/raktarak'
from public.tenants t
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  m.tenant_id,
  m.id,
  '/torzsadatok/rendszer/raktarak',
  true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
