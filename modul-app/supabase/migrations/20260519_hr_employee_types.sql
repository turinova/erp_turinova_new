-- Dolgozó típus törzsadat (hr_employee_types) + FK a hr_employees-re

-- ---------------------------------------------------------------------------
-- 1) Types table
-- ---------------------------------------------------------------------------
create table if not exists public.hr_employee_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  code text not null default '',
  sort_order integer not null default 100,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint hr_employee_types_name_len check (char_length(trim(name)) >= 1)
);

create index if not exists hr_employee_types_tenant_alive_idx
  on public.hr_employee_types (tenant_id)
  where deleted_at is null;

create unique index if not exists hr_employee_types_tenant_name_alive_uidx
  on public.hr_employee_types (tenant_id, lower(name))
  where deleted_at is null;

create unique index if not exists hr_employee_types_one_default_uidx
  on public.hr_employee_types (tenant_id)
  where deleted_at is null and is_default = true;

comment on table public.hr_employee_types is
  'Jelenlét: tenantonkénti dolgozó típus törzs.';

alter table public.hr_employee_types enable row level security;

drop policy if exists hr_employee_types_select on public.hr_employee_types;
create policy hr_employee_types_select
  on public.hr_employee_types for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists hr_employee_types_insert on public.hr_employee_types;
create policy hr_employee_types_insert
  on public.hr_employee_types for insert to authenticated
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_employee_types_update on public.hr_employee_types;
create policy hr_employee_types_update
  on public.hr_employee_types for update to authenticated
  using (public.can_write_tenant(tenant_id))
  with check (public.can_write_tenant(tenant_id));

drop policy if exists hr_employee_types_delete on public.hr_employee_types;
create policy hr_employee_types_delete
  on public.hr_employee_types for delete to authenticated
  using (public.can_write_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- 2) Seed defaults for every tenant
-- ---------------------------------------------------------------------------
insert into public.hr_employee_types (
  tenant_id, name, code, sort_order, active, is_default
)
select t.id, v.name, v.code, v.sort_order, true, v.is_default
from public.tenants t
cross join (
  values
    ('Bolt', 'bolt', 10, false),
    ('Műhely', 'muhely', 20, false),
    ('Iroda', 'iroda', 30, false),
    ('Lapszabász', 'lapszabasz', 40, false),
    ('Egyéb', 'egyeb', 100, true)
) as v(name, code, sort_order, is_default)
where not exists (
  select 1
  from public.hr_employee_types et
  where et.tenant_id = t.id
    and et.deleted_at is null
    and lower(et.name) = lower(v.name)
);

-- ---------------------------------------------------------------------------
-- 3) FK column on employees + backfill
-- ---------------------------------------------------------------------------
alter table public.hr_employees
  add column if not exists employee_type_id uuid
    references public.hr_employee_types (id);

-- Map legacy text codes → type rows
update public.hr_employees e
set employee_type_id = et.id
from public.hr_employee_types et
where et.tenant_id = e.tenant_id
  and et.deleted_at is null
  and et.code = e.employee_type
  and e.employee_type_id is null;

-- Fallback: default type for tenant
update public.hr_employees e
set employee_type_id = et.id
from public.hr_employee_types et
where et.tenant_id = e.tenant_id
  and et.deleted_at is null
  and et.is_default = true
  and e.employee_type_id is null;

-- Any remaining → first alive type
update public.hr_employees e
set employee_type_id = (
  select et.id
  from public.hr_employee_types et
  where et.tenant_id = e.tenant_id
    and et.deleted_at is null
  order by et.sort_order, et.name
  limit 1
)
where e.employee_type_id is null;

alter table public.hr_employees
  alter column employee_type_id set not null;

-- Drop legacy text column + check
alter table public.hr_employees
  drop constraint if exists hr_employees_type_check;

alter table public.hr_employees
  drop column if exists employee_type;

create index if not exists hr_employees_type_id_idx
  on public.hr_employees (employee_type_id);

-- ---------------------------------------------------------------------------
-- 4) Page feature for törzs UI
-- ---------------------------------------------------------------------------
insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  '/dolgozok/tipusok',
  'Dolgozó típusok',
  'Jelenlét',
  '/dolgozok/tipusok',
  42,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addon_features (addon_id, feature_key)
select a.id, '/dolgozok/tipusok'
from public.product_addons a
where a.key = 'jelenlet'
  and exists (
    select 1 from public.product_features f where f.key = '/dolgozok/tipusok'
  )
on conflict do nothing;

-- Entitlement for tenants that already have jelenlet addon
insert into public.tenant_entitlements (tenant_id, feature_key)
select ta.tenant_id, '/dolgozok/tipusok'
from public.tenant_addons ta
join public.product_addons a on a.id = ta.addon_id and a.key = 'jelenlet'
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/dolgozok/tipusok', true
from public.tenant_memberships m
join public.tenant_addons ta on ta.tenant_id = m.tenant_id
join public.product_addons a on a.id = ta.addon_id and a.key = 'jelenlet'
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 5) Seed helper for new tenants / addon enable
-- ---------------------------------------------------------------------------
create or replace function public.seed_hr_employee_types_for_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hr_employee_types (
    tenant_id, name, code, sort_order, active, is_default
  )
  select p_tenant_id, v.name, v.code, v.sort_order, true, v.is_default
  from (
    values
      ('Bolt', 'bolt', 10, false),
      ('Műhely', 'muhely', 20, false),
      ('Iroda', 'iroda', 30, false),
      ('Lapszabász', 'lapszabasz', 40, false),
      ('Egyéb', 'egyeb', 100, true)
  ) as v(name, code, sort_order, is_default)
  where not exists (
    select 1
    from public.hr_employee_types et
    where et.tenant_id = p_tenant_id
      and et.deleted_at is null
      and lower(et.name) = lower(v.name)
  );
end;
$$;
