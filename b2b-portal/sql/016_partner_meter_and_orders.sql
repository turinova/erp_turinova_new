-- =============================================================================
-- b2b-portal / 016_partner_meter_and_orders.sql
-- MANUÁLISAN futtasd — előtte: 010 + 015
-- Active Partner meter gerinc: widget-RENDELÉS attribúció (D3, D19)
-- Widget-open = analitika, NEM billing.
-- =============================================================================

-- Meglévő b2b_orders a fact tábla. Index a havi unique partner számláláshoz.
create index if not exists idx_b2b_orders_widget_partner_month
  on public.b2b_orders (shop_id, sr_customer_inner_id, created_at)
  where source = 'widget'
    and sr_customer_inner_id is not null
    and status in ('recorded', 'linked');

-- Analitika (nem számlázás)
create table if not exists public.widget_opens (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  sr_customer_inner_id integer,
  opened_at timestamptz not null default now()
);

create index if not exists idx_widget_opens_shop_opened
  on public.widget_opens (shop_id, opened_at desc);
create index if not exists idx_widget_opens_shop_customer
  on public.widget_opens (shop_id, sr_customer_inner_id, opened_at desc)
  where sr_customer_inner_id is not null;

-- Effektív partner limit (override ?? plan_defaults; trial → Pro 80)
create or replace function public.effective_partner_limit(p_org_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(
    o.partner_limit_override,
    case
      when o.status = 'trial' and o.trial_ends_at is not null and o.trial_ends_at > now()
        then (select partner_limit from public.plan_defaults where plan = 'pro')
      else d.partner_limit
    end
  )
  from public.organizations o
  join public.plan_defaults d on d.plan = o.plan
  where o.id = p_org_id;
$$;

create or replace function public.effective_sku_limit(p_org_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(
    o.sku_limit_override,
    case
      when o.status = 'trial' and o.trial_ends_at is not null and o.trial_ends_at > now()
        then (select sku_limit from public.plan_defaults where plan = 'pro')
      else d.sku_limit
    end
  )
  from public.organizations o
  join public.plan_defaults d on d.plan = o.plan
  where o.id = p_org_id;
$$;

-- Aktív partnerek a naptári hónapban = distinct sr_customer_inner_id widget-rendelésen
create or replace function public.count_active_partners_month(
  p_org_id uuid,
  p_month timestamptz default now()
)
returns integer
language sql
stable
as $$
  select count(distinct o.sr_customer_inner_id)::integer
  from public.b2b_orders o
  join public.shops s on s.id = o.shop_id
  where s.organization_id = p_org_id
    and s.purged_at is null
    and o.source = 'widget'
    and o.status in ('recorded', 'linked')
    and o.sr_customer_inner_id is not null
    and o.created_at >= date_trunc('month', p_month)
    and o.created_at < date_trunc('month', p_month) + interval '1 month';
$$;

-- Shop-szintű bontás (admin)
create or replace function public.count_active_partners_month_by_shop(
  p_org_id uuid,
  p_month timestamptz default now()
)
returns table (shop_id uuid, active_partners integer)
language sql
stable
as $$
  select
    s.id as shop_id,
    count(distinct o.sr_customer_inner_id)::integer as active_partners
  from public.shops s
  left join public.b2b_orders o
    on o.shop_id = s.id
    and o.source = 'widget'
    and o.status in ('recorded', 'linked')
    and o.sr_customer_inner_id is not null
    and o.created_at >= date_trunc('month', p_month)
    and o.created_at < date_trunc('month', p_month) + interval '1 month'
  where s.organization_id = p_org_id
    and s.purged_at is null
  group by s.id;
$$;

insert into public.schema_migrations (filename)
values ('016_partner_meter_and_orders.sql')
on conflict (filename) do nothing;

-- Ellenőrzés (cseréld az org uuid-t):
-- select public.count_active_partners_month('00000000-0000-0000-0000-000000000000');
-- select * from public.count_active_partners_month_by_shop('00000000-0000-0000-0000-000000000000');
