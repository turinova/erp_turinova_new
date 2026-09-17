-- Belépők (footcounter) add-on — tenant-aware devices + crossings
-- Sync: per-device token (hash in DB); no global Vercel secret per tenant.

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  'footcounter',
  'Belépők',
  'Add-on',
  '/belepok',
  530,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addons (key, name, description, active, price_monthly_huf)
values (
  'footcounter',
  'Belépők',
  'Bejárati forgalomszámláló (Raspberry Pi) — élő adatok tenantonként.',
  true,
  9900
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  price_monthly_huf = excluded.price_monthly_huf,
  updated_at = now();

insert into public.product_addon_features (addon_id, feature_key)
select a.id, 'footcounter'
from public.product_addons a
where a.key = 'footcounter'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.footcounter_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null,
  name text not null default '',
  sync_token_hash text,
  stream_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_footcounter_devices_tenant
  on public.footcounter_devices (tenant_id);

create index if not exists idx_footcounter_devices_token_hash
  on public.footcounter_devices (sync_token_hash)
  where sync_token_hash is not null;

create table if not exists public.footcounter_crossings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.footcounter_devices (id) on delete cascade,
  client_event_id uuid not null,
  occurred_at timestamptz not null,
  direction text not null check (direction in ('in', 'out')),
  confidence real,
  created_at timestamptz not null default now(),
  unique (device_id, client_event_id)
);

create index if not exists idx_footcounter_crossings_device_occurred
  on public.footcounter_crossings (device_id, occurred_at desc);

comment on table public.footcounter_devices is
  'Belépők Pi eszközök — sync_token_hash platformról; plaintext soha nincs DB-ben.';
comment on table public.footcounter_crossings is
  'Áthaladások; client_event_id idempotens UUID a Pi-ről.';

alter table public.footcounter_devices enable row level security;
alter table public.footcounter_crossings enable row level security;

-- Tenant members: read own devices / crossings. Writes via service role (sync API).
drop policy if exists footcounter_devices_select_member on public.footcounter_devices;
create policy footcounter_devices_select_member
  on public.footcounter_devices
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists footcounter_crossings_select_member on public.footcounter_crossings;
create policy footcounter_crossings_select_member
  on public.footcounter_crossings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.footcounter_devices d
      where d.id = device_id
        and public.is_tenant_member(d.tenant_id)
    )
  );

-- Platform admin full access (service role bypasses RLS; explicit for admin client if JWT)
drop policy if exists footcounter_devices_platform_all on public.footcounter_devices;
create policy footcounter_devices_platform_all
  on public.footcounter_devices
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists footcounter_crossings_platform_all on public.footcounter_crossings;
create policy footcounter_crossings_platform_all
  on public.footcounter_crossings
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
