-- =============================================================================
-- Építő Ártükör — Projektek + audit napló (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001–010 migrációk lefutottak
-- Tartalom:
--   - is_org_member / is_project_member helper (RLS-hez, security definer)
--   - projects (státusz: prospect → quoting → won → in_progress → done → archived)
--   - project_audit_log (INSERT-only — tagok nem módosíthatják/törölhetik)
-- Seed nincs: az éles adat a localStorage-bundle import-szkriptből jön.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RLS helper függvények (security definer — nem triggerel RLS-rekurziót,
-- és a mély gyerek-táblák policy-jei nem járnak 3-4 joinnal)
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_org_id
      and om.user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  -- Ügyfél törzs hivatkozás — törléskor a client_name snapshot marad
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null default '',
  site_address text not null default '',
  description text not null default '',
  status text not null default 'prospect'
    check (status in ('prospect', 'quoting', 'won', 'in_progress', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists projects_org_code_unique_active
  on public.projects (organization_id, lower(code))
  where deleted_at is null;

create index if not exists idx_projects_organization
  on public.projects (organization_id)
  where deleted_at is null;

create index if not exists idx_projects_status
  on public.projects (organization_id, status)
  where deleted_at is null;

create index if not exists idx_projects_client
  on public.projects (client_id)
  where deleted_at is null;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- A projects tábla után definiálható (a függvénytörzs létrehozáskor validálódik)
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = p_project_id
      and om.user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- project_audit_log — belső felhasználói műveletnapló („Ki" oszlop)
-- INSERT-only: nincs update/delete policy → tagok nem írhatják át a történetet
-- -----------------------------------------------------------------------------
create table if not exists public.project_audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text not null default '',
  actor_name text not null default '',
  kind text not null
    check (kind in ('project', 'quote', 'rfq', 'file', 'decision')),
  action text not null,
  context text,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_audit_log_project
  on public.project_audit_log (project_id, created_at desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_audit_log enable row level security;

drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member"
  on public.projects for select
  using (
    deleted_at is null
    and public.is_org_member(organization_id)
  );

drop policy if exists "projects_insert_member" on public.projects;
create policy "projects_insert_member"
  on public.projects for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "projects_update_member" on public.projects;
create policy "projects_update_member"
  on public.projects for update
  using (public.is_org_member(organization_id));

drop policy if exists "projects_delete_member" on public.projects;
create policy "projects_delete_member"
  on public.projects for delete
  using (public.is_org_member(organization_id));

drop policy if exists "project_audit_log_select_member" on public.project_audit_log;
create policy "project_audit_log_select_member"
  on public.project_audit_log for select
  using (public.is_project_member(project_id));

drop policy if exists "project_audit_log_insert_member" on public.project_audit_log;
create policy "project_audit_log_insert_member"
  on public.project_audit_log for insert
  with check (public.is_project_member(project_id));

-- (szándékosan nincs update/delete policy az audit naplón)
