-- =============================================================================
-- Építő Ártükör — Ügyfélcsomagok + projekt-összeállítás (manuálisan futtasd)
-- =============================================================================
-- Előfeltétel: 012_quotes.sql lefutott
-- Tartalom:
--   - customer_packages (draft → sent → accepted/rejected/superseded)
--     - a snapshots JSONB a SZERZŐDÉS: szándékosan nincs FK a quote-okra,
--       az élő quote módosítása/törlése sosem bántja a befagyott állapotot
--     - DB-invariáns: projektenként legfeljebb EGY 'sent' csomag (partial unique)
--   - project_composition_selections (szakágankénti kiválasztott quote)
-- BIZTONSÁG:
--   A publikus /ajanlat/[token] végpont service-role klienssel fut,
--   szerveroldali token+PIN validációval — itt NINCS anon policy,
--   és az access_code nem kerülhet a publikus GET-válaszba.
-- FONTOS (API-implementációhoz):
--   Új csomag küldésekor ELŐBB kell a régi 'sent' csomagot 'superseded'-re
--   állítani, és csak UTÁNA a újat 'sent'-re — különben a partial unique
--   index megfogja a tranzakciót (az index statementenként érvényesül).
-- =============================================================================

create table if not exists public.customer_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  type text not null default 'full'
    check (type in ('full', 'supplement')),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'superseded')),
  title text not null,
  -- Befagyott szakági pillanatképek: [{trade, quoteId, quoteTitle, sellNetTotal,
  --  grossTotal, vatMode?, vatLabel?, lineIds?, lines?: [{lineId, identifier, text,
  --  unitLabel, quantity, sellNetUnitPrice, sellNetTotal}]}]
  snapshots jsonb not null default '[]',
  sell_net_total bigint not null default 0,
  gross_total bigint not null default 0,
  -- Részleges elfogadás: az elfogadott snapshotok + összegeik (0. fázis javítás)
  accepted_snapshots jsonb,
  accepted_sell_net_total bigint,
  accepted_gross_total bigint,
  notes text,
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  client_notes text,
  responded_by_name text,
  -- Publikus ajánlat-link (draft csomagnál még NULL)
  access_token text unique,
  access_code text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_packages_project
  on public.customer_packages (project_id, sent_at desc);

-- DB-invariáns: projektenként legfeljebb egy aktív 'sent' csomag
create unique index if not exists customer_packages_one_sent_per_project
  on public.customer_packages (project_id)
  where status = 'sent';

drop trigger if exists customer_packages_updated_at on public.customer_packages;
create trigger customer_packages_updated_at
  before update on public.customer_packages
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- project_composition_selections — élő projekt terv (mely quote-ok számítanak)
-- -----------------------------------------------------------------------------
create table if not exists public.project_composition_selections (
  project_id uuid not null references public.projects (id) on delete cascade,
  trade_id uuid not null references public.trades (id),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  -- Későbbi tételszintű szűréshez (adatmodellben támogatott, UI még nem használja)
  line_ids uuid[],
  updated_at timestamptz not null default now(),
  primary key (project_id, trade_id)
);

create index if not exists idx_composition_selections_quote
  on public.project_composition_selections (quote_id);

drop trigger if exists project_composition_selections_updated_at
  on public.project_composition_selections;
create trigger project_composition_selections_updated_at
  before update on public.project_composition_selections
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — csak org-tag; publikus elérés kizárólag service-role API-n át
-- -----------------------------------------------------------------------------
alter table public.customer_packages enable row level security;
alter table public.project_composition_selections enable row level security;

drop policy if exists "customer_packages_all_member" on public.customer_packages;
create policy "customer_packages_all_member"
  on public.customer_packages for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "composition_selections_all_member" on public.project_composition_selections;
create policy "composition_selections_all_member"
  on public.project_composition_selections for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
