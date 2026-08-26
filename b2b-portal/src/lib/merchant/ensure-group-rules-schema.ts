/**
 * Creates / upgrades partner_group_rules schema on first use.
 * User asked not to run SQL manually — safe IF NOT EXISTS DDL via admin context.
 */

import type { PoolClient } from "pg";
import { withPlatformAdmin } from "@/lib/db";

/** Bump when adding columns so running servers re-apply DDL. */
const SCHEMA_VERSION = 5;

declare global {
  // eslint-disable-next-line no-var
  var __b2bGroupRulesSchemaVersion: number | undefined;
}

async function runDdl(client: PoolClient): Promise<void> {
  await client.query(`
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
      from_group_inner_ids integer[] not null default '{}',
      to_group_inner_id integer not null,
      to_group_outer_id text,
      to_group_name text,
      priority integer not null default 100,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create index if not exists idx_partner_group_rules_shop
      on public.partner_group_rules (shop_id, enabled, priority)
  `);

  await client.query(`
    do $$ begin
      if not exists (
        select 1 from pg_trigger
        where tgname = 'trg_partner_group_rules_updated_at'
      ) then
        create trigger trg_partner_group_rules_updated_at
          before update on public.partner_group_rules
          for each row execute function public.set_updated_at();
      end if;
    end $$
  `);

  await client.query(`
    alter table public.shop_customer_group_moves
      add column if not exists source text not null default 'manual'
  `);
  await client.query(`
    alter table public.shop_customer_group_moves
      add column if not exists rule_id uuid
  `);
  await client.query(`
    alter table public.shop_customer_group_moves
      add column if not exists reason text
  `);
  await client.query(`
    alter table public.shop_customers
      add column if not exists skip_auto_group_move boolean not null default false
  `);
  await client.query(`
    alter table public.shop_customers
      add column if not exists group_rules_qualified_at timestamptz
  `);

  /* Move audit snapshots (metric at time of move) */
  await client.query(`
    alter table public.shop_customer_group_moves
      add column if not exists metric text
  `);
  await client.query(`
    alter table public.shop_customer_group_moves
      add column if not exists metric_value numeric(14, 2)
  `);
  await client.query(`
    alter table public.shop_customer_group_moves
      add column if not exists threshold numeric(14, 2)
  `);
  await client.query(`
    alter table public.shop_customer_group_moves
      add column if not exists period text
  `);
  await client.query(`
    alter table public.shop_customer_group_moves
      add column if not exists direction text
  `);

  await client.query(`
    alter table public.shops
      add column if not exists group_rules_auto_enabled boolean not null default false
  `);
  await client.query(`
    alter table public.shops
      add column if not exists group_rules_auto_last_run_at timestamptz
  `);
  await client.query(`
    alter table public.shops
      add column if not exists group_rules_schedule text not null default 'manual'
  `);
  await client.query(`
    do $$ begin
      alter table public.shops
        drop constraint if exists shops_group_rules_schedule_check;
      alter table public.shops
        add constraint shops_group_rules_schedule_check
        check (group_rules_schedule in ('manual', 'daily', 'on_order', 'hourly'));
    exception when others then null;
    end $$
  `);
  /* Migrate old boolean flag → schedule once */
  await client.query(`
    update public.shops
    set group_rules_schedule = 'daily'
    where group_rules_auto_enabled = true
      and group_rules_schedule = 'manual'
  `);
  await client.query(`
    alter table public.shops
      add column if not exists group_rules_allow_downgrade boolean not null default false
  `);
  await client.query(`
    alter table public.shops
      add column if not exists group_rules_grace_days integer not null default 90
  `);
  await client.query(`
    alter table public.shops
      add column if not exists group_rules_cooldown_days integer not null default 0
  `);
  await client.query(`
    alter table public.shops
      add column if not exists group_rules_downgrade_after_md text
  `);
  await client.query(`
    alter table public.shops
      add column if not exists group_rules_ladder integer[] not null default '{}'
  `);

  /* Rule: time window + keep threshold */
  await client.query(`
    alter table public.partner_group_rules
      add column if not exists period text not null default 'lifetime'
  `);
  await client.query(`
    alter table public.partner_group_rules
      add column if not exists period_from date
  `);
  await client.query(`
    alter table public.partner_group_rules
      add column if not exists period_to date
  `);
  await client.query(`
    alter table public.partner_group_rules
      add column if not exists keep_threshold numeric(14, 2)
  `);

  await client.query(`
    do $$ begin
      alter table public.partner_group_rules
        drop constraint if exists partner_group_rules_period_check;
      alter table public.partner_group_rules
        add constraint partner_group_rules_period_check
        check (period in ('lifetime', 'rolling_12m', 'calendar_year', 'custom'));
    exception when others then null;
    end $$
  `);

  await client.query(`
    grant select, insert, update, delete on
      public.partner_group_rules
    to b2b_app, b2b_admin
  `).catch(() => {
    /* roles may differ in local */
  });

  await client.query(`
    alter table public.partner_group_rules enable row level security
  `);
  await client.query(`
    alter table public.partner_group_rules force row level security
  `);

  await client.query(`
    drop policy if exists partner_group_rules_tenant on public.partner_group_rules
  `);
  await client.query(`
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
      )
  `);

  await client.query(`
    insert into public.schema_migrations (filename)
    values ('026_partner_group_rules.sql')
    on conflict (filename) do nothing
  `).catch(() => {
    /* optional */
  });
}

export async function ensurePartnerGroupRulesSchema(): Promise<void> {
  if (global.__b2bGroupRulesSchemaVersion === SCHEMA_VERSION) return;
  await withPlatformAdmin(async (client) => {
    await runDdl(client);
  });
  global.__b2bGroupRulesSchemaVersion = SCHEMA_VERSION;
}
