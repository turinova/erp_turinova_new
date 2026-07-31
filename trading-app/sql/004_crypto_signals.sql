-- =============================================================
-- trading-app: CRYPTO signal napló + paper trading (KÉZZEL futtatandó
-- a Supabase SQL editorban a 003 után)
--
-- Az NQ-tól teljesen külön modul: SOL + DOGE perp signalok, BTC/ETH
-- rezsim-filterrel. A rendszer 24/7 gyűjti és papíron értékeli ki a
-- signalokat — 6 hét adat után döntés: melyik setup marad.
-- =============================================================

create table if not exists crypto_signals (
  id uuid primary key default gen_random_uuid(),
  -- UTC nap (a crypto 24/7 megy, a dedup-nap UTC szerint értendő)
  date date not null,
  symbol text not null check (symbol in ('SOL', 'DOGE')),
  kind text not null check (
    kind in (
      'SWEEP_LONG', 'SWEEP_SHORT',       -- liquidity sweep + reclaim (prev day/week H/L)
      'MR_LONG', 'MR_SHORT',             -- mean reversion a VWAP-ra (csak range piacon, ADX-kapu)
      'BREAKOUT_LONG', 'BREAKOUT_SHORT', -- US-open range breakout (13:00-13:30 UTC range)
      'PB_LONG', 'PB_SHORT'              -- momentum pullback (VWAP-visszateszt trendben)
    )
  ),
  triggered_at timestamptz not null default now(),
  bar_time timestamptz not null,
  entry numeric not null,
  stop numeric not null,
  -- 2R target (mean reversionnél a VWAP) — a paper engine ezt követi
  target numeric not null,
  reason text,
  -- kontextus a kiértékeléshez: BTC-rezsim, funding, RVOL a signal pillanatában
  btc_regime text,
  funding_rate numeric,
  rvol numeric,
  source text not null default 'bybit',
  status text not null default 'open' check (
    status in ('open', 'win', 'loss', 'expired')
  ),
  exit_price numeric,
  exited_at timestamptz,
  r_multiple numeric,
  created_at timestamptz not null default now(),
  -- naponta symbol+setup-onként egy signal (dedup a pollozás miatt)
  unique (date, symbol, kind)
);

create index if not exists idx_crypto_signals_date on crypto_signals (date desc);
create index if not exists idx_crypto_signals_status on crypto_signals (status);
create index if not exists idx_crypto_signals_symbol on crypto_signals (symbol);

alter table crypto_signals enable row level security;

create policy "authenticated all - crypto_signals"
  on crypto_signals for all
  to authenticated
  using (true)
  with check (true);
