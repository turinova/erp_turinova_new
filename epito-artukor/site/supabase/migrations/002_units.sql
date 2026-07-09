-- =============================================================================
-- Építő Ártükör — Mértékegységek (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001_auth_foundation.sql már lefutott
-- =============================================================================

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists units_org_code_unique_active
  on public.units (organization_id, lower(code))
  where deleted_at is null;

create unique index if not exists units_org_name_unique_active
  on public.units (organization_id, lower(name))
  where deleted_at is null;

create index if not exists idx_units_organization
  on public.units (organization_id)
  where deleted_at is null;

drop trigger if exists units_updated_at on public.units;
create trigger units_updated_at
  before update on public.units
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security (org tagok látják / kezelhetik a saját cég ME-it)
-- -----------------------------------------------------------------------------
alter table public.units enable row level security;

drop policy if exists "units_select_member" on public.units;
create policy "units_select_member"
  on public.units for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = units.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "units_insert_member" on public.units;
create policy "units_insert_member"
  on public.units for insert
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = units.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "units_update_member" on public.units;
create policy "units_update_member"
  on public.units for update
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = units.organization_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = units.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "units_delete_member" on public.units;
create policy "units_delete_member"
  on public.units for delete
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = units.organization_id
        and om.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Seed: demo cég alap ME-k (idempotens)
-- -----------------------------------------------------------------------------
insert into public.units (organization_id, code, name, sort_order)
select o.id, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    ('m2', 'négyzetméter', 1),
    ('m3', 'köbméter', 2),
    ('m', 'méter', 3),
    ('fm', 'folyóméter', 4),
    ('db', 'darab', 5),
    ('klt', 'komplett', 6),
    ('óra', 'óra', 7),
    ('kg', 'kilogramm', 8)
) as v(code, name, sort_order)
where o.slug = 'demo'
  and not exists (
    select 1
    from public.units u
    where u.organization_id = o.id
      and lower(u.code) = lower(v.code)
      and u.deleted_at is null
  );
