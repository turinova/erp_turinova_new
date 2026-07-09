-- =============================================================================
-- Szakágak — dinamikus trade kódok a categories táblában
-- =============================================================================
-- Előfeltétel: 004_categories.sql már lefutott
-- =============================================================================

alter table public.categories drop constraint if exists categories_trade_check;
