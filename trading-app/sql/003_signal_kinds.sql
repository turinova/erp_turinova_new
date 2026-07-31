-- =============================================================
-- trading-app: új élő signal-típusok (KÉZZEL futtatandó a Supabase
-- SQL editorban a 002_live_signals.sql után)
--
-- Az élő engine mostantól mind az 5 stratégiát figyeli:
--   VWAP_LONG / VWAP_SHORT — VWAP reversion (range napok)
--   PB_LONG / PB_SHORT     — momentum pullback (kitörés utáni VWAP-visszateszt)
-- =============================================================

alter table live_signals drop constraint if exists live_signals_kind_check;

alter table live_signals add constraint live_signals_kind_check check (
  kind in (
    'ORB_LONG', 'ORB_SHORT',
    'FADE_LONG', 'FADE_SHORT',
    'VWAP_LONG', 'VWAP_SHORT',
    'PB_LONG', 'PB_SHORT'
  )
);
