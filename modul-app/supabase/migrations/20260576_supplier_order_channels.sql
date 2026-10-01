-- Beszállítói rendelési csatornák + PO e-mail bevezető + beszállítói cikkszám.
-- Gyorsítás: webshop URL sablon (terméknév katt), e-mail draft (intro + tételek).

-- ---------------------------------------------------------------------------
-- suppliers.email_po_intro_html
-- ---------------------------------------------------------------------------
alter table public.suppliers
  add column if not exists email_po_intro_html text;

comment on column public.suppliers.email_po_intro_html is
  'PO e-mail bevezető (HTML/plain); üres = csak tétellista.';

-- ---------------------------------------------------------------------------
-- accessory_suppliers.supplier_sku
-- ---------------------------------------------------------------------------
alter table public.accessory_suppliers
  add column if not exists supplier_sku text;

comment on column public.accessory_suppliers.supplier_sku is
  'Beszállítói / gyártói cikkszám — webshop URL {{supplier_sku}} helyőrzőhöz.';

-- ---------------------------------------------------------------------------
-- supplier_order_channels
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_order_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  channel_type text not null
    check (channel_type in ('email', 'phone', 'in_person', 'internet')),
  name text,
  url_template text,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint supplier_order_channels_internet_url_check
    check (
      channel_type <> 'internet'
      or (url_template is not null and length(trim(url_template)) > 0)
    )
);

create index if not exists supplier_order_channels_supplier_alive_idx
  on public.supplier_order_channels (supplier_id)
  where deleted_at is null;

create index if not exists supplier_order_channels_tenant_alive_idx
  on public.supplier_order_channels (tenant_id)
  where deleted_at is null;

alter table public.supplier_order_channels enable row level security;

drop policy if exists supplier_order_channels_select_member
  on public.supplier_order_channels;
create policy supplier_order_channels_select_member
  on public.supplier_order_channels
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists supplier_order_channels_insert_writer
  on public.supplier_order_channels;
create policy supplier_order_channels_insert_writer
  on public.supplier_order_channels
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists supplier_order_channels_update_writer
  on public.supplier_order_channels;
create policy supplier_order_channels_update_writer
  on public.supplier_order_channels
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists supplier_order_channels_delete_writer
  on public.supplier_order_channels;
create policy supplier_order_channels_delete_writer
  on public.supplier_order_channels
  for delete
  to authenticated
  using (public.can_write_tenant(tenant_id));

comment on table public.supplier_order_channels is
  'Beszállító rendelési csatorna: e-mail / telefon / személyes / internet (URL sablon).';

comment on column public.supplier_order_channels.url_template is
  'Internet: pl. https://shop.example/search?q={{sku}} — {{sku}}, {{supplier_sku}}, {{name}}, {{ean}}.';
