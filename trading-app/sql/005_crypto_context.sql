-- =============================================================
-- trading-app: CRYPTO kontextus-réteg (KÉZZEL futtatandó a 004 után)
--
-- OI idősor (Δ1h/Δ4h), hírek/katalizátorok, paper bővítés.
-- =============================================================

create table if not exists crypto_oi_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null check (symbol in ('SOL', 'DOGE', 'BTC', 'ETH')),
  open_interest numeric not null,
  funding_rate numeric,
  price numeric,
  source text not null default 'bybit',
  captured_at timestamptz not null default now()
);

create index if not exists idx_crypto_oi_symbol_time
  on crypto_oi_snapshots (symbol, captured_at desc);

alter table crypto_oi_snapshots enable row level security;

create policy "authenticated all - crypto_oi_snapshots"
  on crypto_oi_snapshots for all
  to authenticated
  using (true)
  with check (true);

-- Hírek / manuális katalizátorok
create table if not exists crypto_news (
  id uuid primary key default gen_random_uuid(),
  symbols text[] not null,
  title text not null,
  url text,
  source text not null check (source in ('cryptopanic', 'manual')),
  severity text not null check (severity in ('low', 'med', 'high')),
  tags text[] not null default '{}',
  published_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_crypto_news_published
  on crypto_news (published_at desc);

create index if not exists idx_crypto_news_expires
  on crypto_news (expires_at desc);

alter table crypto_news enable row level security;

create policy "authenticated all - crypto_news"
  on crypto_news for all
  to authenticated
  using (true)
  with check (true);

-- Paper bővítés: kontextus a signal pillanatában
alter table crypto_signals
  add column if not exists oi_delta_1h numeric,
  add column if not exists catalyst_mode boolean default false,
  add column if not exists settlement_freeze boolean default false,
  add column if not exists context_note text;
