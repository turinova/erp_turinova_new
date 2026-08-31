-- =============================================================================
-- b2b-portal / 035_marketing_profile.sql
-- Partner activation email profile (logo, signature) per shop.
-- MANUÁLISAN futtasd — előtte: 003 (shops).
-- =============================================================================

alter table public.shops
  add column if not exists marketing_profile jsonb not null default '{}'::jsonb;

comment on column public.shops.marketing_profile is
  'Merchant partner-activation kit: logoUrl, signature, launchEmailAcknowledgedAt.';

insert into public.schema_migrations (filename)
values ('035_marketing_profile.sql')
on conflict (filename) do nothing;
