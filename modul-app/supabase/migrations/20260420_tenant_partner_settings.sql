-- Online partner settings: kereső scope + staff settings oldal (addon-gated)

-- ---------------------------------------------------------------------------
-- tenant_partner_settings (1 sor / tenant)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_partner_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  search_sheet boolean not null default true,
  search_linear boolean not null default true,
  search_accessory boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_partner_settings_at_least_one_search
    check (search_sheet or search_linear or search_accessory)
);

comment on table public.tenant_partner_settings is
  'Online partner rendelés tenant beállítások (kereső scope stb.)';

alter table public.tenant_partner_settings enable row level security;

drop policy if exists tenant_partner_settings_select_member
  on public.tenant_partner_settings;
create policy tenant_partner_settings_select_member
  on public.tenant_partner_settings
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_partner_settings_insert_writer
  on public.tenant_partner_settings;
create policy tenant_partner_settings_insert_writer
  on public.tenant_partner_settings
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_partner_settings_update_writer
  on public.tenant_partner_settings;
create policy tenant_partner_settings_update_writer
  on public.tenant_partner_settings
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- Partner olvashatja a kiválasztott cég beállításait (kereső chippek)
drop policy if exists tenant_partner_settings_select_partner
  on public.tenant_partner_settings;
create policy tenant_partner_settings_select_partner
  on public.tenant_partner_settings
  for select
  to authenticated
  using (public.partner_can_read_tenant_catalog(tenant_id));

-- ---------------------------------------------------------------------------
-- Staff page feature — csak a partner_orders add-on része
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beallitasok/partner',
  'Online partner',
  'Beállítások',
  '/beallitasok/partner',
  175,
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
select a.id, '/beallitasok/partner'
from public.product_addons a
where a.key = 'partner_orders'
on conflict do nothing;

-- Meglévő partner_orders tenantek: entitlement + default settings + page_access
insert into public.tenant_entitlements (tenant_id, feature_key)
select e.tenant_id, '/beallitasok/partner'
from public.tenant_entitlements e
where e.feature_key = 'partner_orders'
on conflict do nothing;

insert into public.tenant_partner_settings (tenant_id)
select e.tenant_id
from public.tenant_entitlements e
where e.feature_key = 'partner_orders'
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
  '/beallitasok/partner',
  true
from public.tenant_membership_page_access a
where a.page_key = '/beallitasok/cegadatok'
  and a.can_access = true
  and exists (
    select 1
    from public.tenant_entitlements e
    where e.tenant_id = a.tenant_id
      and e.feature_key = 'partner_orders'
  )
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
