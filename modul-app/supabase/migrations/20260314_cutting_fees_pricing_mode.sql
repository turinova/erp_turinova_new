-- modul-app: Opti árazási mód (cutting_fees bővítés)
-- Futtasd a 20260313_cutting_fees után.

alter table public.cutting_fees
  add column if not exists pricing_mode text not null default 'standard'
    check (pricing_mode in ('standard', 'always_full_board', 'always_panel_area'));

comment on column public.cutting_fees.pricing_mode is
  'standard = main Opti szabály; always_full_board = mindig teljes tábla; always_panel_area = mindig panel×hulladék';
