-- Bolti kiosk beállítások + eszköz kapu — Lapszabászat része
-- Staff UI: /beallitasok/kiosk · publikus: /k/<tenant-slug>

-- ---------------------------------------------------------------------------
-- tenant_kiosk_settings (1 sor / tenant)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_kiosk_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,

  kiosk_enabled boolean not null default false,

  -- all | stock_only | favorites | stock_and_favorites
  catalog_mode text not null default 'stock_only'
    check (catalog_mode in ('all', 'stock_only', 'favorites', 'stock_and_favorites')),

  favorite_sheet_ids uuid[] not null default '{}'::uuid[],

  -- típus id → edge_materials.id (pl. {"foil-04":"…","abs-1":"…"})
  edge_type_map jsonb not null default '{}'::jsonb,

  max_panel_rows smallint not null default 8
    check (max_panel_rows between 1 and 40),
  max_qty_per_line smallint not null default 20
    check (max_qty_per_line between 1 and 100),

  idle_warn_sec smallint not null default 75
    check (idle_warn_sec between 30 and 600),
  idle_reset_sec smallint not null default 90
    check (idle_reset_sec between 45 and 900),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_kiosk_idle_order
    check (idle_reset_sec > idle_warn_sec),
  constraint tenant_kiosk_edge_map_object
    check (jsonb_typeof(edge_type_map) = 'object')
);

comment on table public.tenant_kiosk_settings is
  'Bolti lapszab kiosk tenant beállítások — Lapszabászat része';

alter table public.tenant_kiosk_settings enable row level security;

drop policy if exists tenant_kiosk_settings_select_member
  on public.tenant_kiosk_settings;
create policy tenant_kiosk_settings_select_member
  on public.tenant_kiosk_settings
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_kiosk_settings_insert_writer
  on public.tenant_kiosk_settings;
create policy tenant_kiosk_settings_insert_writer
  on public.tenant_kiosk_settings
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_kiosk_settings_update_writer
  on public.tenant_kiosk_settings;
create policy tenant_kiosk_settings_update_writer
  on public.tenant_kiosk_settings
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- kiosk_devices (párosított tabletek)
-- ---------------------------------------------------------------------------
create table if not exists public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  token_hash text not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint kiosk_devices_name_len
    check (char_length(trim(name)) between 1 and 80)
);

create unique index if not exists kiosk_devices_token_hash_uidx
  on public.kiosk_devices (token_hash)
  where revoked_at is null;

create index if not exists kiosk_devices_tenant_idx
  on public.kiosk_devices (tenant_id)
  where revoked_at is null;

comment on table public.kiosk_devices is
  'Bolti kiosk párosított eszközök — token hash, plaintext egyszer a UI-ban';

alter table public.kiosk_devices enable row level security;

drop policy if exists kiosk_devices_select_member on public.kiosk_devices;
create policy kiosk_devices_select_member
  on public.kiosk_devices
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists kiosk_devices_insert_writer on public.kiosk_devices;
create policy kiosk_devices_insert_writer
  on public.kiosk_devices
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists kiosk_devices_update_writer on public.kiosk_devices;
create policy kiosk_devices_update_writer
  on public.kiosk_devices
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- Soft revoke: nincs delete policy (író update revoked_at).

-- ---------------------------------------------------------------------------
-- Page feature — lapszabaszat addon
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beallitasok/kiosk',
  'Kiosk beállítások',
  'Beállítások',
  '/beallitasok/kiosk',
  173,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addon_features (addon_id, feature_key)
select a.id, '/beallitasok/kiosk'
from public.product_addons a
where a.key = 'lapszabaszat'
on conflict do nothing;

-- Meglévő lapszabászat tenantek: entitlement + default settings + page_access
insert into public.tenant_entitlements (tenant_id, feature_key)
select e.tenant_id, '/beallitasok/kiosk'
from public.tenant_entitlements e
where e.feature_key = 'lapszabaszat'
on conflict do nothing;

insert into public.tenant_kiosk_settings (tenant_id)
select e.tenant_id
from public.tenant_entitlements e
where e.feature_key = 'lapszabaszat'
on conflict (tenant_id) do nothing;

insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  a.tenant_id,
  a.membership_id,
  '/beallitasok/kiosk',
  true
from public.tenant_membership_page_access a
where a.page_key = '/beallitasok/opti'
  and a.can_access = true
  and exists (
    select 1
    from public.tenant_entitlements e
    where e.tenant_id = a.tenant_id
      and e.feature_key = 'lapszabaszat'
  )
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
