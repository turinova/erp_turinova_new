-- Beszállítók törzs (beszerzés MVP)
-- Fej + címek + kapcsolattartók; 1 IBAN a fejen; default ÁFA / fiz. mód / határidő / pénznem

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  name text not null,
  email text,
  phone text,
  website text,

  tax_number text,
  eu_vat_number text,
  company_reg_number text,

  iban text,
  bic text,
  account_holder text,

  notes text,

  status text not null default 'active'
    check (status in ('active', 'inactive')),

  default_currency text not null default 'HUF'
    check (default_currency in ('HUF', 'EUR', 'USD')),
  default_tax_rate_id uuid references public.tax_rates (id) on delete set null,
  default_payment_method_id uuid references public.payment_methods (id) on delete set null,
  default_payment_terms_days integer not null default 30
    check (default_payment_terms_days >= 0 and default_payment_terms_days <= 365),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists suppliers_tenant_alive_idx
  on public.suppliers (tenant_id)
  where deleted_at is null;

create unique index if not exists suppliers_tenant_name_alive_uidx
  on public.suppliers (tenant_id, lower(name))
  where deleted_at is null;

create index if not exists suppliers_tenant_status_alive_idx
  on public.suppliers (tenant_id, status)
  where deleted_at is null;

alter table public.suppliers enable row level security;

drop policy if exists suppliers_select_member on public.suppliers;
create policy suppliers_select_member
  on public.suppliers
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists suppliers_insert_writer on public.suppliers;
create policy suppliers_insert_writer
  on public.suppliers
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists suppliers_update_writer on public.suppliers;
create policy suppliers_update_writer
  on public.suppliers
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists suppliers_delete_writer on public.suppliers;
create policy suppliers_delete_writer
  on public.suppliers
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.suppliers is
  'Beszállítók törzs — beszerzés PO / beérkezés.';

-- ---------------------------------------------------------------------------
-- supplier_addresses
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,

  label text,
  address_type text not null default 'billing'
    check (address_type in ('billing', 'shipping', 'other')),
  country text not null default 'Magyarország',
  postal_code text,
  city text,
  street text,
  house_number text,
  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_addresses_supplier_idx
  on public.supplier_addresses (supplier_id);

create unique index if not exists supplier_addresses_one_default_uidx
  on public.supplier_addresses (supplier_id)
  where is_default = true;

alter table public.supplier_addresses enable row level security;

drop policy if exists supplier_addresses_select_member on public.supplier_addresses;
create policy supplier_addresses_select_member
  on public.supplier_addresses
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists supplier_addresses_insert_writer on public.supplier_addresses;
create policy supplier_addresses_insert_writer
  on public.supplier_addresses
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists supplier_addresses_update_writer on public.supplier_addresses;
create policy supplier_addresses_update_writer
  on public.supplier_addresses
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists supplier_addresses_delete_writer on public.supplier_addresses;
create policy supplier_addresses_delete_writer
  on public.supplier_addresses
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- supplier_contacts
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,

  name text not null,
  email text,
  phone text,
  is_primary boolean not null default false,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_contacts_supplier_idx
  on public.supplier_contacts (supplier_id);

create unique index if not exists supplier_contacts_one_primary_uidx
  on public.supplier_contacts (supplier_id)
  where is_primary = true;

alter table public.supplier_contacts enable row level security;

drop policy if exists supplier_contacts_select_member on public.supplier_contacts;
create policy supplier_contacts_select_member
  on public.supplier_contacts
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists supplier_contacts_insert_writer on public.supplier_contacts;
create policy supplier_contacts_insert_writer
  on public.supplier_contacts
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists supplier_contacts_update_writer on public.supplier_contacts;
create policy supplier_contacts_update_writer
  on public.supplier_contacts
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists supplier_contacts_delete_writer on public.supplier_contacts;
create policy supplier_contacts_delete_writer
  on public.supplier_contacts
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Page feature + Alap plan + backfill entitlements / page access
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beszallitok',
  'Beszállítók',
  'Beszerzés',
  '/beszallitok',
  45,
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
select p.id, '/beszallitok'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/beszallitok'
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
  '/beszallitok',
  true
from public.tenant_memberships m
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
