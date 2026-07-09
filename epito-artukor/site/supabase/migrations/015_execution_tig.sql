-- =============================================================================
-- Építő Ártükör — Kivitelezés + TIG (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 014_customer_packages.sql lefutott
-- Tartalom:
--   - performance_certificates (TIG — immutábilis dokumentum; a lines JSONB
--     a befagyott igazolt sorok, eladási árakkal a szerződés-snapshotból)
--   - quote_lines.tig_document_id FK pótlása
--   - guard: TIG-ben rögzített tétel védelme
--     - execution_status nem állítható vissza (bulk „Visszaállítás" backstop)
--     - tig_document_id nem írható át MÁSIK cert-re (NULL-ra állítás engedett —
--       jövőbeli TIG-storno útvonal: a cert törlése SET NULL-lal felszabadít)
--     - TIG-es sor nem törölhető közvetlenül
--     - a bekerülési árak SZÁNDÉKOSAN nem zároltak: elfogadott quote élő
--       tényköltség-követése engedélyezett, a TIG eladási árat snapshotból visz
--   - unique (project_id, document_number) — sorszám-verseny két gép közt
-- Tagoknak nincs update/delete policy → a TIG DB-szinten is immutábilis
-- (a későbbi storno funkció service-role-lal vagy új policy-vel jön).
-- =============================================================================

create table if not exists public.performance_certificates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Pl. TIG-IRO-2026-03-2026-001 — az év az issued_at-ból képződik (0. fázis)
  document_number text not null,
  issued_at date not null,
  -- Szerződéses hivatkozás az elfogadott csomagra
  contract_package_id uuid references public.customer_packages (id) on delete set null,
  contract_package_title text,
  period_from date,
  period_to date not null,
  performance_location text not null default '',
  -- Befagyott igazolt sorok: [{lineId, quoteId, quoteTitle, trade, identifier,
  --  text, unitLabel, quantity, sellNetUnitPrice, sellNetTotal}]
  lines jsonb not null default '[]',
  sell_net_total bigint not null default 0,
  gross_total bigint not null default 0,
  vat_mode text not null
    check (vat_mode in ('standard', 'reduced', 'aam', 'reverse_charge')),
  vat_label text not null,
  vat_amount bigint not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists performance_certificates_docnum_unique
  on public.performance_certificates (project_id, document_number);

create index if not exists idx_performance_certificates_project
  on public.performance_certificates (project_id, issued_at desc);

create index if not exists idx_performance_certificates_package
  on public.performance_certificates (contract_package_id)
  where contract_package_id is not null;

-- -----------------------------------------------------------------------------
-- quote_lines → performance_certificates FK pótlása
-- SET NULL: cert törlésekor (jövőbeli storno) a sorok automatikusan felszabadulnak
-- -----------------------------------------------------------------------------
alter table public.quote_lines
  drop constraint if exists quote_lines_tig_fk;
alter table public.quote_lines
  add constraint quote_lines_tig_fk
  foreign key (tig_document_id)
  references public.performance_certificates (id)
  on delete set null;

-- -----------------------------------------------------------------------------
-- GUARD: TIG-ben rögzített tétel védelme
-- -----------------------------------------------------------------------------
create or replace function public.guard_tig_locked_quote_line()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.tig_document_id is not null then
      raise exception 'TIG-ben rögzített tétel nem törölhető.';
    end if;
    return old;
  end if;

  if old.tig_document_id is not null then
    if new.execution_status is distinct from old.execution_status then
      raise exception 'TIG-ben rögzített tétel készültsége nem módosítható.';
    end if;
    if new.tig_document_id is not null
       and new.tig_document_id <> old.tig_document_id then
      raise exception 'A tétel már másik teljesítésigazolásban szerepel.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists quote_lines_guard_tig on public.quote_lines;
create trigger quote_lines_guard_tig
  before update or delete on public.quote_lines
  for each row
  execute function public.guard_tig_locked_quote_line();

-- -----------------------------------------------------------------------------
-- RLS — select + insert a tagoknak; update/delete NINCS (immutábilis dokumentum)
-- -----------------------------------------------------------------------------
alter table public.performance_certificates enable row level security;

drop policy if exists "performance_certificates_select_member" on public.performance_certificates;
create policy "performance_certificates_select_member"
  on public.performance_certificates for select
  using (public.is_project_member(project_id));

drop policy if exists "performance_certificates_insert_member" on public.performance_certificates;
create policy "performance_certificates_insert_member"
  on public.performance_certificates for insert
  with check (public.is_project_member(project_id));

-- (szándékosan nincs update/delete policy — TIG-storno későbbi, kontrollált útvonal)
