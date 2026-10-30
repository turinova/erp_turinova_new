-- Per-cell mező kapcsolók (név/SKU/ár/vonalkód) — sheet show_* = új cella default.

alter table public.a4_barcode_sheet_cells
  add column if not exists show_name boolean not null default true;

alter table public.a4_barcode_sheet_cells
  add column if not exists show_sku boolean not null default false;

alter table public.a4_barcode_sheet_cells
  add column if not exists show_price boolean not null default true;

alter table public.a4_barcode_sheet_cells
  add column if not exists show_barcode boolean not null default true;

alter table public.a4_barcode_sheet_cells
  add column if not exists price_snap numeric(12, 2);

comment on column public.a4_barcode_sheet_cells.show_name is
  'Cella: megjelenített név zóna.';
comment on column public.a4_barcode_sheet_cells.show_sku is
  'Cella: SKU zóna.';
comment on column public.a4_barcode_sheet_cells.show_price is
  'Cella: ár zóna.';
comment on column public.a4_barcode_sheet_cells.show_barcode is
  'Cella: vonalkód sávok (HRI nincs).';
comment on column public.a4_barcode_sheet_cells.price_snap is
  'Ár snapshot a PDF-hez (bruttó Ft), ha a termék törölve.';

-- Backfill meglévő cellák: sheet globális mezőkből
update public.a4_barcode_sheet_cells c
set
  show_name = s.show_name,
  show_sku = s.show_sku,
  show_price = s.show_price,
  show_barcode = true
from public.a4_barcode_sheets s
where s.id = c.sheet_id
  and s.tenant_id = c.tenant_id;
