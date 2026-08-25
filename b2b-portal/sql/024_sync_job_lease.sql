-- =============================================================================
-- b2b-portal / 024_sync_job_lease.sql
-- Sync job lease — egy worker / job (progress ne ugráljon vissza).
-- MANUÁLISAN futtasd — előtte: 023
-- =============================================================================

alter table public.sync_jobs
  add column if not exists lease_owner text,
  add column if not exists lease_until timestamptz;

create index if not exists idx_sync_jobs_claimable
  on public.sync_jobs (created_at)
  where status in ('queued', 'running');

insert into public.schema_migrations (filename)
values ('024_sync_job_lease.sql')
on conflict (filename) do nothing;
