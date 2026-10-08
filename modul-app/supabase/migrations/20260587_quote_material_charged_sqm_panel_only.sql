-- Fix quote_material_lines.charged_sqm to match main-app semantics:
-- charged_sqm = panel_area charged m² only (waste already included).
-- Full-board area must NOT be stored in charged_sqm (that lives in boards_charged × board area).
--
-- Forward path fixed in materialLineFromPricing (snapshot.ts).
-- Backfill: subtract full-board area that was incorrectly summed into charged_sqm.

update public.quote_material_lines
set charged_sqm = greatest(
  0::numeric,
  round(
    (
      charged_sqm
      - (
        boards_charged::numeric
        * board_grain_mm::numeric
        * board_cross_mm::numeric
        / 1000000::numeric
      )
    )::numeric,
    4
  )
)
where boards_charged > 0
  and board_grain_mm > 0
  and board_cross_mm > 0
  and charged_sqm > 0;

comment on column public.quote_material_lines.charged_sqm is
  'Panel-area charged m² only (waste in value). Full boards → boards_charged; not included here. main-app parity.';
