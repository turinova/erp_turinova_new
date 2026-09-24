-- POS terminál beállítások (Teya POSLink Off-Device) + /pos/beallitasok entitlement

-- ---------------------------------------------------------------------------
-- 1) Page feature
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/pos/beallitasok',
  'POS beállítások',
  'Értékesítés',
  '/pos/beallitasok',
  37,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

-- Alap plan + akiknek van /pos entitlement
insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/pos/beallitasok'
from public.product_plans p
where p.key = 'alap'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select te.tenant_id, '/pos/beallitasok'
from public.tenant_entitlements te
where te.feature_key in ('/pos', 'pos')
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/pos/beallitasok', true
from public.tenant_memberships m
where exists (
  select 1
  from public.tenant_membership_page_access a
  where a.membership_id = m.id
    and a.page_key = '/pos'
    and a.can_access = true
)
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Settings table
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_pos_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  card_provider text not null default 'manual'
    check (card_provider in ('none', 'manual', 'teya')),
  teya_env text not null default 'production'
    check (teya_env in ('production', 'staging')),
  teya_store_id text,
  teya_terminal_id text,
  teya_client_id text,
  teya_client_secret text,
  teya_epos_instance_id text not null default 'modul-pos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_pos_settings enable row level security;

drop policy if exists tenant_pos_settings_select_member on public.tenant_pos_settings;
create policy tenant_pos_settings_select_member
  on public.tenant_pos_settings for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_pos_settings_insert_writer on public.tenant_pos_settings;
create policy tenant_pos_settings_insert_writer
  on public.tenant_pos_settings for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_pos_settings_update_writer on public.tenant_pos_settings;
create policy tenant_pos_settings_update_writer
  on public.tenant_pos_settings for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));
