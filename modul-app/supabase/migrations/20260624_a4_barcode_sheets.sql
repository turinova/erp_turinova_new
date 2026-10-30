-- A4 vonalkód lap (Törzsadatok) — menthető rács + page entitlement
-- Route: /torzsadatok/vonalkod-lap
-- Kapu: product_labels + page_key

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.a4_barcode_sheets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  cols int not null,
  rows int not null,
  margin_mm numeric(6, 2) not null default 5,
  show_name boolean not null default true,
  show_sku boolean not null default true,
  show_price boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint a4_barcode_sheets_name_len
    check (char_length(trim(name)) between 1 and 120),
  constraint a4_barcode_sheets_cols_check
    check (cols between 1 and 8),
  constraint a4_barcode_sheets_rows_check
    check (rows between 1 and 12),
  constraint a4_barcode_sheets_margin_check
    check (margin_mm >= 0 and margin_mm <= 25)
);

comment on table public.a4_barcode_sheets is
  'Menthető A4 vonalkód-rács sablon (irodai PDF; nem ZPL).';

create index if not exists a4_barcode_sheets_tenant_updated_idx
  on public.a4_barcode_sheets (tenant_id, updated_at desc)
  where deleted_at is null;

create table if not exists public.a4_barcode_sheet_cells (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sheet_id uuid not null references public.a4_barcode_sheets (id) on delete cascade,
  row_i int not null,
  col_i int not null,
  accessory_id uuid references public.accessories (id) on delete set null,
  barcode_value text not null,
  barcode_source text not null default 'auto',
  name_snap text,
  sku_snap text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint a4_barcode_sheet_cells_pos_check
    check (row_i >= 0 and col_i >= 0),
  constraint a4_barcode_sheet_cells_barcode_len
    check (char_length(trim(barcode_value)) between 1 and 128),
  constraint a4_barcode_sheet_cells_source_check
    check (barcode_source in ('auto', 'supplier', 'internal')),
  constraint a4_barcode_sheet_cells_unique_pos
    unique (sheet_id, row_i, col_i)
);

comment on table public.a4_barcode_sheet_cells is
  'A4 vonalkód lap cellák — snapshot barcode + név/SKU a PDF-hez.';

create index if not exists a4_barcode_sheet_cells_sheet_idx
  on public.a4_barcode_sheet_cells (sheet_id);

create index if not exists a4_barcode_sheet_cells_tenant_idx
  on public.a4_barcode_sheet_cells (tenant_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.a4_barcode_sheets enable row level security;
alter table public.a4_barcode_sheet_cells enable row level security;

drop policy if exists a4_barcode_sheets_select_member on public.a4_barcode_sheets;
create policy a4_barcode_sheets_select_member
  on public.a4_barcode_sheets
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists a4_barcode_sheets_insert_writer on public.a4_barcode_sheets;
create policy a4_barcode_sheets_insert_writer
  on public.a4_barcode_sheets
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists a4_barcode_sheets_update_writer on public.a4_barcode_sheets;
create policy a4_barcode_sheets_update_writer
  on public.a4_barcode_sheets
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists a4_barcode_sheets_delete_writer on public.a4_barcode_sheets;
create policy a4_barcode_sheets_delete_writer
  on public.a4_barcode_sheets
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

drop policy if exists a4_barcode_sheet_cells_select_member
  on public.a4_barcode_sheet_cells;
create policy a4_barcode_sheet_cells_select_member
  on public.a4_barcode_sheet_cells
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists a4_barcode_sheet_cells_insert_writer
  on public.a4_barcode_sheet_cells;
create policy a4_barcode_sheet_cells_insert_writer
  on public.a4_barcode_sheet_cells
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists a4_barcode_sheet_cells_update_writer
  on public.a4_barcode_sheet_cells;
create policy a4_barcode_sheet_cells_update_writer
  on public.a4_barcode_sheet_cells
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists a4_barcode_sheet_cells_delete_writer
  on public.a4_barcode_sheet_cells;
create policy a4_barcode_sheet_cells_delete_writer
  on public.a4_barcode_sheet_cells
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Page feature + entitlement (product_labels kapu)
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/torzsadatok/vonalkod-lap',
  'Vonalkód lap',
  'Törzsadatok',
  '/torzsadatok/vonalkod-lap',
  95,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

-- Alap plan (címke már benne)
insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/torzsadatok/vonalkod-lap'
from public.product_plans p
where p.key = 'alap'
  and exists (
    select 1 from public.product_features f
    where f.key = '/torzsadatok/vonalkod-lap'
  )
on conflict do nothing;

-- Entitlement: akinek van product_labels
insert into public.tenant_entitlements (tenant_id, feature_key)
select distinct te.tenant_id, '/torzsadatok/vonalkod-lap'
from public.tenant_entitlements te
where te.feature_key = 'product_labels'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/torzsadatok/vonalkod-lap'
from public.tenants t
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
on conflict do nothing;

-- Page access: terméktörzs vagy product_labels entitlement
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select distinct m.tenant_id, m.id, '/torzsadatok/vonalkod-lap', true
from public.tenant_memberships m
where exists (
  select 1
  from public.tenant_membership_page_access pa
  where pa.membership_id = m.id
    and pa.can_access = true
    and pa.page_key = '/torzsadatok/alapanyagok/termekek'
)
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/torzsadatok/vonalkod-lap', true
from public.tenant_memberships m
join public.tenants t on t.id = m.tenant_id
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
