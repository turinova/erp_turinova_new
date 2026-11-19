-- Szögvágás: corners forrásigazság (alongGrain/alongCross).
-- Idempotens: létrehozza az oszlopot, ha a 20261015 még nem futott.
-- Depends on: 20260617_opti_megmunkalas_duplung_szog.sql

alter table public.quote_panels
  add column if not exists szogvagas_corners jsonb not null default '[]'::jsonb;

comment on column public.quote_panels.szogvagas_corners is
  'Szögvágás sarkok (forrásigazság): [{corner:TL|TR|BL|BR, alongGrainMm, alongCrossMm}]. v1: max 1 elem. Üres + legacy szog_kind = régi ajánlat.';

alter table public.quote_panels
  drop constraint if exists quote_panels_szogvagas_corners_is_array;

alter table public.quote_panels
  add constraint quote_panels_szogvagas_corners_is_array
  check (jsonb_typeof(szogvagas_corners) = 'array');

-- v1: max 1 sarok a JSON tömbben (üres tömb OK).
alter table public.quote_panels
  drop constraint if exists quote_panels_szogvagas_corners_max_one;

alter table public.quote_panels
  add constraint quote_panels_szogvagas_corners_max_one
  check (jsonb_array_length(szogvagas_corners) <= 1);

-- PostgREST schema cache (különben: Could not find column in the schema cache)
notify pgrst, 'reload schema';
