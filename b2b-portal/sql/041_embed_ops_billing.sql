-- =============================================================================
-- b2b-portal / 041_embed_ops_billing.sql
-- MANUÁLISAN futtasd (önálló: létrehozza a platform_settings-t, ha hiányzik)
-- Előtte ajánlott: 001, organizations/shops (és 040 a script oszlopokhoz)
-- Embed kampány SoT + App Store recurring charge mezők
-- =============================================================================

-- 018 tartalma, ha még nem futott
create table if not exists public.platform_settings (
  id integer primary key default 1 check (id = 1),
  trial_days integer not null default 14
    check (trial_days >= 1 and trial_days <= 90),
  sync_concurrency integer not null default 10
    check (sync_concurrency >= 1 and sync_concurrency <= 50),
  portal_top_n_gate boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.platform_settings
  add column if not exists embed_monthly_list_net integer;

alter table public.platform_settings
  add column if not exists embed_campaign_pct integer;

update public.platform_settings
set
  embed_monthly_list_net = coalesce(embed_monthly_list_net, 9999),
  embed_campaign_pct = coalesce(embed_campaign_pct, 27)
where id = 1;

alter table public.platform_settings
  alter column embed_monthly_list_net set default 9999,
  alter column embed_campaign_pct set default 27;

alter table public.platform_settings
  alter column embed_monthly_list_net set not null,
  alter column embed_campaign_pct set not null;

alter table public.platform_settings
  drop constraint if exists platform_settings_embed_monthly_list_net_check;

alter table public.platform_settings
  add constraint platform_settings_embed_monthly_list_net_check
  check (embed_monthly_list_net >= 0);

alter table public.platform_settings
  drop constraint if exists platform_settings_embed_campaign_pct_check;

alter table public.platform_settings
  add constraint platform_settings_embed_campaign_pct_check
  check (embed_campaign_pct >= 0 and embed_campaign_pct <= 90);

alter table public.organizations
  add column if not exists sr_recurring_charge_id text,
  add column if not exists sr_billing_status text,
  add column if not exists sr_billing_interval text,
  add column if not exists sr_billing_updated_at timestamptz;

alter table public.organizations
  drop constraint if exists organizations_sr_billing_status_check;

alter table public.organizations
  add constraint organizations_sr_billing_status_check
  check (
    sr_billing_status is null
    or sr_billing_status in (
      'pending',
      'active',
      'frozen',
      'canceled',
      'declined',
      'mailto'
    )
  );

alter table public.organizations
  drop constraint if exists organizations_sr_billing_interval_check;

alter table public.organizations
  add constraint organizations_sr_billing_interval_check
  check (
    sr_billing_interval is null
    or sr_billing_interval in ('monthly', 'annual')
  );

insert into public.schema_migrations (filename)
values ('018_platform_settings.sql')
on conflict (filename) do nothing;

insert into public.schema_migrations (filename)
values ('041_embed_ops_billing.sql')
on conflict (filename) do nothing;
