-- Dolgozó archiválás (kilépett): kikerül a listából, de a jelenlét / távollét / ív megmarad.
-- Inaktív (active = false) = átmeneti; archivált = kilépett; törölt (deleted_at) = hibás felvétel.

alter table public.hr_employees
  add column if not exists archived_at timestamptz;

comment on column public.hr_employees.archived_at is
  'Archiválás ideje (kilépett dolgozó). NULL = nincs archiválva.';

create index if not exists hr_employees_tenant_archived_idx
  on public.hr_employees (tenant_id, archived_at)
  where deleted_at is null;
