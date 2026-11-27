-- ChatGPT (OpenAI Commerce) termékfeed: bútorlap + munkalap
-- Route: /beallitasok/feedek · Feed: /api/feeds/openai/{token}/feed.jsonl
-- Előfeltétel: 20261030_public_catalog_views.sql (slug, indexable_on_site)

create table if not exists public.product_feeds (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('openai')),
  enabled boolean not null default false,
  token text not null unique,
  site_base_url text not null default '',
  sheet_path text not null default '/butorlap',
  linear_path text not null default '/munkalap',
  country text not null default 'HU' check (country ~ '^[A-Z]{2}$'),
  currency text not null default 'HUF' check (currency ~ '^[A-Z]{3}$'),
  pickup_text text not null default '',
  return_policy_url text not null default '',
  return_days smallint not null default 14 check (return_days between 0 and 365),
  last_fetched_at timestamptz,
  last_item_count integer,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, kind)
);

comment on table public.product_feeds is
  'Termékfeed beállítás tenantonként (OpenAI Commerce). A token a feed URL titka.';

alter table public.product_feeds enable row level security;

drop policy if exists product_feeds_select_member on public.product_feeds;
create policy product_feeds_select_member
  on public.product_feeds for select to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

drop policy if exists product_feeds_insert_writer on public.product_feeds;
create policy product_feeds_insert_writer
  on public.product_feeds for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists product_feeds_update_writer on public.product_feeds;
create policy product_feeds_update_writer
  on public.product_feeds for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists product_feeds_platform_all on public.product_feeds;
create policy product_feeds_platform_all
  on public.product_feeds for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table public.sheet_materials
  add column if not exists feed_excluded boolean not null default false;

alter table public.linear_materials
  add column if not exists feed_excluded boolean not null default false;

comment on column public.sheet_materials.feed_excluded is 'true = kimarad a termékfeedből';
comment on column public.linear_materials.feed_excluded is 'true = kimarad a termékfeedből';

-- Oldal: feature + entitlement + page access (mint a Cégadatok)
insert into public.product_features (key, label, category, page_key, sort_order, active)
values ('/beallitasok/feedek', 'Termékfeedek', 'Beállítások', '/beallitasok/feedek', 178, true)
on conflict (key) do update
set label = excluded.label, category = excluded.category,
    page_key = excluded.page_key, sort_order = excluded.sort_order, active = true;

insert into public.product_plan_features (plan_id, feature_key)
select distinct pf.plan_id, '/beallitasok/feedek'
from public.product_plan_features pf
where pf.feature_key = '/beallitasok/cegadatok'
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select distinct e.tenant_id, '/beallitasok/feedek'
from public.tenant_entitlements e
where e.feature_key = '/beallitasok/cegadatok'
on conflict do nothing;

insert into public.tenant_membership_page_access (tenant_id, membership_id, page_key, can_access)
select a.tenant_id, a.membership_id, '/beallitasok/feedek', true
from public.tenant_membership_page_access a
where a.page_key = '/beallitasok/cegadatok' and a.can_access = true
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
