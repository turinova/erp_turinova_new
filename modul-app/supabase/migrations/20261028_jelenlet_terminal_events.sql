-- Jelenlét terminál v2 (docs/53): nyers esemény napló + eszköz heartbeat.
-- A Pi dönti el a típust és küldi a valódi scan időt; a szerver ebből számolja a napi sort.

create table if not exists public.hr_attendance_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  device_id uuid references public.jelenlet_devices (id) on delete set null,
  client_event_id text not null,
  scan_time timestamptz not null,
  work_date date not null,
  scan_type text not null check (scan_type in ('arrival', 'departure')),
  scan_source text not null check (scan_source in ('rfid', 'pin')),
  card_id text,
  created_at timestamptz not null default now(),
  constraint hr_attendance_events_client_id_len check (char_length(client_event_id) between 1 and 200)
);

create unique index if not exists hr_attendance_events_tenant_client_uidx
  on public.hr_attendance_events (tenant_id, client_event_id);

create index if not exists hr_attendance_events_tenant_date_idx
  on public.hr_attendance_events (tenant_id, work_date, employee_id);

comment on table public.hr_attendance_events is
  'Terminál nyers scan napló (idempotens client_event_id). hr_attendance_days ebből számolódik.';

alter table public.hr_attendance_events enable row level security;

drop policy if exists hr_attendance_events_select_member on public.hr_attendance_events;
create policy hr_attendance_events_select_member
  on public.hr_attendance_events
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

alter table public.jelenlet_devices
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists app_version text,
  add column if not exists pending_count integer;

comment on column public.jelenlet_devices.last_heartbeat_at is
  'Pi heartbeat (percenként). Offline jelzés a platformon.';
