-- Kézi rendelés vevői státuszoldal (/r/{token}) — order_share_links kind = 'manual'.

alter table public.order_share_links
  add column if not exists manual_order_id uuid
    references public.manual_orders (id) on delete cascade;

alter table public.order_share_links
  drop constraint if exists order_share_links_kind_check;

alter table public.order_share_links
  add constraint order_share_links_kind_check
  check (kind in ('cso', 'quote', 'manual'));

alter table public.order_share_links
  drop constraint if exists order_share_links_ref_chk;

alter table public.order_share_links
  add constraint order_share_links_ref_chk check (
    (kind = 'cso' and customer_special_order_id is not null and quote_id is null and manual_order_id is null)
    or (kind = 'quote' and quote_id is not null and customer_special_order_id is null and manual_order_id is null)
    or (kind = 'manual' and manual_order_id is not null and customer_special_order_id is null and quote_id is null)
  );

create unique index if not exists order_share_links_manual_active_uidx
  on public.order_share_links (tenant_id, manual_order_id)
  where kind = 'manual'
    and manual_order_id is not null
    and revoked_at is null;
