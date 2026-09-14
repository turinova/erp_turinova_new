-- modul-app: Opti árajánlat / megrendelés-hely (lean)
-- V1: nincs kedvezmény, szolgáltatás (pánthely…), fee/accessory, production, nesting JSON.
-- Futtasd: customers + sheet_materials + edge_materials + cutting_fees után.

-- ---------------------------------------------------------------------------
-- quotes (dokumentum — draft árajánlat → később megrendelés ugyanitt)
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id),

  quote_number text not null,
  order_number text,
  status text not null default 'draft'
    check (status in (
      'draft',
      'ordered',
      'in_production',
      'ready',
      'finished',
      'cancelled'
    )),
  source text not null default 'opti'
    check (source in ('opti', 'portal', 'internal')),

  pricing_mode text not null default 'standard'
    check (pricing_mode in ('standard', 'always_full_board', 'always_panel_area')),
  currency text not null default 'HUF',

  total_net numeric(14, 2) not null check (total_net >= 0),
  total_vat numeric(14, 2) not null check (total_vat >= 0),
  total_gross numeric(14, 2) not null check (total_gross >= 0),

  comment text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists quotes_tenant_quote_number_alive_uidx
  on public.quotes (tenant_id, quote_number)
  where deleted_at is null;

create unique index if not exists quotes_tenant_order_number_alive_uidx
  on public.quotes (tenant_id, order_number)
  where deleted_at is null and order_number is not null;

create index if not exists quotes_tenant_status_alive_idx
  on public.quotes (tenant_id, status)
  where deleted_at is null;

create index if not exists quotes_tenant_customer_alive_idx
  on public.quotes (tenant_id, customer_id)
  where deleted_at is null;

alter table public.quotes enable row level security;

drop policy if exists quotes_select_member on public.quotes;
create policy quotes_select_member
  on public.quotes
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists quotes_insert_writer on public.quotes;
create policy quotes_insert_writer
  on public.quotes
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists quotes_update_writer on public.quotes;
create policy quotes_update_writer
  on public.quotes
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists quotes_delete_writer on public.quotes;
create policy quotes_delete_writer
  on public.quotes
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.quotes is
  'Opti árajánlat / megrendelés-hely (V1 lean: nincs kedvezmény / szolgáltatás / production)';

-- ---------------------------------------------------------------------------
-- quote_panels (input — grain/cross, 4 él)
-- ---------------------------------------------------------------------------
create table if not exists public.quote_panels (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  sheet_material_id uuid not null references public.sheet_materials (id),
  grain_mm integer not null check (grain_mm > 0),
  cross_mm integer not null check (cross_mm > 0),
  quantity integer not null check (quantity > 0),
  label text,
  edge_a_id uuid references public.edge_materials (id),
  edge_b_id uuid references public.edge_materials (id),
  edge_c_id uuid references public.edge_materials (id),
  edge_d_id uuid references public.edge_materials (id),
  sort_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quote_panels_quote_id_idx
  on public.quote_panels (quote_id);

alter table public.quote_panels enable row level security;

drop policy if exists quote_panels_select_member on public.quote_panels;
create policy quote_panels_select_member
  on public.quote_panels
  for select
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.is_tenant_member(q.tenant_id)
    )
  );

drop policy if exists quote_panels_insert_writer on public.quote_panels;
create policy quote_panels_insert_writer
  on public.quote_panels
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.can_write_tenant(q.tenant_id)
    )
  );

drop policy if exists quote_panels_update_writer on public.quote_panels;
create policy quote_panels_update_writer
  on public.quote_panels
  for update
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.can_write_tenant(q.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.can_write_tenant(q.tenant_id)
    )
  );

drop policy if exists quote_panels_delete_writer on public.quote_panels;
create policy quote_panels_delete_writer
  on public.quote_panels
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.can_write_tenant(q.tenant_id)
    )
  );

comment on table public.quote_panels is
  'Opti paneltételek (grain/cross mm, él A–D). V1: nincs pánthely/duplung/szög.';

