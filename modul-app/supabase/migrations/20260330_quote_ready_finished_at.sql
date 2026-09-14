-- modul-app: ready_at / finished_at a home chart kész/hátra logikához

alter table public.quotes
  add column if not exists ready_at timestamptz;

alter table public.quotes
  add column if not exists finished_at timestamptz;

comment on column public.quotes.ready_at is
  'Kész státusz időpontja (műhely chart / elmaradás).';
comment on column public.quotes.finished_at is
  'Lezárva (átadás) időpontja.';

-- Backfill: már ready/finished sorok — updated_at közelítés
update public.quotes
set ready_at = coalesce(ready_at, updated_at)
where status in ('ready', 'finished')
  and ready_at is null
  and deleted_at is null;

update public.quotes
set finished_at = coalesce(finished_at, updated_at)
where status = 'finished'
  and finished_at is null
  and deleted_at is null;

create index if not exists quotes_tenant_ready_at_idx
  on public.quotes (tenant_id, ready_at)
  where deleted_at is null and ready_at is not null;
