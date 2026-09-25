-- Storefront PDP (doc 38): bizalom, teljes költség, passzol-e, social proof.
-- 1) tenant_webshop_settings: szállítás / átvétel / csere / garancia / készlet küszöb
-- 2) accessories: csomag tartalma, méretrajz kép, mennyiségi ár
-- 3) product_reviews: moderált értékelések + eladói válasz
-- 4) RPC: eladott db (N nap), gyakran együtt vásárolt

-- ---------------------------------------------------------------------------
-- 1) Tenant webshop beállítások
-- ---------------------------------------------------------------------------
alter table public.tenant_webshop_settings
  add column if not exists shipping_fee_gross numeric(12, 0),
  add column if not exists free_shipping_threshold_gross numeric(12, 0),
  add column if not exists delivery_days_min integer,
  add column if not exists delivery_days_max integer,
  add column if not exists pickup_enabled boolean not null default false,
  add column if not exists pickup_label text,
  add column if not exists return_days integer,
  add column if not exists warranty_months integer,
  add column if not exists return_policy_text text,
  add column if not exists low_stock_threshold integer not null default 10,
  add column if not exists show_sold_count boolean not null default true,
  add column if not exists reviews_enabled boolean not null default true;

alter table public.tenant_webshop_settings
  drop constraint if exists tenant_webshop_settings_nonneg_chk;
alter table public.tenant_webshop_settings
  add constraint tenant_webshop_settings_nonneg_chk check (
    (shipping_fee_gross is null or shipping_fee_gross >= 0)
    and (free_shipping_threshold_gross is null or free_shipping_threshold_gross >= 0)
    and (delivery_days_min is null or delivery_days_min >= 0)
    and (delivery_days_max is null or delivery_days_max >= 0)
    and (return_days is null or return_days >= 0)
    and (warranty_months is null or warranty_months >= 0)
    and low_stock_threshold >= 0
  );

-- ---------------------------------------------------------------------------
-- 2) Termék: csomag tartalma, méretrajz, mennyiségi ár
-- ---------------------------------------------------------------------------
alter table public.accessories
  add column if not exists web_box_contents text[] not null default '{}',
  add column if not exists web_dimension_image_url text,
  add column if not exists web_price_tiers jsonb not null default '[]'::jsonb;

comment on column public.accessories.web_price_tiers is
  'Mennyiségi nettó ár: [{"min_qty":10,"price_net":1800}] — min_qty növekvő.';

-- ---------------------------------------------------------------------------
-- 3) Értékelések
-- ---------------------------------------------------------------------------
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
  author_email text,
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or char_length(title) <= 120),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  variant_label text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  seller_reply text check (seller_reply is null or char_length(seller_reply) <= 2000),
  seller_replied_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists product_reviews_public_idx
  on public.product_reviews (tenant_id, accessory_id, created_at desc)
  where deleted_at is null and status = 'approved';

create index if not exists product_reviews_moderation_idx
  on public.product_reviews (tenant_id, status, created_at desc)
  where deleted_at is null;

alter table public.product_reviews enable row level security;

drop policy if exists product_reviews_select on public.product_reviews;
drop policy if exists product_reviews_update on public.product_reviews;

-- Publikus beküldés / olvasás a storefronton service role-lal megy (RLS bypass).
create policy product_reviews_select
  on public.product_reviews for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy product_reviews_update
  on public.product_reviews for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- 4) RPC-k (service_role only — storefront)
-- ---------------------------------------------------------------------------
create or replace function public.storefront_sold_quantity(
  p_tenant_id uuid,
  p_accessory_id uuid,
  p_days integer default 30
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(i.quantity), 0)
  from public.sales_order_items i
  join public.sales_orders o on o.id = i.sales_order_id
  where i.tenant_id = p_tenant_id
    and i.accessory_id = p_accessory_id
    and i.deleted_at is null
    and o.deleted_at is null
    and o.status in ('confirmed', 'fulfilled')
    and o.created_at >= now() - make_interval(days => greatest(p_days, 1));
$$;

create or replace function public.storefront_bought_together(
  p_tenant_id uuid,
  p_accessory_id uuid,
  p_limit integer default 4
)
returns table (accessory_id uuid, orders_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with base_orders as (
    select distinct i.sales_order_id
    from public.sales_order_items i
    join public.sales_orders o on o.id = i.sales_order_id
    where i.tenant_id = p_tenant_id
      and i.accessory_id = p_accessory_id
      and i.deleted_at is null
      and o.deleted_at is null
      and o.status in ('confirmed', 'fulfilled')
      and o.created_at >= now() - interval '365 days'
  )
  select i.accessory_id, count(distinct i.sales_order_id) as orders_count
  from public.sales_order_items i
  join base_orders b on b.sales_order_id = i.sales_order_id
  join public.accessories a on a.id = i.accessory_id
  where i.tenant_id = p_tenant_id
    and i.accessory_id is not null
    and i.accessory_id <> p_accessory_id
    and i.deleted_at is null
    and a.deleted_at is null
    and a.active = true
    and a.sellable_web = true
    and a.web_slug is not null
  group by i.accessory_id
  having count(distinct i.sales_order_id) >= 2
  order by orders_count desc
  limit greatest(least(p_limit, 12), 1);
$$;

revoke all on function public.storefront_sold_quantity(uuid, uuid, integer) from public;
revoke all on function public.storefront_bought_together(uuid, uuid, integer) from public;
grant execute on function public.storefront_sold_quantity(uuid, uuid, integer) to service_role;
grant execute on function public.storefront_bought_together(uuid, uuid, integer) to service_role;
