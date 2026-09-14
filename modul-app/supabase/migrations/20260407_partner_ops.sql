-- Partner ops Sprint 1: status (app-level disable) + impersonation tenant nullable
-- docs/21-platform-ops.md

alter table public.partner_profiles
  add column if not exists status text not null default 'active',
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text,
  add column if not exists disabled_by uuid references auth.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'partner_profiles_status_check'
  ) then
    alter table public.partner_profiles
      add constraint partner_profiles_status_check
      check (status in ('active', 'disabled'));
  end if;
end $$;

create index if not exists partner_profiles_status_idx
  on public.partner_profiles (status);

comment on column public.partner_profiles.status is
  'active = beléphet; disabled = app tiltás (Auth ban nélkül).';

-- Impersonation: partner esetén tenant_id lehet null
alter table public.platform_impersonation_sessions
  alter column tenant_id drop not null;

alter table public.platform_impersonation_sessions
  add column if not exists subject_kind text not null default 'staff';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_impersonation_subject_kind_check'
  ) then
    alter table public.platform_impersonation_sessions
      add constraint platform_impersonation_subject_kind_check
      check (subject_kind in ('staff', 'partner'));
  end if;
end $$;

-- Partner saját status-t ne írjon (csak service role / platform)
create or replace function public.partner_profiles_lock_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and not public.is_platform_admin()
     and (
       new.status is distinct from old.status
       or new.disabled_at is distinct from old.disabled_at
       or new.disabled_reason is distinct from old.disabled_reason
       or new.disabled_by is distinct from old.disabled_by
     ) then
    raise exception 'Partner status csak platform operátor módosíthatja.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists partner_profiles_lock_status_trg on public.partner_profiles;
create trigger partner_profiles_lock_status_trg
  before update on public.partner_profiles
  for each row
  execute function public.partner_profiles_lock_status();

-- subject_kind olvasható a cél user / operator bannerhez (column grant)
grant select (
  id,
  operator_user_id,
  target_user_id,
  tenant_id,
  subject_kind,
  reason,
  expires_at,
  ended_at,
  created_at
) on public.platform_impersonation_sessions to authenticated;
