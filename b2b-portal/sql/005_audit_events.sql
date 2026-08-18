-- =============================================================================
-- b2b-portal / 005_audit_events.sql
-- MANUÁLISAN futtasd — előtte: 001–004
-- =============================================================================

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid
    references public.organizations (id) on delete set null,
  actor_user_id uuid
    references public.users (id) on delete set null,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_org_created
  on public.audit_events (organization_id, created_at desc);
create index if not exists idx_audit_events_actor
  on public.audit_events (actor_user_id, created_at desc);
create index if not exists idx_audit_events_action
  on public.audit_events (action, created_at desc);

insert into public.schema_migrations (filename)
values ('005_audit_events.sql')
on conflict (filename) do nothing;
