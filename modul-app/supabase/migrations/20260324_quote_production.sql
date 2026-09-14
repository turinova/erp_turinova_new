-- modul-app: quote production assignment (gép + dátum + vonalkód)
-- Depends on: quotes, production_machines

alter table public.quotes
  add column if not exists production_machine_id uuid
    references public.production_machines (id) on delete set null;

alter table public.quotes
  add column if not exists production_date date;

alter table public.quotes
  add column if not exists barcode text;

alter table public.quotes
  add column if not exists in_production_at timestamptz;

create unique index if not exists quotes_tenant_barcode_alive_uidx
  on public.quotes (tenant_id, barcode)
  where deleted_at is null and barcode is not null;

create index if not exists quotes_tenant_production_machine_alive_idx
  on public.quotes (tenant_id, production_machine_id)
  where deleted_at is null and production_machine_id is not null;

comment on column public.quotes.production_machine_id is
  'Gyártásba adás: választott gyártógép.';
comment on column public.quotes.production_date is
  'Tervezett / rögzített gyártási nap.';
comment on column public.quotes.barcode is
  'Műhely vonalkód (CODE128) — manuális / scanner.';
comment on column public.quotes.in_production_at is
  'Első gyártásbaadás időpontja.';
