-- Opti pánthelyfúrás: melyik oldalra (geometriai hosszabb / rövidebb oldal, nem szálirány).
-- Régi sorok: oldal null (nem tudjuk utólag) — a UI oldal nélkül mutatja.

alter table public.quote_panels
  add column if not exists panthelyfuras_oldal text;

alter table public.quote_panels
  drop constraint if exists quote_panels_panthelyfuras_oldal_check;

alter table public.quote_panels
  add constraint quote_panels_panthelyfuras_oldal_check
  check (
    (panthelyfuras_oldal is null or panthelyfuras_oldal in ('hosszu', 'rovid'))
    and (panthelyfuras_quantity > 0 or panthelyfuras_oldal is null)
  );

comment on column public.quote_panels.panthelyfuras_oldal is
  'Pánthely oldal: hosszu = max(grain, cross) él, rovid = min. Null: nincs pánthely vagy régi sor.';
