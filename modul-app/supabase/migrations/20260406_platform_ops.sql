-- modul-app: platform ops P0 — billing mezők, notes, audit, impersonation
-- docs/21-platform-ops.md

-- ---------------------------------------------------------------------------
-- Tenants: manuális billing + operátor notes
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists billing_status text not null default 'none',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists paid_through timestamptz,
  add column if not exists billing_notes text,
  add column if not exists internal_notes text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_billing_status_check'
  ) then
    alter table public.tenants
      add constraint tenants_billing_status_check
      check (billing_status in ('none', 'trial', 'active', 'past_due', 'canceled'));
  end if;
end $$;

create index if not exists tenants_billing_status_idx
  on public.tenants (billing_status);

create index if not exists tenants_trial_ends_at_idx
  on public.tenants (trial_ends_at)
  where trial_ends_at is not null;

create index if not exists tenants_paid_through_idx
  on public.tenants (paid_through)
  where paid_through is not null;

-- ---------------------------------------------------------------------------
-- platform_audit_log (általános ops audit)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_log_tenant_idx
  on public.platform_audit_log (tenant_id, created_at desc);

create index if not exists platform_audit_log_created_idx
  on public.platform_audit_log (created_at desc);

alter table public.platform_audit_log enable row level security;

drop policy if exists platform_audit_select_platform on public.platform_audit_log;
create policy platform_audit_select_platform
  on public.platform_audit_log
  for select
  to authenticated
  using (public.is_platform_admin());

comment on table public.platform_audit_log is
  'Platform operátor műveletek (impersonation, státusz, billing, jelszó, …).';

-- ---------------------------------------------------------------------------
-- platform_impersonation_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.platform_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  operator_user_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  reason text,
  handoff_token text,
  magic_hash text,
  operator_refresh_token text,
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists platform_impersonation_active_idx
  on public.platform_impersonation_sessions (target_user_id, expires_at)
  where ended_at is null;

alter table public.platform_impersonation_sessions enable row level security;

-- Cél user / operator olvasha non-secret oszlopokat (session banner)
revoke all on table public.platform_impersonation_sessions from authenticated;
grant select (
  id,
  operator_user_id,
  target_user_id,
  tenant_id,
  reason,
  expires_at,
  ended_at,
  created_at
) on public.platform_impersonation_sessions to authenticated;

drop policy if exists platform_impersonation_select_participants
  on public.platform_impersonation_sessions;
create policy platform_impersonation_select_participants
  on public.platform_impersonation_sessions
  for select
  to authenticated
  using (
    auth.uid() = target_user_id
    or auth.uid() = operator_user_id
    or public.is_platform_admin()
  );

comment on table public.platform_impersonation_sessions is
  'Support impersonation session — TTL + audit; secret mezők csak service role.';
