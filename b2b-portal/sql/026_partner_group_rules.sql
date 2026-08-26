-- =============================================================================
-- b2b-portal / 026_partner_group_rules.sql
-- Partner szintlépés szabályok (automatikus vevőcsoport-átrakás).
-- Az app első API híváskor is létrehozza (ensurePartnerGroupRulesSchema) —
-- ezt a fájlt deploy/docs célra tartjuk; manuális futtatás NEM kötelező.
-- =============================================================================

create table if not exists public.partner_group_rules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null
    references public.shops (id) on delete cascade,
  name text not null default '',
  enabled boolean not null default true,
  metric text not null
    check (metric in ('lifetime_spent', 'order_count')),
  threshold numeric(14, 2) not null
    check (threshold >= 0),
  -- üres = bármely csoportból (kivéve a cél)
  from_group_inner_ids integer[] not null default '{}',
  to_group_inner_id integer not null,
  to_group_outer_id text,
  to_group_name text,
  priority integer not null default 100,
  period text not null default 'lifetime'
    check (period in ('lifetime', 'rolling_12m', 'calendar_year', 'custom')),
  period_from date,
  period_to date,
  keep_threshold numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_group_rules_shop
  on public.partner_group_rules (shop_id, enabled, priority);

drop trigger if exists trg_partner_group_rules_updated_at
  on public.partner_group_rules;
create trigger trg_partner_group_rules_updated_at
  before update on public.partner_group_rules
  for each row execute function public.set_updated_at();

alter table public.shop_customer_group_moves
  add column if not exists source text not null default 'manual';
alter table public.shop_customer_group_moves
  add column if not exists rule_id uuid;
alter table public.shop_customer_group_moves
  add column if not exists reason text;

alter table public.shop_customers
  add column if not exists skip_auto_group_move boolean not null default false;
alter table public.shop_customers
  add column if not exists group_rules_qualified_at timestamptz;

alter table public.shop_customer_group_moves
  add column if not exists metric text;
alter table public.shop_customer_group_moves
  add column if not exists metric_value numeric(14, 2);
alter table public.shop_customer_group_moves
  add column if not exists threshold numeric(14, 2);
alter table public.shop_customer_group_moves
  add column if not exists period text;
alter table public.shop_customer_group_moves
  add column if not exists direction text;

alter table public.shops
  add column if not exists group_rules_auto_enabled boolean not null default false;
alter table public.shops
  add column if not exists group_rules_auto_last_run_at timestamptz;
alter table public.shops
  add column if not exists group_rules_schedule text not null default 'manual';

do $$ begin
  alter table public.shops
    drop constraint if exists shops_group_rules_schedule_check;
  alter table public.shops
    add constraint shops_group_rules_schedule_check
    check (group_rules_schedule in ('manual', 'daily', 'on_order', 'hourly'));
exception when others then null;
end $$;

update public.shops
set group_rules_schedule = 'daily'
where group_rules_auto_enabled = true
  and group_rules_schedule = 'manual';
alter table public.shops
  add column if not exists group_rules_allow_downgrade boolean not null default false;
alter table public.shops
  add column if not exists group_rules_grace_days integer not null default 90;
alter table public.shops
  add column if not exists group_rules_cooldown_days integer not null default 0;
alter table public.shops
  add column if not exists group_rules_downgrade_after_md text;
alter table public.shops
  add column if not exists group_rules_ladder integer[] not null default '{}';

-- idempotent alters for existing installs
alter table public.partner_group_rules
  add column if not exists period text not null default 'lifetime';
alter table public.partner_group_rules
  add column if not exists period_from date;
alter table public.partner_group_rules
  add column if not exists period_to date;
alter table public.partner_group_rules
  add column if not exists keep_threshold numeric(14, 2);

grant select, insert, update, delete on
  public.partner_group_rules
to b2b_app, b2b_admin;

alter table public.partner_group_rules enable row level security;
alter table public.partner_group_rules force row level security;

drop policy if exists partner_group_rules_tenant on public.partner_group_rules;
create policy partner_group_rules_tenant on public.partner_group_rules
  for all
  using (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  )
  with check (
    public.is_b2b_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.current_org_id()
    )
  );

insert into public.schema_migrations (filename)
values ('026_partner_group_rules.sql')
on conflict (filename) do nothing;
