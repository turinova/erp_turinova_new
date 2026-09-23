-- Számlázás (Számlázz.hu) — Alap plan része (nem add-on)
-- invoices + tenant_invoice_settings + page entitlements

-- ---------------------------------------------------------------------------
-- 1) Catalog features → Alap
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values
  (
    'szamlazas',
    'Számlázás',
    'Értékesítés',
    null,
    38,
    true
  ),
  (
    '/szamlak',
    'Számlák',
    'Értékesítés',
    '/szamlak',
    38,
    true
  ),
  (
    '/beallitasok/szamlazas',
    'Számlázás beállítások',
    'Beállítások',
    '/beallitasok/szamlazas',
    210,
    true
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_plan_features (plan_id, feature_key)
select p.id, v.feature_key
from public.product_plans p
cross join (
  values
    ('szamlazas'),
    ('/szamlak'),
    ('/beallitasok/szamlazas')
) as v(feature_key)
where p.key = 'alap'
  and exists (select 1 from public.product_features f where f.key = v.feature_key)
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, v.feature_key
from public.tenants t
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
cross join (
  values
    ('szamlazas'),
    ('/szamlak'),
    ('/beallitasok/szamlazas')
) as v(feature_key)
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, v.page_key, true
from public.tenant_memberships m
join public.tenants t on t.id = m.tenant_id
join public.product_plans p on p.id = t.plan_id and p.key = 'alap'
cross join (
  values ('/szamlak'), ('/beallitasok/szamlazas')
) as v(page_key)
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();

update public.product_plans
set
  description =
    'Bolt mag: eladás, árajánlat, készlet, beszerzés, POS, címke, számlázás, törzsadat.',
  updated_at = now()
where key = 'alap';

-- ---------------------------------------------------------------------------
-- 2) Settings (Számlázz Agent kulcs tenantonként)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_invoice_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  provider text not null default 'szamlazz_hu'
    check (provider in ('szamlazz_hu')),
  agent_key text,
  api_url text,
  default_send_email boolean not null default true,
  default_language text not null default 'hu',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_invoice_settings enable row level security;

drop policy if exists tenant_invoice_settings_select_member on public.tenant_invoice_settings;
create policy tenant_invoice_settings_select_member
  on public.tenant_invoice_settings for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_invoice_settings_upsert_writer on public.tenant_invoice_settings;
create policy tenant_invoice_settings_upsert_writer
  on public.tenant_invoice_settings for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists tenant_invoice_settings_update_writer on public.tenant_invoice_settings;
create policy tenant_invoice_settings_update_writer
  on public.tenant_invoice_settings for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- 3) invoices
-- ---------------------------------------------------------------------------
create sequence if not exists public.invoice_internal_seq start 1;

create or replace function public.next_internal_invoice_number()
returns text
language plpgsql
as $$
declare
  v_year text := to_char(now() at time zone 'UTC', 'YYYY');
  v_seq bigint;
begin
  v_seq := nextval('public.invoice_internal_seq');
  return format('INV-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
end;
$$;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  internal_number text not null default public.next_internal_invoice_number(),
  provider text not null default 'szamlazz_hu',
  provider_invoice_number text,
  provider_invoice_id text,
  invoice_type text not null
    check (invoice_type in ('szamla', 'elolegszamla', 'dijbekero', 'sztorno')),
  related_source_type text not null
    check (related_source_type in ('sale', 'opti_quote', 'opti_order')),
  related_source_id uuid,
  related_source_number text,
  customer_name text,
  customer_id uuid references public.customers (id) on delete set null,
  customer_email text,
  payment_due_date date,
  fulfillment_date date,
  gross_total numeric(12, 2),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'fizetve', 'nem_lesz_fizetve')),
  is_storno_of_invoice_id uuid references public.invoices (id) on delete set null,
  pdf_url text,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint invoices_tenant_internal_uidx unique (tenant_id, internal_number)
);

create index if not exists invoices_tenant_alive_idx
  on public.invoices (tenant_id, created_at desc)
  where deleted_at is null;

create index if not exists invoices_tenant_provider_number_idx
  on public.invoices (tenant_id, provider_invoice_number)
  where deleted_at is null;

create index if not exists invoices_related_source_idx
  on public.invoices (tenant_id, related_source_type, related_source_id)
  where deleted_at is null;

create index if not exists invoices_type_idx
  on public.invoices (tenant_id, invoice_type)
  where deleted_at is null;

alter table public.invoices enable row level security;

drop policy if exists invoices_select_member on public.invoices;
create policy invoices_select_member
  on public.invoices for select to authenticated
  using (public.is_tenant_member(tenant_id) and deleted_at is null);

drop policy if exists invoices_insert_writer on public.invoices;
create policy invoices_insert_writer
  on public.invoices for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists invoices_update_writer on public.invoices;
create policy invoices_update_writer
  on public.invoices for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

comment on table public.invoices is
  'Kimenő bizonylatok (Számlázz.hu). Alap plan feature.';
comment on table public.tenant_invoice_settings is
  'Számlázz Agent kulcs és számlázási defaultok tenantonként.';
