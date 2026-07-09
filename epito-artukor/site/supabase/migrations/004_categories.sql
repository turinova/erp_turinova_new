-- =============================================================================
-- Építő Ártükör — Kategóriák (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001_auth_foundation.sql már lefutott
-- =============================================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete set null,
  trade text not null
    check (trade in ('epitomester', 'nyilaszaró', 'gepeszet', 'elektromos', 'riaszto')),
  code text not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists categories_org_code_unique_active
  on public.categories (organization_id, lower(code))
  where deleted_at is null;

create index if not exists idx_categories_organization
  on public.categories (organization_id)
  where deleted_at is null;

create index if not exists idx_categories_parent
  on public.categories (parent_id)
  where deleted_at is null;

create index if not exists idx_categories_trade
  on public.categories (organization_id, trade)
  where deleted_at is null;

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.categories enable row level security;

drop policy if exists "categories_select_member" on public.categories;
create policy "categories_select_member"
  on public.categories for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = categories.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "categories_insert_member" on public.categories;
create policy "categories_insert_member"
  on public.categories for insert
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = categories.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "categories_update_member" on public.categories;
create policy "categories_update_member"
  on public.categories for update
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = categories.organization_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = categories.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "categories_delete_member" on public.categories;
create policy "categories_delete_member"
  on public.categories for delete
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = categories.organization_id
        and om.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Seed: demo cég kategóriái (idempotens, kód alapján)
-- -----------------------------------------------------------------------------

-- Gyökér kategóriák
insert into public.categories (organization_id, parent_id, trade, code, name, sort_order)
select o.id, null, v.trade, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    ('epitomester', 'EP', 'Építőmesteri munkák', 1),
    ('nyilaszaró', 'NY', 'Nyílászáró szerkezetek', 1),
    ('gepeszet', 'GE', 'Gépészet', 1),
    ('elektromos', 'EL', 'Elektromos munkák', 1),
    ('riaszto', 'RI', 'Riasztó rendszer', 1)
) as v(trade, code, name, sort_order)
where o.slug = 'demo'
  and not exists (
    select 1
    from public.categories c
    where c.organization_id = o.id
      and lower(c.code) = lower(v.code)
      and c.deleted_at is null
  );

-- Alfajták — építőmester
insert into public.categories (organization_id, parent_id, trade, code, name, sort_order)
select o.id, p.id, v.trade, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    ('epitomester', 'EP', 'EP-BON', 'Bontás', 1),
    ('epitomester', 'EP', 'BURK', 'Burkolatvédelem / javítás', 2),
    ('epitomester', 'EP', 'EP-SZL', 'Elszállítás', 3)
) as v(trade, parent_code, code, name, sort_order)
join public.categories p
  on p.organization_id = o.id
  and lower(p.code) = lower(v.parent_code)
  and p.deleted_at is null
where o.slug = 'demo'
  and not exists (
    select 1
    from public.categories c
    where c.organization_id = o.id
      and lower(c.code) = lower(v.code)
      and c.deleted_at is null
  );

-- Alfajták — nyílászáró
insert into public.categories (organization_id, parent_id, trade, code, name, sort_order)
select o.id, p.id, v.trade, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    ('nyilaszaró', 'NY', 'NY-ALU', 'Alumínium szerkezetek', 1),
    ('nyilaszaró', 'NY', 'NY-AUT', 'Automata ajtók', 2)
) as v(trade, parent_code, code, name, sort_order)
join public.categories p
  on p.organization_id = o.id
  and lower(p.code) = lower(v.parent_code)
  and p.deleted_at is null
where o.slug = 'demo'
  and not exists (
    select 1
    from public.categories c
    where c.organization_id = o.id
      and lower(c.code) = lower(v.code)
      and c.deleted_at is null
  );

-- Alfajták — gépészet
insert into public.categories (organization_id, parent_id, trade, code, name, sort_order)
select o.id, p.id, v.trade, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    ('gepeszet', 'GE', 'GE-KL', 'Klímás fűtés-hűtés', 1),
    ('gepeszet', 'GE', 'GE-CS', 'Csővezetékek', 2),
    ('gepeszet', 'GE', 'GE-BER', 'Berendezések', 3)
) as v(trade, parent_code, code, name, sort_order)
join public.categories p
  on p.organization_id = o.id
  and lower(p.code) = lower(v.parent_code)
  and p.deleted_at is null
where o.slug = 'demo'
  and not exists (
    select 1
    from public.categories c
    where c.organization_id = o.id
      and lower(c.code) = lower(v.code)
      and c.deleted_at is null
  );

-- Alfajták — elektromos
insert into public.categories (organization_id, parent_id, trade, code, name, sort_order)
select o.id, p.id, v.trade, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    ('elektromos', 'EL', 'EL-BON', 'Bontás', 1),
    ('elektromos', 'EL', 'EL-SZ', 'Szerelvények', 2),
    ('elektromos', 'EL', 'EL-MER', 'Mérések', 3)
) as v(trade, parent_code, code, name, sort_order)
join public.categories p
  on p.organization_id = o.id
  and lower(p.code) = lower(v.parent_code)
  and p.deleted_at is null
where o.slug = 'demo'
  and not exists (
    select 1
    from public.categories c
    where c.organization_id = o.id
      and lower(c.code) = lower(v.code)
      and c.deleted_at is null
  );
