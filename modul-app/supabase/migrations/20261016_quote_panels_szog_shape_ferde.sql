-- Szögvágás alak + ferde élzáró — session/Opti → quote_panels persist.
-- Excel export továbbra is nest téglalap (A–D); ferde a szabásjegyzékben / PDF-ben.
-- Depends on: 20260617_opti_megmunkalas_duplung_szog.sql, 20260316_quotes.sql

alter table public.quote_panels
  add column if not exists edge_ferde_id uuid
    references public.edge_materials (id);

alter table public.quote_panels
  add column if not exists szog_kind text;

alter table public.quote_panels
  add column if not exists szog_trap_short_mm integer;

alter table public.quote_panels
  add column if not exists szog_trap_axis text;

comment on column public.quote_panels.edge_ferde_id is
  'Szögvágás ferde (vágott) él élzárója. null = nincs.';
comment on column public.quote_panels.szog_kind is
  'trapezoid | triangle. null ha nincs szögvágás.';
comment on column public.quote_panels.szog_trap_short_mm is
  'Trapéz kész rövid él mm. Háromszögnél null.';
comment on column public.quote_panels.szog_trap_axis is
  'grain | cross — trapéz párhuzamos tengely. Háromszögnél opcionális.';

alter table public.quote_panels
  drop constraint if exists quote_panels_szog_kind_check;
alter table public.quote_panels
  add constraint quote_panels_szog_kind_check
  check (szog_kind is null or szog_kind in ('trapezoid', 'triangle'));

alter table public.quote_panels
  drop constraint if exists quote_panels_szog_trap_axis_check;
alter table public.quote_panels
  add constraint quote_panels_szog_trap_axis_check
  check (szog_trap_axis is null or szog_trap_axis in ('grain', 'cross'));

alter table public.quote_panels
  drop constraint if exists quote_panels_szog_trap_short_mm_check;
alter table public.quote_panels
  add constraint quote_panels_szog_trap_short_mm_check
  check (szog_trap_short_mm is null or szog_trap_short_mm > 0);

-- Konzisztencia: nincs szög → alak/ferde üres.
-- Legacy: szogvagas=true + üres alak megengedett (régi ajánlatok).
alter table public.quote_panels
  drop constraint if exists quote_panels_szog_shape_consistency;
alter table public.quote_panels
  add constraint quote_panels_szog_shape_consistency
  check (
    (
      szogvagas = false
      and edge_ferde_id is null
      and szog_kind is null
      and szog_trap_short_mm is null
      and szog_trap_axis is null
    )
    or szogvagas = true
  );

alter table public.quote_panels
  drop constraint if exists quote_panels_szog_trap_fields_check;
alter table public.quote_panels
  add constraint quote_panels_szog_trap_fields_check
  check (
    szog_kind is null
    or szog_kind = 'triangle'
    or (
      szog_kind = 'trapezoid'
      and (szog_trap_short_mm is null or szog_trap_axis is not null)
    )
  );

create index if not exists quote_panels_edge_ferde_id_idx
  on public.quote_panels (edge_ferde_id)
  where edge_ferde_id is not null;
