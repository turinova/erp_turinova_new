-- Termék címke (33×25) nyomtató illesztés — 1 sor / tenant
-- UI: ProductLabelPrintDialog → Beállítások (összecsukva)

create table if not exists public.tenant_label_print_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  offset_x_mm numeric(3, 1) not null default 0
    check (offset_x_mm >= -2.0 and offset_x_mm <= 2.0),
  offset_y_mm numeric(3, 1) not null default 0
    check (offset_y_mm >= -2.0 and offset_y_mm <= 2.0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_label_print_settings is
  'Termék címkenyomtatás H/V illesztés (mm) — böngésző helyett tenant-szintű';

alter table public.tenant_label_print_settings enable row level security;

drop policy if exists tenant_label_print_settings_select_member
  on public.tenant_label_print_settings;
create policy tenant_label_print_settings_select_member
  on public.tenant_label_print_settings
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_label_print_settings_insert_writer
  on public.tenant_label_print_settings;
create policy tenant_label_print_settings_insert_writer
  on public.tenant_label_print_settings
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_label_print_settings_update_writer
  on public.tenant_label_print_settings;
create policy tenant_label_print_settings_update_writer
  on public.tenant_label_print_settings
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));
