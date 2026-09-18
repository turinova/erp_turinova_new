-- Jelenlét add-on: dolgozók + manuális napi jelenlét + távollét (Raspberry nélkül)

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values
  (
    'jelenlet',
    'Jelenlét',
    'Add-on',
    null,
    550,
    true
  ),
  (
    '/jelenlet',
    'Jelenlét naptár',
    'Jelenlét',
    '/jelenlet',
    40,
    true
  ),
  (
    '/dolgozok',
    'Dolgozók',
    'Jelenlét',
    '/dolgozok',
    41,
    true
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addons (
  key, name, description, active, price_monthly_huf, currency
)
values (
  'jelenlet',
  'Jelenlét',
  'Dolgozók, manuális jelenléti ív, szabadság / betegszabadság — eszköz nélkül.',
  true,
  9900,
  'HUF'
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  price_monthly_huf = excluded.price_monthly_huf,
  currency = 'HUF',
  updated_at = now();

insert into public.product_addon_features (addon_id, feature_key)
select a.id, v.feature_key
from public.product_addons a
cross join (
  values
    ('jelenlet'),
    ('/jelenlet'),
    ('/dolgozok')
) as v(feature_key)
where a.key = 'jelenlet'
  and exists (select 1 from public.product_features f where f.key = v.feature_key)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  code text not null default '',
  employee_type text not null default 'egyeb',
  active boolean not null default true,
  shift_start time,
  shift_end time,
  lunch_start time,
  lunch_end time,
  works_on_saturday boolean not null default false,
  overtime_enabled boolean not null default false,
  overtime_grace_minutes integer not null default 15
    check (overtime_grace_minutes >= 0 and overtime_grace_minutes <= 240),
  overtime_daily_cap_minutes integer not null default 180
    check (overtime_daily_cap_minutes >= 0 and overtime_daily_cap_minutes <= 720),
  timezone text not null default 'Europe/Budapest',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_employees_name_len check (char_length(trim(name)) >= 1),
  constraint hr_employees_type_check check (
    employee_type in (
      'bolt',
      'muhely',
      'iroda',
      'lapszabasz',
      'egyeb'
    )
  )
);

create unique index if not exists hr_employees_tenant_code_uidx
  on public.hr_employees (tenant_id, lower(code))
  where code <> '';

create index if not exists hr_employees_tenant_active_idx
  on public.hr_employees (tenant_id, active, name);

create table if not exists public.hr_attendance_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  work_date date not null,
  arrival_time time,
  departure_time time,
  lunch_start time,
  lunch_end time,
  source text not null default 'manual'
    check (source in ('manual', 'import', 'terminal')),
  manually_edited boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index if not exists hr_attendance_days_tenant_date_idx
  on public.hr_attendance_days (tenant_id, work_date);

create index if not exists hr_attendance_days_employee_date_idx
  on public.hr_attendance_days (employee_id, work_date);

create table if not exists public.hr_absences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  absence_type text not null
    check (absence_type in ('vacation', 'sick', 'unpaid', 'other')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_absences_range check (end_date >= start_date)
);

create index if not exists hr_absences_tenant_emp_idx
  on public.hr_absences (tenant_id, employee_id, start_date);

create table if not exists public.hr_work_calendar (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  work_date date not null,
  day_type text not null
    check (day_type in ('national', 'company', 'relocated_work', 'relocated_rest')),
  name text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, work_date)
);

create index if not exists hr_work_calendar_tenant_date_idx
  on public.hr_work_calendar (tenant_id, work_date);

comment on table public.hr_employees is
  'Jelenlét add-on: dolgozó törzs + műszak szabály.';
comment on table public.hr_attendance_days is
  'Manuális napi jelenlét (érkezés/távozás).';
comment on table public.hr_absences is
  'Szabadság / betegszabadság intervallumok.';
comment on table public.hr_work_calendar is
  'Tenant ünnep / áthelyezett nap.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.hr_employees enable row level security;
alter table public.hr_attendance_days enable row level security;
alter table public.hr_absences enable row level security;
alter table public.hr_work_calendar enable row level security;

drop policy if exists hr_employees_select on public.hr_employees;
create policy hr_employees_select
  on public.hr_employees for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists hr_employees_insert on public.hr_employees;
create policy hr_employees_insert
  on public.hr_employees for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_employees_update on public.hr_employees;
create policy hr_employees_update
  on public.hr_employees for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_employees_delete on public.hr_employees;
create policy hr_employees_delete
  on public.hr_employees for delete to authenticated
  using (public.can_write_tenant(tenant_id));

drop policy if exists hr_attendance_select on public.hr_attendance_days;
create policy hr_attendance_select
  on public.hr_attendance_days for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists hr_attendance_insert on public.hr_attendance_days;
create policy hr_attendance_insert
  on public.hr_attendance_days for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_attendance_update on public.hr_attendance_days;
