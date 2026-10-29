-- Opti megmunkálás V1.5: duplungolás + szögvágás (pánthely később)
-- Díjak default 0 Ft — jelölés mehet, ár opcionális.

alter table public.cutting_fees
  add column if not exists duplungolas_fee_per_sqm numeric(10, 2) not null default 0
    check (duplungolas_fee_per_sqm >= 0);

alter table public.cutting_fees
  add column if not exists szogvagas_fee_per_panel numeric(10, 2) not null default 0
    check (szogvagas_fee_per_panel >= 0);

comment on column public.cutting_fees.duplungolas_fee_per_sqm is
  'Nettó duplungolási díj Ft/m² (UI bruttót mutat). 0 = ingyenes jelölés.';
comment on column public.cutting_fees.szogvagas_fee_per_panel is
  'Nettó szögvágási díj Ft/panel-darab (UI bruttót mutat). 0 = ingyenes jelölés.';

alter table public.quote_panels
  add column if not exists duplungolas boolean not null default false;

alter table public.quote_panels
  add column if not exists szogvagas boolean not null default false;

comment on table public.quote_panels is
  'Opti paneltételek (grain/cross mm, él A–D, duplung/szög). Pánthely később.';

-- Anyagsoros megmunkálás snapshot (main-app quote_services_breakdown parity)
create table if not exists public.quote_service_lines (
  id uuid primary key default gen_random_uuid(),
  quote_material_line_id uuid not null
    references public.quote_material_lines (id) on delete cascade,
  service_type text not null
    check (service_type in ('duplungolas', 'szogvagas')),
  quantity numeric(12, 4) not null check (quantity > 0),
  unit text not null,
  unit_price_net numeric(12, 2) not null check (unit_price_net >= 0),
  net_price numeric(12, 2) not null,
  vat_amount numeric(12, 2) not null,
  gross_price numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists quote_service_lines_material_line_idx
  on public.quote_service_lines (quote_material_line_id);

alter table public.quote_service_lines enable row level security;

drop policy if exists quote_service_lines_select_member on public.quote_service_lines;
create policy quote_service_lines_select_member
  on public.quote_service_lines
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

drop policy if exists quote_service_lines_insert_writer on public.quote_service_lines;
create policy quote_service_lines_insert_writer
  on public.quote_service_lines
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

drop policy if exists quote_service_lines_update_writer on public.quote_service_lines;
create policy quote_service_lines_update_writer
  on public.quote_service_lines
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

drop policy if exists quote_service_lines_delete_writer on public.quote_service_lines;
create policy quote_service_lines_delete_writer
  on public.quote_service_lines
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

comment on table public.quote_service_lines is
  'Opti megmunkálás sorok anyagonként (duplung / szög). Cascade a material line törlésével.';
