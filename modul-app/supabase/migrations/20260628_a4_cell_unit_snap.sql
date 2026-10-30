-- Cella: szerkeszthető egység snapshot (ár Ft/{unit_snap})

alter table public.a4_barcode_sheet_cells
  add column if not exists unit_snap text;

comment on column public.a4_barcode_sheet_cells.unit_snap is
  'Megjelenített egység (pl. db, m) — PDF: „12 490 Ft/db”.';
