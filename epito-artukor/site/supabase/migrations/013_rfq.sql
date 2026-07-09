-- =============================================================================
-- Építő Ártükör — RFQ / alvállalkozói bekérés (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 012_quotes.sql lefutott
-- Tartalom:
--   - rfq_campaigns (több csomagot összekötő batch bekérés)
--   - rfqs (csomag; státusz: open → decided; quote-ra RESTRICT — a quote nem
--     törölhető, amíg bekérés hivatkozik rá → az app-szabály DB-szinten is él)
--   - rfq_lines (snapshot szöveg — quote-sor törlése után is olvasható)
--   - rfq_invitations (token + PIN; a PIN-t CSAK szerveroldali kód olvassa)
--   - rfq_submissions (1 beküldés / meghívás — újra-beküldés = UPDATE + revision_history)
--   - rfq_submission_bids (soronkénti anyag/díj árak)
--   - rfq_decision_logs (accept_package / change_package_winner)
--   - quote_lines.cost_source_submission_id FK pótlása
-- BIZTONSÁG:
--   A publikus /rfq/[token] végpont NEM anon RLS-en megy — a Next.js route
--   handler service-role klienssel fut, szerveroldali token+PIN validációval.
--   Ezért itt NINCS anon policy; access_code sosem kerülhet publikus GET-válaszba.
-- =============================================================================

create table if not exists public.rfq_campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  message text,
  expires_at timestamptz not null,
  -- Fájl-mappák snapshotja: [{folderId, name, fileCount}] — a fájl-modul későbbi hullám
  attached_folder_ids text[] not null default '{}',
  attached_folder_snapshots jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists idx_rfq_campaigns_project
  on public.rfq_campaigns (project_id);

create table if not exists public.rfqs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- RESTRICT: quote nem törölhető, ha van bekérése (deleteQuote app-szabály DB-ben)
  quote_id uuid not null references public.quotes (id) on delete restrict,
  trade_id uuid not null references public.trades (id),
  campaign_id uuid references public.rfq_campaigns (id) on delete set null,
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'decided')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rfqs_project
  on public.rfqs (project_id);

create index if not exists idx_rfqs_quote
  on public.rfqs (quote_id);

create index if not exists idx_rfqs_campaign
  on public.rfqs (campaign_id)
  where campaign_id is not null;