-- ---------------------------------------------------------------------------
-- quote_material_lines (lean árazási snapshot anyagonként)
-- ---------------------------------------------------------------------------
create table if not exists public.quote_material_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  sheet_material_id uuid not null references public.sheet_materials (id),
  material_name text not null,
  board_grain_mm integer not null check (board_grain_mm > 0),
  board_cross_mm integer not null check (board_cross_mm > 0),
  thickness_mm numeric(8, 2) not null check (thickness_mm > 0),
  on_stock boolean not null,
  price_per_sqm numeric(12, 2) not null check (price_per_sqm >= 0),
  vat_rate numeric(6, 4) not null check (vat_rate >= 0),
  usage_limit numeric(3, 2) not null,
  waste_multi numeric(4, 2) not null,
  boards_charged integer not null default 0 check (boards_charged >= 0),
  charged_sqm numeric(12, 4) not null default 0 check (charged_sqm >= 0),
  pricing_method text not null
    check (pricing_method in ('full_board', 'panel_area', 'mixed')),
  material_net numeric(14, 2) not null,
  material_vat numeric(14, 2) not null,
  material_gross numeric(14, 2) not null,
  edge_length_m numeric(12, 4) not null default 0,
  edge_net numeric(14, 2) not null default 0,
  edge_vat numeric(14, 2) not null default 0,
  edge_gross numeric(14, 2) not null default 0,
  cutting_length_m numeric(12, 4) not null default 0,
  cutting_net numeric(14, 2) not null default 0,
  cutting_vat numeric(14, 2) not null default 0,
  cutting_gross numeric(14, 2) not null default 0,
  total_net numeric(14, 2) not null,
  total_vat numeric(14, 2) not null,
  total_gross numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists quote_material_lines_quote_id_idx
  on public.quote_material_lines (quote_id);

alter table public.quote_material_lines enable row level security;

drop policy if exists quote_material_lines_select_member on public.quote_material_lines;
create policy quote_material_lines_select_member
  on public.quote_material_lines
  for select
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.is_tenant_member(q.tenant_id)
    )
  );

drop policy if exists quote_material_lines_insert_writer on public.quote_material_lines;
create policy quote_material_lines_insert_writer
  on public.quote_material_lines
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.can_write_tenant(q.tenant_id)
    )
  );

drop policy if exists quote_material_lines_update_writer on public.quote_material_lines;
create policy quote_material_lines_update_writer
  on public.quote_material_lines
  for update
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.can_write_tenant(q.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.can_write_tenant(q.tenant_id)
    )
  );

drop policy if exists quote_material_lines_delete_writer on public.quote_material_lines;
create policy quote_material_lines_delete_writer
  on public.quote_material_lines
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and public.can_write_tenant(q.tenant_id)
    )
  );

comment on table public.quote_material_lines is
  'Árazási snapshot anyagonként (mentéskori árak). Nesting layout nincs itt.';

-- ---------------------------------------------------------------------------
-- quote_edge_lines (élzáró bontás)
-- ---------------------------------------------------------------------------
create table if not exists public.quote_edge_lines (
  id uuid primary key default gen_random_uuid(),
  quote_material_line_id uuid not null
    references public.quote_material_lines (id) on delete cascade,
  edge_material_id uuid not null references public.edge_materials (id),
  edge_name text not null,
  length_m numeric(12, 4) not null check (length_m >= 0),
  price_per_m numeric(12, 2) not null check (price_per_m >= 0),
  net_price numeric(14, 2) not null,
  vat_amount numeric(14, 2) not null,
  gross_price numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists quote_edge_lines_material_line_idx
  on public.quote_edge_lines (quote_material_line_id);

alter table public.quote_edge_lines enable row level security;

drop policy if exists quote_edge_lines_select_member on public.quote_edge_lines;
create policy quote_edge_lines_select_member
  on public.quote_edge_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and public.is_tenant_member(q.tenant_id)
    )
  );

drop policy if exists quote_edge_lines_insert_writer on public.quote_edge_lines;
create policy quote_edge_lines_insert_writer
  on public.quote_edge_lines
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and public.can_write_tenant(q.tenant_id)
    )
  );

drop policy if exists quote_edge_lines_update_writer on public.quote_edge_lines;
create policy quote_edge_lines_update_writer
  on public.quote_edge_lines
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and public.can_write_tenant(q.tenant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and public.can_write_tenant(q.tenant_id)
    )
  );

drop policy if exists quote_edge_lines_delete_writer on public.quote_edge_lines;
create policy quote_edge_lines_delete_writer
  on public.quote_edge_lines
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.quote_material_lines ml
      join public.quotes q on q.id = ml.quote_id
      where ml.id = quote_material_line_id
        and public.can_write_tenant(q.tenant_id)
    )
  );

comment on table public.quote_edge_lines is
  'Élzáró árazási bontás material line-hoz.';

-- ---------------------------------------------------------------------------
-- Számgeneráló (tenant-scoped)
-- ---------------------------------------------------------------------------
create or replace function public.generate_quote_number(p_tenant_id uuid)
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
      substring(quote_number from length('Q-' || current_year::text || '-') + 1)
      as integer
    )
  ), 0) + 1
  into next_number
  from public.quotes
  where tenant_id = p_tenant_id
    and quote_number like 'Q-' || current_year::text || '-%'
    and deleted_at is null;

  return 'Q-' || current_year::text || '-' || lpad(next_number::text, 3, '0');
end;
$$;

revoke all on function public.generate_quote_number(uuid) from public;
grant execute on function public.generate_quote_number(uuid) to authenticated;
