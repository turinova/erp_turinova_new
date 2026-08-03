-- =============================================================
-- trading-app: FVG + session kind-ok a crypto_signals táblán
-- KÉZZEL futtatandó a Supabase SQL editorban (004 + 005 után).
--
-- Fontos: a Postgres inline CHECK neve nem mindig
-- "crypto_signals_kind_check" — ezért minden kind-CHECK-et
-- ledobunk, majd újra felvesszük.
-- =============================================================

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'crypto_signals'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.crypto_signals drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.crypto_signals
  add constraint crypto_signals_kind_check check (
    kind in (
      'SWEEP_LONG', 'SWEEP_SHORT',
      'MR_LONG', 'MR_SHORT',
      'BREAKOUT_LONG', 'BREAKOUT_SHORT',
      'PB_LONG', 'PB_SHORT',
      'FVG_LONG', 'FVG_SHORT'
    )
  );

-- Gyors ellenőrzés (Success mellett ezeket is nézd):
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.crypto_signals'::regclass and contype = 'c';
