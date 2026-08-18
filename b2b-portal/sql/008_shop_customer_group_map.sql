-- =============================================================================
-- b2b-portal / 008_shop_customer_group_map.sql
-- MANUÁLISAN futtasd — előtte: 001–007
-- SaaS: shop_id → shops.organization_id (RLS: 011)
-- =============================================================================

create table if not exists public.shop_customer_group_map (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  sr_group_inner_id integer not null,
  sr_group_id text,
  sr_name_snapshot text not null default '',
  role text not null default 'bolt'
    check (role in ('bolt', 'gomb', 'rejtett')),
  is_default_in_sr boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_customer_group_map_unique
    unique (shop_id, sr_group_inner_id)
);

create index if not exists idx_scgm_shop_role
  on public.shop_customer_group_map (shop_id, role);

drop trigger if exists trg_scgm_updated_at on public.shop_customer_group_map;
create trigger trg_scgm_updated_at
  before update on public.shop_customer_group_map
  for each row execute function public.set_updated_at();

-- Backfill: meglévő widget_settings.customer_group_ids → role = gomb
insert into public.shop_customer_group_map (
  shop_id, sr_group_inner_id, sr_name_snapshot, role
)
select
  w.shop_id,
  g.gid,
  'Csoport ' || g.gid::text,
  'gomb'
from public.widget_settings w
cross join lateral unnest(coalesce(w.customer_group_ids, '{}'::integer[])) as g(gid)
on conflict (shop_id, sr_group_inner_id) do update
  set role = excluded.role,
      updated_at = now();

insert into public.schema_migrations (filename)
values ('008_shop_customer_group_map.sql')
on conflict (filename) do nothing;
