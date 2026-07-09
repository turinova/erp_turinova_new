-- =============================================================================
-- Építő Ártükör — Költségvetések (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 011_projects.sql lefutott
-- Tartalom:
--   - quotes (draft → sent → accepted/rejected/archived; verziólánc supersedes-szel)
--   - quote_trade_markups (a tradeMarkups Record → sorok)
--   - quote_lines (cost_item_id NULL = szabad tétel; snapshot szövegekkel)
--   - guard: archivált quote sora nem módosítható (UPDATE-only — a CASCADE
--     törlés és az import-INSERT miatt szándékosan nem fut DELETE/INSERT-en)
-- Megjegyzés:
--   - cost_source_submission_id FK-t a 013 adja hozzá (rfq_submissions után)
--   - tig_document_id FK-t a 015 adja hozzá (performance_certificates után)
--   - egységárak: int (HUF), mint a cost_items-ben; mennyiség: numeric(14,3)
-- =============================================================================

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'archived')),
  version int not null default 1,
  notes text not null default '',
  quote_scope text not null default 'trade'
    check (quote_scope in ('trade', 'version')),
  -- Szakág — trade-scope-nál kötelező (app-guard; DB-ben nullable a version-scope miatt)
  primary_trade_id uuid references public.trades (id),
  -- Verziólánc: melyik ajánlatot váltja fel (lánc-szakadás nem hiba, csak történet-vesztés)
  supersedes_quote_id uuid references public.quotes (id) on delete set null,
  vat_mode text
    check (vat_mode is null or vat_mode in ('standard', 'reduced', 'aam', 'reverse_charge')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_project
  on public.quotes (project_id);

create index if not exists idx_quotes_project_status
  on public.quotes (project_id, status);

create index if not exists idx_quotes_supersedes
  on public.quotes (supersedes_quote_id)
  where supersedes_quote_id is not null;

drop trigger if exists quotes_updated_at on public.quotes;
create trigger quotes_updated_at
  before update on public.quotes
  for each row
  execute function public.set_updated_at();

-- RLS helper a quote-gyerek tábláknak
create or replace function public.is_quote_member(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quotes q
    join public.projects p on p.id = q.project_id
    join public.organization_members om on om.organization_id = p.organization_id
    where q.id = p_quote_id
      and om.user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- quote_trade_markups — szakági alap fedezet % (sor örökli, ha nincs sajátja)
-- -----------------------------------------------------------------------------
create table if not exists public.quote_trade_markups (
  quote_id uuid not null references public.quotes (id) on delete cascade,
  trade_id uuid not null references public.trades (id),
  markup_percent numeric(6,2) not null,
  primary key (quote_id, trade_id)
);

-- -----------------------------------------------------------------------------
-- quote_lines
-- -----------------------------------------------------------------------------
create table if not exists public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  sort_order int not null default 0,
  -- NULL = szabad (kézi) tétel; ártükör-tétel törlésekor a snapshot szöveg marad
  cost_item_id uuid references public.cost_items (id) on delete set null,
  identifier_snapshot text not null default '',
  text_snapshot text not null,
  trade_id uuid not null references public.trades (id),
  unit_id uuid not null references public.units (id),
  quantity numeric(14,3) not null default 1,
  -- Bekerülési oldal (HUF)
  cost_material_unit_price int not null default 0,
  cost_labor_unit_price int not null default 0,
  -- Soronkénti fedezet % felülírás (NULL = szakági alap öröklése)
  markup_percent numeric(6,2),
  cost_source text not null default 'unpriced'
    check (cost_source in ('unpriced', 'catalog', 'manual', 'subcontractor')),
  cost_source_subcontractor text,
  cost_source_submission_id uuid,   -- FK: 013_rfq.sql
  pricing_status text not null default 'unpriced'
    check (pricing_status in ('unpriced', 'estimated', 'rfq_pending', 'costed')),
  -- Kivitelezés — fizikai készültség (nem árazási státusz)
  execution_status text not null default 'pending'
    check (execution_status in ('pending', 'done')),
  -- Ha kitöltött: a tétel TIG-ben igazolt (egy tétel csak EGY TIG-ben lehet)
  tig_document_id uuid,             -- FK: 015_execution_tig.sql
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quote_lines_quote
  on public.quote_lines (quote_id, sort_order);

create index if not exists idx_quote_lines_tig
  on public.quote_lines (tig_document_id)
  where tig_document_id is not null;

drop trigger if exists quote_lines_updated_at on public.quote_lines;
create trigger quote_lines_updated_at
  before update on public.quote_lines
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- GUARD: archivált quote sora nem módosítható (DB-backstop a 0. fázis
-- app-guardja mögé). Csak UPDATE — a DELETE-et szándékosan nem blokkolja,
-- hogy a projekt/quote CASCADE törlés működjön; a közvetlen sortörlést
-- archivált quote-on az app tiltja.
-- Csak az üzleti mezők VÁLTOZÁSÁRA dob — az FK SET NULL cascade-ek
-- (cost_source_submission_id, tig_document_id, cost_item_id nullázás)
-- átmennek, különben a kapcsolt rekordok törlése elhasalna archivált sorokon.
-- -----------------------------------------------------------------------------
create or replace function public.guard_archived_quote_line()
returns trigger
language plpgsql
as $$
begin
  if (new.sort_order, new.identifier_snapshot, new.text_snapshot, new.trade_id,
      new.unit_id, new.quantity, new.cost_material_unit_price,
      new.cost_labor_unit_price, new.markup_percent, new.cost_source,
      new.cost_source_subcontractor, new.pricing_status)
     is distinct from
     (old.sort_order, old.identifier_snapshot, old.text_snapshot, old.trade_id,
      old.unit_id, old.quantity, old.cost_material_unit_price,
      old.cost_labor_unit_price, old.markup_percent, old.cost_source,
      old.cost_source_subcontractor, old.pricing_status)
  then
    if exists (
      select 1 from public.quotes q
      where q.id = old.quote_id
        and q.status = 'archived'
    ) then
      raise exception 'Archivált költségvetés tétele nem módosítható.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists quote_lines_guard_archived on public.quote_lines;
create trigger quote_lines_guard_archived
  before update on public.quote_lines
  for each row
  execute function public.guard_archived_quote_line();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.quotes enable row level security;
alter table public.quote_trade_markups enable row level security;
alter table public.quote_lines enable row level security;

drop policy if exists "quotes_select_member" on public.quotes;
create policy "quotes_select_member"
  on public.quotes for select
  using (public.is_project_member(project_id));

drop policy if exists "quotes_insert_member" on public.quotes;
create policy "quotes_insert_member"
  on public.quotes for insert
  with check (public.is_project_member(project_id));

drop policy if exists "quotes_update_member" on public.quotes;
create policy "quotes_update_member"
  on public.quotes for update
  using (public.is_project_member(project_id));

drop policy if exists "quotes_delete_member" on public.quotes;
create policy "quotes_delete_member"
  on public.quotes for delete
  using (public.is_project_member(project_id));

drop policy if exists "quote_trade_markups_all_member" on public.quote_trade_markups;
create policy "quote_trade_markups_all_member"
  on public.quote_trade_markups for all
  using (public.is_quote_member(quote_id))
  with check (public.is_quote_member(quote_id));

drop policy if exists "quote_lines_all_member" on public.quote_lines;
create policy "quote_lines_all_member"
  on public.quote_lines for all
  using (public.is_quote_member(quote_id))
  with check (public.is_quote_member(quote_id));
