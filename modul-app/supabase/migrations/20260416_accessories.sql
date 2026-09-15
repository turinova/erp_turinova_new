-- Termékek (accessories) törzs + ajánlat snapshot + page access.
-- Lean V1: nincs készlet / multiplier / valuta / partner.

-- ---------------------------------------------------------------------------
-- accessories
-- ---------------------------------------------------------------------------
create table if not exists public.accessories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  manufacturer_id uuid not null references public.manufacturers (id),
  tax_rate_id uuid not null references public.tax_rates (id),
  unit_id uuid not null references public.units (id),
  name text not null,
  sku text not null,
  barcode text,
  barcode_internal text,
  price_net numeric(12, 0) not null check (price_net >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists accessories_tenant_alive_idx
  on public.accessories (tenant_id)
  where deleted_at is null;

create index if not exists accessories_tenant_active_idx
  on public.accessories (tenant_id, active)
  where deleted_at is null;

create unique index if not exists accessories_tenant_sku_alive_uidx
  on public.accessories (tenant_id, lower(sku))
  where deleted_at is null;

create unique index if not exists accessories_tenant_barcode_alive_uidx
  on public.accessories (tenant_id, barcode)
  where deleted_at is null
    and barcode is not null
    and length(trim(barcode)) > 0;

create unique index if not exists accessories_tenant_barcode_internal_alive_uidx
  on public.accessories (tenant_id, barcode_internal)
  where deleted_at is null
    and barcode_internal is not null
    and length(trim(barcode_internal)) > 0;

alter table public.accessories enable row level security;

drop policy if exists accessories_select_member on public.accessories;
create policy accessories_select_member
  on public.accessories
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists accessories_insert_writer on public.accessories;
create policy accessories_insert_writer
  on public.accessories
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists accessories_update_writer on public.accessories;
create policy accessories_update_writer
  on public.accessories
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists accessories_delete_writer on public.accessories;
create policy accessories_delete_writer
  on public.accessories
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.accessories is 'Termékek / tartozékok törzs (lean); ajánlat snapshot quote_accessories';
comment on column public.accessories.price_net is 'Nettó Ft / egység; UI bruttót szerkeszt';
comment on column public.accessories.barcode is 'Gyártói vonalkód (opcionális)';
comment on column public.accessories.barcode_internal is 'Belső vonalkód (opcionális)';

-- ---------------------------------------------------------------------------
-- quotes accessories totals + final_total formula
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists accessories_total_net numeric(14, 2) not null default 0,
  add column if not exists accessories_total_vat numeric(14, 2) not null default 0,
  add column if not exists accessories_total_gross numeric(14, 2) not null default 0;

comment on column public.quotes.accessories_total_gross is 'Termékek bruttó összege az ajánlaton';
comment on column public.quotes.final_total_gross is
  'Lapszabászat total_gross + fees_total_gross + accessories_total_gross (≥ 0)';

-- ---------------------------------------------------------------------------
-- quote_accessories (snapshot)
-- ---------------------------------------------------------------------------
create table if not exists public.quote_accessories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  accessory_id uuid references public.accessories (id),
  accessory_name text not null,
  sku text not null,
  barcode text,
  barcode_internal text,
  quantity integer not null check (quantity >= 1),
  unit_id uuid references public.units (id),
  unit_shortform text not null default 'db',
  unit_price_net numeric(12, 2) not null check (unit_price_net >= 0),
  tax_rate_percent numeric(5, 2) not null check (tax_rate_percent >= 0),
  vat_amount numeric(14, 2) not null,
  gross_price numeric(14, 2) not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists quote_accessories_quote_alive_idx
  on public.quote_accessories (quote_id)
  where deleted_at is null;

create index if not exists quote_accessories_tenant_alive_idx
  on public.quote_accessories (tenant_id)
  where deleted_at is null;

alter table public.quote_accessories enable row level security;

drop policy if exists quote_accessories_select_member on public.quote_accessories;
create policy quote_accessories_select_member
  on public.quote_accessories
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists quote_accessories_insert_writer on public.quote_accessories;
create policy quote_accessories_insert_writer
  on public.quote_accessories
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists quote_accessories_update_writer on public.quote_accessories;
create policy quote_accessories_update_writer
  on public.quote_accessories
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists quote_accessories_delete_writer on public.quote_accessories;
create policy quote_accessories_delete_writer
  on public.quote_accessories
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

drop policy if exists quote_accessories_select_partner on public.quote_accessories;
create policy quote_accessories_select_partner
  on public.quote_accessories
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      where q.id = quote_id
        and q.partner_profile_id = auth.uid()
        and q.deleted_at is null
    )
  );

comment on table public.quote_accessories is 'Ajánlat termék sorok (snapshot)';
comment on column public.quote_accessories.unit_shortform is 'Egység rövidítés snapshot';
comment on column public.quote_accessories.gross_price is 'Sor bruttó összesen';

-- ---------------------------------------------------------------------------
-- page access / entitlements
-- ---------------------------------------------------------------------------
insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  a.tenant_id,
  a.membership_id,
  '/torzsadatok/alapanyagok/termekek',
  true
from public.tenant_membership_page_access a
where a.page_key = '/torzsadatok/alapanyagok/tablas-anyagok'
  and a.can_access = true
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();

insert into public.product_features (key, label, category, page_key, sort_order)
values
  (
    '/torzsadatok/alapanyagok/termekek',
    'Termékek',
    'Törzsadatok',
    '/torzsadatok/alapanyagok/termekek',
    78
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/torzsadatok/alapanyagok/termekek'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/torzsadatok/alapanyagok/termekek'
from public.tenants t
on conflict do nothing;
