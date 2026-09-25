-- Storefront: „Szólj, ha megérkezik” kérések elfogyott termékre.
-- Beküldés a storefronton service role-lal (RLS bypass); olvasás / lezárás a tenant tagjainak.

create table if not exists public.storefront_stock_notify_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 200),
  variant_label text check (variant_label is null or char_length(variant_label) <= 120),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  notified_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);

create unique index if not exists storefront_stock_notify_open_uidx
  on public.storefront_stock_notify_requests (tenant_id, accessory_id, lower(email))
  where notified_at is null and deleted_at is null;

create index if not exists storefront_stock_notify_pending_idx
  on public.storefront_stock_notify_requests (tenant_id, created_at desc)
  where notified_at is null and deleted_at is null;

alter table public.storefront_stock_notify_requests enable row level security;

drop policy if exists storefront_stock_notify_select on public.storefront_stock_notify_requests;
drop policy if exists storefront_stock_notify_update on public.storefront_stock_notify_requests;

create policy storefront_stock_notify_select
  on public.storefront_stock_notify_requests for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy storefront_stock_notify_update
  on public.storefront_stock_notify_requests for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

comment on table public.storefront_stock_notify_requests is
  'Vásárlói kérés: e-mail, ha az elfogyott termék újra rendelhető. notified_at = lezárva.';
