-- Jelenlét terminál (Raspberry Pi): PIN/RFID + per-tenant device token

-- ---------------------------------------------------------------------------
-- hr_employees: PIN + RFID (main-app employees formátum)
-- ---------------------------------------------------------------------------
alter table public.hr_employees
  add column if not exists pin_code text,
  add column if not exists rfid_card_id text;

comment on column public.hr_employees.pin_code is
  '4 számjegyű pult PIN; tenant-szinten unique aktív / nem törölt sorokra.';
comment on column public.hr_employees.rfid_card_id is
  'NFC/RFID kártya UID (pl. 8C93E105); tenant-szinten unique.';

-- Soft-delete / üres: partial unique — felszabadul törléskor (NULL-ra állítva)
create unique index if not exists hr_employees_tenant_pin_uidx
  on public.hr_employees (tenant_id, pin_code)
  where pin_code is not null
    and pin_code <> ''
    and deleted_at is null;

create unique index if not exists hr_employees_tenant_rfid_uidx
  on public.hr_employees (tenant_id, lower(rfid_card_id))
  where rfid_card_id is not null
    and rfid_card_id <> ''
    and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Terminál eszközök (footcounter_devices minta)
-- ---------------------------------------------------------------------------
create table if not exists public.jelenlet_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null,
  name text not null default '',
  sync_token_hash text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_jelenlet_devices_tenant
  on public.jelenlet_devices (tenant_id);

create index if not exists idx_jelenlet_devices_token_hash
  on public.jelenlet_devices (sync_token_hash)
  where sync_token_hash is not null;

comment on table public.jelenlet_devices is
  'Jelenlét Pi terminálok — sync_token_hash; plaintext soha nincs DB-ben.';

alter table public.jelenlet_devices enable row level security;

drop policy if exists jelenlet_devices_select_member on public.jelenlet_devices;
create policy jelenlet_devices_select_member
  on public.jelenlet_devices
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists jelenlet_devices_insert_member on public.jelenlet_devices;
create policy jelenlet_devices_insert_member
  on public.jelenlet_devices
  for insert
  to authenticated
  with check (public.is_tenant_member(tenant_id));

drop policy if exists jelenlet_devices_update_member on public.jelenlet_devices;
create policy jelenlet_devices_update_member
  on public.jelenlet_devices
  for update
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists jelenlet_devices_delete_member on public.jelenlet_devices;
create policy jelenlet_devices_delete_member
  on public.jelenlet_devices
  for delete
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists jelenlet_devices_platform_all on public.jelenlet_devices;
create policy jelenlet_devices_platform_all
  on public.jelenlet_devices
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Catalog: Terminálok page + addon feature
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/jelenlet/terminalok',
  'Jelenlét terminálok',
  'Jelenlét',
  '/jelenlet/terminalok',
  42,
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
select a.id, '/jelenlet/terminalok'
from public.product_addons a
where a.key = 'jelenlet'
  and exists (
    select 1 from public.product_features f where f.key = '/jelenlet/terminalok'
  )
on conflict do nothing;

-- Tenantok, ahol már van jelenlet entitlement → page entitlement is
insert into public.tenant_entitlements (tenant_id, feature_key)
select te.tenant_id, '/jelenlet/terminalok'
from public.tenant_entitlements te
where te.feature_key = 'jelenlet'
on conflict do nothing;

-- Membership page_access: akiknek van /jelenlet joguk
insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select a.tenant_id, a.membership_id, '/jelenlet/terminalok', true
from public.tenant_membership_page_access a
where a.page_key = '/jelenlet'
  and a.can_access = true
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
