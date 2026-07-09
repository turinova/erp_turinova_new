-- =============================================================================
-- Építő Ártükör — Szakágak (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001_auth_foundation.sql már lefutott
-- code = stabil azonosító (nem szerkeszthető), name = megjelenő név
-- =============================================================================

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists trades_org_code_unique_active
  on public.trades (organization_id, lower(code))
  where deleted_at is null;

create index if not exists idx_trades_organization
  on public.trades (organization_id)
  where deleted_at is null;

drop trigger if exists trades_updated_at on public.trades;
create trigger trades_updated_at
  before update on public.trades
  for each row
  execute function public.set_updated_at();

alter table public.trades enable row level security;

drop policy if exists "trades_select_member" on public.trades;
create policy "trades_select_member"
  on public.trades for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = trades.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "trades_update_member" on public.trades;
create policy "trades_update_member"
  on public.trades for update
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = trades.organization_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = trades.organization_id
        and om.user_id = auth.uid()
    )
  );

-- 1. fázis: csak olvasás + név/sorrend módosítás (insert/delete később)
drop policy if exists "trades_insert_member" on public.trades;
create policy "trades_insert_member"
  on public.trades for insert
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = trades.organization_id
        and om.user_id = auth.uid()
    )
  );

-- Seed: demo cég alap szakágai (idempotens)
insert into public.trades (organization_id, code, name, sort_order)
select o.id, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    ('epitomester', 'Építőmester', 1),
    ('nyilaszaró', 'Nyílászáró', 2),
    ('gepeszet', 'Gépészet', 3),
    ('elektromos', 'Elektromos', 4),
    ('riaszto', 'Riasztó', 5)
) as v(code, name, sort_order)
where o.slug = 'demo'
  and not exists (
    select 1
    from public.trades t
    where t.organization_id = o.id
      and lower(t.code) = lower(v.code)
      and t.deleted_at is null
  );