create policy hr_attendance_update
  on public.hr_attendance_days for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_attendance_delete on public.hr_attendance_days;
create policy hr_attendance_delete
  on public.hr_attendance_days for delete to authenticated
  using (public.can_write_tenant(tenant_id));

drop policy if exists hr_absences_select on public.hr_absences;
create policy hr_absences_select
  on public.hr_absences for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists hr_absences_insert on public.hr_absences;
create policy hr_absences_insert
  on public.hr_absences for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_absences_update on public.hr_absences;
create policy hr_absences_update
  on public.hr_absences for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_absences_delete on public.hr_absences;
create policy hr_absences_delete
  on public.hr_absences for delete to authenticated
  using (public.can_write_tenant(tenant_id));

drop policy if exists hr_calendar_select on public.hr_work_calendar;
create policy hr_calendar_select
  on public.hr_work_calendar for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists hr_calendar_insert on public.hr_work_calendar;
create policy hr_calendar_insert
  on public.hr_work_calendar for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_calendar_update on public.hr_work_calendar;
create policy hr_calendar_update
  on public.hr_work_calendar for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_calendar_delete on public.hr_work_calendar;
create policy hr_calendar_delete
  on public.hr_work_calendar for delete to authenticated
  using (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Seed HU nemzeti ünnepek új tenantokra (trigger) + meglévő tenantok 2026–27
-- ---------------------------------------------------------------------------
create or replace function public.seed_hr_hu_holidays_for_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hr_work_calendar (tenant_id, work_date, day_type, name)
  values
    (p_tenant_id, '2026-01-01', 'national', 'Újév'),
    (p_tenant_id, '2026-03-15', 'national', 'Nemzeti ünnep'),
    (p_tenant_id, '2026-04-06', 'national', 'Húsvét hétfő'),
    (p_tenant_id, '2026-05-01', 'national', 'A munka ünnepe'),
    (p_tenant_id, '2026-05-25', 'national', 'Pünkösd hétfő'),
    (p_tenant_id, '2026-08-20', 'national', 'Az államalapítás ünnepe'),
    (p_tenant_id, '2026-10-23', 'national', 'Nemzeti ünnep'),
    (p_tenant_id, '2026-11-01', 'national', 'Mindenszentek'),
    (p_tenant_id, '2026-12-25', 'national', 'Karácsony'),
    (p_tenant_id, '2026-12-26', 'national', 'Karácsony'),
    (p_tenant_id, '2027-01-01', 'national', 'Újév'),
    (p_tenant_id, '2027-03-15', 'national', 'Nemzeti ünnep'),
    (p_tenant_id, '2027-05-01', 'national', 'A munka ünnepe'),
    (p_tenant_id, '2027-08-20', 'national', 'Az államalapítás ünnepe'),
    (p_tenant_id, '2027-10-23', 'national', 'Nemzeti ünnep'),
    (p_tenant_id, '2027-11-01', 'national', 'Mindenszentek'),
    (p_tenant_id, '2027-12-25', 'national', 'Karácsony'),
    (p_tenant_id, '2027-12-26', 'national', 'Karácsony')
  on conflict (tenant_id, work_date) do nothing;
end;
$$;

insert into public.hr_work_calendar (tenant_id, work_date, day_type, name)
select t.id, d.work_date, d.day_type, d.name
from public.tenants t
cross join (
  values
    ('2026-01-01'::date, 'national', 'Újév'),
    ('2026-03-15'::date, 'national', 'Nemzeti ünnep'),
    ('2026-04-06'::date, 'national', 'Húsvét hétfő'),
    ('2026-05-01'::date, 'national', 'A munka ünnepe'),
    ('2026-05-25'::date, 'national', 'Pünkösd hétfő'),
    ('2026-08-20'::date, 'national', 'Az államalapítás ünnepe'),
    ('2026-10-23'::date, 'national', 'Nemzeti ünnep'),
    ('2026-11-01'::date, 'national', 'Mindenszentek'),
    ('2026-12-25'::date, 'national', 'Karácsony'),
    ('2026-12-26'::date, 'national', 'Karácsony'),
    ('2027-01-01'::date, 'national', 'Újév'),
    ('2027-03-15'::date, 'national', 'Nemzeti ünnep'),
    ('2027-05-01'::date, 'national', 'A munka ünnepe'),
    ('2027-08-20'::date, 'national', 'Az államalapítás ünnepe'),
    ('2027-10-23'::date, 'national', 'Nemzeti ünnep'),
    ('2027-11-01'::date, 'national', 'Mindenszentek'),
    ('2027-12-25'::date, 'national', 'Karácsony'),
    ('2027-12-26'::date, 'national', 'Karácsony')
) as d(work_date, day_type, name)
on conflict (tenant_id, work_date) do nothing;
