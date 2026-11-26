-- Jelenlét: cégszintű számítási beállítások (1 sor / tenant).
-- grace_minutes: érkezés/távozás ennyi percen belül a műszak széléhez igazodik.

create table if not exists public.hr_attendance_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  grace_minutes smallint not null default 10
    check (grace_minutes >= 0 and grace_minutes <= 30),
  updated_at timestamptz not null default now()
);

comment on table public.hr_attendance_settings is
  'Jelenlét összesítő: cégszintű türelmi idő (műszakhoz igazítás).';

alter table public.hr_attendance_settings enable row level security;

drop policy if exists hr_attendance_settings_select_member on public.hr_attendance_settings;
create policy hr_attendance_settings_select_member
  on public.hr_attendance_settings
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists hr_attendance_settings_insert_member on public.hr_attendance_settings;
create policy hr_attendance_settings_insert_member
  on public.hr_attendance_settings
  for insert
  to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_attendance_settings_update_member on public.hr_attendance_settings;
create policy hr_attendance_settings_update_member
  on public.hr_attendance_settings
  for update
  to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_attendance_settings_platform_all on public.hr_attendance_settings;
create policy hr_attendance_settings_platform_all
  on public.hr_attendance_settings
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
