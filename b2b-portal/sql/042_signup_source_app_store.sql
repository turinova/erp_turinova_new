-- =============================================================================
-- b2b-portal / 042_signup_source_app_store.sql
-- Allow organizations.signup_source = 'app_store' (Shoprenter App Store install)
-- MANUÁLISAN futtasd prod DB-n
-- =============================================================================

alter table public.organizations
  drop constraint if exists organizations_signup_source_check;

alter table public.organizations
  add constraint organizations_signup_source_check
  check (
    signup_source is null
    or signup_source in ('admin', 'self_serve', 'app_store')
  );

comment on column public.organizations.signup_source is
  'admin = platform create; self_serve = /signup; app_store = Shoprenter App Store install';

insert into schema_migrations (filename) values ('042_signup_source_app_store.sql')
on conflict do nothing;
