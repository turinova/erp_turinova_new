-- =============================================================================
-- b2b-portal / 036_platform_trial_default_14.sql
-- Align platform_settings default + row with TRIAL_DAYS_DEFAULT (14).
-- MANUÁLISAN futtasd — előtte: 018 (platform_settings).
-- =============================================================================

alter table public.platform_settings
  alter column trial_days set default 14;

update public.platform_settings
   set trial_days = 14,
       updated_at = now()
 where id = 1
   and trial_days = 30;

insert into public.schema_migrations (filename)
values ('036_platform_trial_default_14.sql')
on conflict (filename) do nothing;
