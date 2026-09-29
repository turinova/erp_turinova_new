-- Átvételi blokk (hőnyomtató) — Lapszabászat ajándék feature
-- Beállítások: /beallitasok/atveteli-blokk · entitlement lapszabaszat

-- ---------------------------------------------------------------------------
-- tenant_handover_slip_settings (1 sor / tenant)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_handover_slip_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,

  enabled boolean not null default true,
  copies smallint not null default 2
    check (copies in (0, 1, 2)),
  single_copy_kind text not null default 'customer'
    check (single_copy_kind in ('customer', 'original')),
  paper_width_mm smallint not null default 80
    check (paper_width_mm in (58, 80)),
  auto_on_handover boolean not null default true,
  ask_before_print boolean not null default false,

  show_company_logo boolean not null default true,
  show_company_address boolean not null default true,
  show_company_phone boolean not null default true,
  show_company_email boolean not null default true,
  show_tax_number boolean not null default true,
  show_order_number boolean not null default true,
  show_customer_name boolean not null default true,
  show_barcode boolean not null default true,
  show_print_datetime boolean not null default true,

  show_materials boolean not null default true,
  show_edge boolean not null default true,
  show_services boolean not null default true,
  show_fees boolean not null default false,
  show_accessories boolean not null default false,
  qty_format text not null default 'm2_db'
    check (qty_format in ('m2_db', 'm2_only', 'boards_only')),

  show_legal_text boolean not null default true,
  legal_text text not null default
    'A megrendelő igazolja, hogy az árut mennyiségben és minőségben hiánytalanul átvette. Az átvételt követően reklamációra nincs lehetőség.',
  show_gate_line boolean not null default true,
  gate_line_text text not null default
    'Áru kizárólag ezen átvételi blokk bemutatásával adható ki.',
  show_signatures boolean not null default true,
  customer_copy_label text not null default 'Vevői példány',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_handover_slip_legal_len
    check (char_length(legal_text) <= 800),
  constraint tenant_handover_slip_gate_len
    check (char_length(gate_line_text) <= 200),
  constraint tenant_handover_slip_label_len
    check (char_length(customer_copy_label) <= 40)
);

comment on table public.tenant_handover_slip_settings is
  'Opti átvételi blokk (hőnyomtató) tenant beállítások — Lapszabászat része';

alter table public.tenant_handover_slip_settings enable row level security;

drop policy if exists tenant_handover_slip_settings_select_member
  on public.tenant_handover_slip_settings;
create policy tenant_handover_slip_settings_select_member
  on public.tenant_handover_slip_settings
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_handover_slip_settings_insert_writer
  on public.tenant_handover_slip_settings;
create policy tenant_handover_slip_settings_insert_writer
  on public.tenant_handover_slip_settings
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_handover_slip_settings_update_writer
  on public.tenant_handover_slip_settings;
create policy tenant_handover_slip_settings_update_writer
  on public.tenant_handover_slip_settings
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Page feature — lapszabaszat addon
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/beallitasok/atveteli-blokk',
  'Átvételi blokk',
  'Beállítások',
  '/beallitasok/atveteli-blokk',
  172,
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
select a.id, '/beallitasok/atveteli-blokk'
from public.product_addons a
where a.key = 'lapszabaszat'
on conflict do nothing;

-- Meglévő lapszabászat tenantek: entitlement + default settings + page_access
insert into public.tenant_entitlements (tenant_id, feature_key)
select e.tenant_id, '/beallitasok/atveteli-blokk'
from public.tenant_entitlements e
where e.feature_key = 'lapszabaszat'
on conflict do nothing;

insert into public.tenant_handover_slip_settings (tenant_id)
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
  '/beallitasok/atveteli-blokk',
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
