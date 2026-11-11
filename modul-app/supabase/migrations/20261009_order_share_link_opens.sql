-- Kész-értesítő SMS státusz link (/r/…) megnyitás — bolti Megrendelés info.
-- Docs: 44-order-status-share.md

alter table public.order_share_links
  add column if not exists first_opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists open_count integer not null default 0;

comment on column public.order_share_links.first_opened_at is
  'Első valódi státuszoldal-megnyitás (bot/prefetch nélkül).';
comment on column public.order_share_links.last_opened_at is
  'Utolsó valódi státuszoldal-megnyitás.';
comment on column public.order_share_links.open_count is
  'Valódi megnyitások számaossága (előnézet bot nélkül).';

create or replace function public.touch_order_share_open(p_link_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.order_share_links
  set
    first_opened_at = coalesce(first_opened_at, now()),
    last_opened_at = now(),
    open_count = open_count + 1
  where id = p_link_id
    and revoked_at is null;
$$;

revoke all on function public.touch_order_share_open(uuid) from public;
grant execute on function public.touch_order_share_open(uuid) to service_role;
