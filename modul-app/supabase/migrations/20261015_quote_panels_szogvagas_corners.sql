-- Szögvágás sarokadatok (megmunkálás) — Opti nesting továbbra is téglalap.
-- Depends on: 20260617_opti_megmunkalas_duplung_szog.sql

alter table public.quote_panels
  add column if not exists szogvagas_corners jsonb not null default '[]'::jsonb;

comment on column public.quote_panels.szogvagas_corners is
  'Szögvágás sarkok: [{corner:tl|tr|bl|br, remainEdge1Mm, remainEdge2Mm}]. Üres = legacy csak flag.';

alter table public.quote_panels
  drop constraint if exists quote_panels_szogvagas_corners_is_array;

alter table public.quote_panels
  add constraint quote_panels_szogvagas_corners_is_array
  check (jsonb_typeof(szogvagas_corners) = 'array');
