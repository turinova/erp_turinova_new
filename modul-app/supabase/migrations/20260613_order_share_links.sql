-- Publikus rendelés-státusz link (SMS → /r/{token}) — CSO + lapszab quote

create table if not exists public.order_share_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('cso', 'quote')),
  customer_special_order_id uuid
    references public.customer_special_orders (id) on delete cascade,
  quote_id uuid
    references public.quotes (id) on delete cascade,
  token text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint order_share_links_ref_chk check (
    (kind = 'cso' and customer_special_order_id is not null and quote_id is null)
    or (kind = 'quote' and quote_id is not null and customer_special_order_id is null)
  )
);

create unique index if not exists order_share_links_token_uidx
  on public.order_share_links (token);

create unique index if not exists order_share_links_cso_active_uidx
  on public.order_share_links (tenant_id, customer_special_order_id)
  where kind = 'cso'
    and customer_special_order_id is not null
    and revoked_at is null;

create unique index if not exists order_share_links_quote_active_uidx
  on public.order_share_links (tenant_id, quote_id)
  where kind = 'quote'
    and quote_id is not null
    and revoked_at is null;

create index if not exists order_share_links_expires_idx
  on public.order_share_links (expires_at)
  where revoked_at is null;

comment on table public.order_share_links is
  'SMS / ügyfél státuszoldal token — /r/{token}. Egy élő link / rendelés.';

alter table public.order_share_links enable row level security;

drop policy if exists order_share_links_select_member on public.order_share_links;
create policy order_share_links_select_member
  on public.order_share_links for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists order_share_links_insert_writer on public.order_share_links;
create policy order_share_links_insert_writer
  on public.order_share_links for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists order_share_links_update_writer on public.order_share_links;
create policy order_share_links_update_writer
  on public.order_share_links for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));