-- RLS helper az rfq-gyerek tábláknak
create or replace function public.is_rfq_member(p_rfq_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rfqs r
    join public.projects p on p.id = r.project_id
    join public.organization_members om on om.organization_id = p.organization_id
    where r.id = p_rfq_id
      and om.user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- rfq_lines
-- -----------------------------------------------------------------------------
create table if not exists public.rfq_lines (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  -- SET NULL: a quote-sor törlése után a bekérés-sor snapshot szövege megmarad
  quote_line_id uuid references public.quote_lines (id) on delete set null,
  text text not null,
  unit_id uuid not null references public.units (id),
  quantity numeric(14,3) not null,
  sort_order int not null default 0
);

create index if not exists idx_rfq_lines_rfq
  on public.rfq_lines (rfq_id, sort_order);

-- -----------------------------------------------------------------------------
-- rfq_invitations — alvállalkozónkénti link + PIN
-- -----------------------------------------------------------------------------
create table if not exists public.rfq_invitations (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  subcontractor_id uuid references public.subcontractors (id) on delete set null,
  subcontractor_name text not null,
  contact_phone text not null default '',
  access_token text not null unique,
  -- 6 jegyű PIN — plain text, DE csak service-role kód olvassa (rögzített döntés:
  -- a belső UI-nak látnia kell másoláshoz; publikus válaszból szerveroldalon szűrjük)
  access_code text not null,
  status text not null default 'invited'
    check (status in ('invited', 'submitted', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_rfq_invitations_rfq
  on public.rfq_invitations (rfq_id);

-- -----------------------------------------------------------------------------
-- rfq_submissions — 1 beküldés / meghívás (unique); újra-beküldés UPDATE
-- -----------------------------------------------------------------------------
create table if not exists public.rfq_submissions (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  invitation_id uuid not null unique references public.rfq_invitations (id) on delete cascade,
  subcontractor_id uuid references public.subcontractors (id) on delete set null,
  subcontractor_name text not null,
  contact_email text not null default '',
  contact_phone text not null default '',
  notes text not null default '',
  total_amount bigint not null default 0,
  -- Újraárazás előzmény: [{totalAmount, updatedAt, notes}]
  revision_history jsonb not null default '[]',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rfq_submissions_rfq
  on public.rfq_submissions (rfq_id);

drop trigger if exists rfq_submissions_updated_at on public.rfq_submissions;
create trigger rfq_submissions_updated_at
  before update on public.rfq_submissions
  for each row
  execute function public.set_updated_at();

create table if not exists public.rfq_submission_bids (
  submission_id uuid not null references public.rfq_submissions (id) on delete cascade,
  rfq_line_id uuid not null references public.rfq_lines (id) on delete cascade,
  material_unit_price int not null default 0,
  labor_unit_price int not null default 0,
  declined boolean not null default false,
  primary key (submission_id, rfq_line_id)
);

create index if not exists idx_rfq_submission_bids_line
  on public.rfq_submission_bids (rfq_line_id);

-- -----------------------------------------------------------------------------
-- rfq_decision_logs — döntésnapló (INSERT-only a tagoknak)
-- -----------------------------------------------------------------------------
create table if not exists public.rfq_decision_logs (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  invitation_id uuid references public.rfq_invitations (id) on delete set null,
  quote_line_id uuid references public.quote_lines (id) on delete set null,
  action text not null
    check (action in ('accept_package', 'change_package_winner')),
  subcontractor_name text not null,
  margin_percent_before numeric(6,2),
  margin_percent_after numeric(6,2),
  decided_by_user_id uuid references auth.users (id) on delete set null,
  decided_by_email text,
  decided_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rfq_decision_logs_rfq
  on public.rfq_decision_logs (rfq_id, created_at desc);

-- -----------------------------------------------------------------------------
-- quote_lines → rfq_submissions FK pótlása (012-ben még nem létezett a tábla)
-- SET NULL: a beküldés törlése nem nullázza az árat, csak a hivatkozást
-- -----------------------------------------------------------------------------
alter table public.quote_lines
  drop constraint if exists quote_lines_submission_fk;
alter table public.quote_lines
  add constraint quote_lines_submission_fk
  foreign key (cost_source_submission_id)
  references public.rfq_submissions (id)
  on delete set null;

-- -----------------------------------------------------------------------------
-- RLS — csak org-tag; publikus elérés kizárólag service-role API-n át
-- -----------------------------------------------------------------------------
alter table public.rfq_campaigns enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_lines enable row level security;
alter table public.rfq_invitations enable row level security;
alter table public.rfq_submissions enable row level security;
alter table public.rfq_submission_bids enable row level security;
alter table public.rfq_decision_logs enable row level security;

drop policy if exists "rfq_campaigns_all_member" on public.rfq_campaigns;
create policy "rfq_campaigns_all_member"
  on public.rfq_campaigns for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "rfqs_all_member" on public.rfqs;
create policy "rfqs_all_member"
  on public.rfqs for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "rfq_lines_all_member" on public.rfq_lines;
create policy "rfq_lines_all_member"
  on public.rfq_lines for all
  using (public.is_rfq_member(rfq_id))
  with check (public.is_rfq_member(rfq_id));

drop policy if exists "rfq_invitations_all_member" on public.rfq_invitations;
create policy "rfq_invitations_all_member"
  on public.rfq_invitations for all
  using (public.is_rfq_member(rfq_id))
  with check (public.is_rfq_member(rfq_id));

drop policy if exists "rfq_submissions_all_member" on public.rfq_submissions;
create policy "rfq_submissions_all_member"
  on public.rfq_submissions for all
  using (public.is_rfq_member(rfq_id))
  with check (public.is_rfq_member(rfq_id));

drop policy if exists "rfq_submission_bids_all_member" on public.rfq_submission_bids;
create policy "rfq_submission_bids_all_member"
  on public.rfq_submission_bids for all
  using (
    exists (
      select 1 from public.rfq_submissions s
      where s.id = rfq_submission_bids.submission_id
        and public.is_rfq_member(s.rfq_id)
    )
  )
  with check (
    exists (
      select 1 from public.rfq_submissions s
      where s.id = rfq_submission_bids.submission_id
        and public.is_rfq_member(s.rfq_id)
    )
  );

drop policy if exists "rfq_decision_logs_select_member" on public.rfq_decision_logs;
create policy "rfq_decision_logs_select_member"
  on public.rfq_decision_logs for select
  using (public.is_rfq_member(rfq_id));

drop policy if exists "rfq_decision_logs_insert_member" on public.rfq_decision_logs;
create policy "rfq_decision_logs_insert_member"
  on public.rfq_decision_logs for insert
  with check (public.is_rfq_member(rfq_id));

-- (szándékosan nincs update/delete policy a döntésnaplón)
