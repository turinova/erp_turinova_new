-- Jelenléti ív varázsló: dolgozói túlóra részletek + mentett ív sablonok (tenant-szintű).

-- ---------------------------------------------------------------------------
-- hr_employees: túlóra kerekítés + korai (műszak előtti) túlóra
-- ---------------------------------------------------------------------------
alter table public.hr_employees
  add column if not exists overtime_rounding_minutes integer not null default 15,
  add column if not exists overtime_rounding_mode text not null default 'floor',
  add column if not exists overtime_requires_complete_day boolean not null default true,
  add column if not exists early_overtime_enabled boolean not null default false,
  add column if not exists early_overtime_trigger_time time,
  add column if not exists early_overtime_pay_until_time time,
  add column if not exists early_overtime_max_minutes integer not null default 30,
  add column if not exists early_overtime_grace_minutes integer not null default 0,
  add column if not exists early_overtime_rounding_minutes integer not null default 15,
  add column if not exists early_overtime_rounding_mode text not null default 'floor',
  add column if not exists early_overtime_daily_cap_minutes integer not null default 120;

alter table public.hr_employees
  drop constraint if exists hr_employees_ot_rounding_check;
alter table public.hr_employees
  add constraint hr_employees_ot_rounding_check check (
    overtime_rounding_minutes between 1 and 120
    and overtime_rounding_mode in ('floor', 'nearest', 'ceil')
    and early_overtime_rounding_minutes between 1 and 120
    and early_overtime_rounding_mode in ('floor', 'nearest', 'ceil')
    and early_overtime_max_minutes between 0 and 480
    and early_overtime_grace_minutes between 0 and 240
    and early_overtime_daily_cap_minutes between 0 and 480
  );

comment on column public.hr_employees.early_overtime_trigger_time is
  'Korai túlóra csak akkor, ha az érkezés ennél korábbi (pl. 06:30).';
comment on column public.hr_employees.early_overtime_pay_until_time is
  'Korai túlóra szakasz vége; NULL = műszak kezdete.';

-- ---------------------------------------------------------------------------
-- hr_sheet_presets: jelenléti ív sablonok (szabály JSON)
-- ---------------------------------------------------------------------------
create table if not exists public.hr_sheet_presets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  base text not null default 'internal'
    check (base in ('official', 'internal')),
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_sheet_presets_name_len check (char_length(trim(name)) between 1 and 80)
);

create unique index if not exists hr_sheet_presets_tenant_name_uidx
  on public.hr_sheet_presets (tenant_id, lower(name));

comment on table public.hr_sheet_presets is
  'Jelenléti ív export sablonok (hivatalos / belső szabálykészlet), tenant-szintű.';

alter table public.hr_sheet_presets enable row level security;

drop policy if exists hr_sheet_presets_select on public.hr_sheet_presets;
create policy hr_sheet_presets_select
  on public.hr_sheet_presets for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists hr_sheet_presets_insert on public.hr_sheet_presets;
create policy hr_sheet_presets_insert
  on public.hr_sheet_presets for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_sheet_presets_update on public.hr_sheet_presets;
create policy hr_sheet_presets_update
  on public.hr_sheet_presets for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_sheet_presets_delete on public.hr_sheet_presets;
create policy hr_sheet_presets_delete
  on public.hr_sheet_presets for delete to authenticated
  using (public.can_write_tenant(tenant_id));
