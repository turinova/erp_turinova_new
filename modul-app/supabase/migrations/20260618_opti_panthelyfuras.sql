-- Opti megmunkálás: pánthelyfúrás (db / panel, min 2, max 20; nincs oldal)
-- Díj default 0 Ft — jelölés mehet ár nélkül.

alter table public.cutting_fees
  add column if not exists panthelyfuras_fee_per_hole numeric(10, 2) not null default 0
    check (panthelyfuras_fee_per_hole >= 0);

comment on column public.cutting_fees.panthelyfuras_fee_per_hole is
  'Nettó pánthelyfúrás díj Ft/lyuk (UI bruttót mutat). 0 = ingyenes jelölés.';

alter table public.quote_panels
  add column if not exists panthelyfuras_quantity integer not null default 0;

alter table public.quote_panels
  drop constraint if exists quote_panels_panthelyfuras_quantity_check;

alter table public.quote_panels
  add constraint quote_panels_panthelyfuras_quantity_check
  check (
    panthelyfuras_quantity = 0
    or panthelyfuras_quantity between 2 and 20
  );

comment on column public.quote_panels.panthelyfuras_quantity is
  'Pánthely lyukak száma panelenként (0 = nincs; 2–20). Nincs oldal mező.';

comment on table public.quote_panels is
  'Opti paneltételek (grain/cross mm, él A–D, duplung/szög/pánthely).';

-- service_type check: duplung + szög + pánthely
alter table public.quote_service_lines
  drop constraint if exists quote_service_lines_service_type_check;

alter table public.quote_service_lines
  add constraint quote_service_lines_service_type_check
  check (service_type in ('duplungolas', 'szogvagas', 'panthelyfuras'));

comment on table public.quote_service_lines is
  'Opti megmunkálás sorok anyagonként (duplung / szög / pánthely). Cascade a material line törlésével.';
