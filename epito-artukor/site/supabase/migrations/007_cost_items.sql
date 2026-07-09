-- =============================================================================
-- Építő Ártükör — Tételek (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001–006 migrációk lefutottak (organizations, units, categories, trades)
-- FK: trade_id → trades, category_id → categories, unit_id → units
-- =============================================================================

create table if not exists public.cost_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  trade_id uuid not null references public.trades (id),
  category_id uuid not null references public.categories (id),
  unit_id uuid not null references public.units (id),
  identifier text not null,
  is_custom_item boolean not null default false,
  text text not null,
  short_label text,
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  tags text[] not null default '{}',
  material_unit_price int not null default 0,
  labor_unit_price int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists cost_items_org_identifier_unique_active
  on public.cost_items (organization_id, lower(identifier))
  where deleted_at is null;

create index if not exists idx_cost_items_organization
  on public.cost_items (organization_id)
  where deleted_at is null;

create index if not exists idx_cost_items_trade
  on public.cost_items (trade_id)
  where deleted_at is null;

create index if not exists idx_cost_items_category
  on public.cost_items (category_id)
  where deleted_at is null;

create index if not exists idx_cost_items_unit
  on public.cost_items (unit_id)
  where deleted_at is null;

create index if not exists idx_cost_items_status
  on public.cost_items (organization_id, status)
  where deleted_at is null;

drop trigger if exists cost_items_updated_at on public.cost_items;
create trigger cost_items_updated_at
  before update on public.cost_items
  for each row
  execute function public.set_updated_at();

alter table public.cost_items enable row level security;

drop policy if exists "cost_items_select_member" on public.cost_items;
create policy "cost_items_select_member"
  on public.cost_items for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = cost_items.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "cost_items_insert_member" on public.cost_items;
create policy "cost_items_insert_member"
  on public.cost_items for insert
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = cost_items.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "cost_items_update_member" on public.cost_items;
create policy "cost_items_update_member"
  on public.cost_items for update
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = cost_items.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "cost_items_delete_member" on public.cost_items;
create policy "cost_items_delete_member"
  on public.cost_items for delete
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = cost_items.organization_id
        and om.user_id = auth.uid()
    )
  );

-- Opcionális: ellenőrzi, hogy a kategória szakága egyezik a trade_id-vel
create or replace function public.validate_cost_item_references()
returns trigger
language plpgsql
as $$
declare
  trade_code text;
  category_trade text;
begin
  select t.code into trade_code
  from public.trades t
  where t.id = new.trade_id
    and t.organization_id = new.organization_id
    and t.deleted_at is null;

  if trade_code is null then
    raise exception 'Érvénytelen szakág (trade_id).';
  end if;

  select c.trade into category_trade
  from public.categories c
  where c.id = new.category_id
    and c.organization_id = new.organization_id
    and c.deleted_at is null;

  if category_trade is null then
    raise exception 'Érvénytelen kategória (category_id).';
  end if;

  if category_trade <> trade_code then
    raise exception 'A kategória szakága (%) nem egyezik a tétel szakágával (%).', category_trade, trade_code;
  end if;

  if not exists (
    select 1 from public.units u
    where u.id = new.unit_id
      and u.organization_id = new.organization_id
      and u.deleted_at is null
  ) then
    raise exception 'Érvénytelen mértékegység (unit_id).';
  end if;

  return new;
end;
$$;

drop trigger if exists cost_items_validate_refs on public.cost_items;
create trigger cost_items_validate_refs
  before insert or update on public.cost_items
  for each row
  execute function public.validate_cost_item_references();
