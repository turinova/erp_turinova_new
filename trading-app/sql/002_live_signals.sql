-- =============================================================
-- trading-app: élő signal napló + paper trading (KÉZZEL futtatandó
-- a Supabase SQL editorban a 001_init.sql után)
--
-- Minden élő signalt automatikusan ide mentünk, majd a rendszer
-- "papíron" végigköveti: stop vagy target teljesült-e, mennyi lett az R.
-- Így pár hét után adat van róla, hogy az élő signalok hozzák-e
-- a backtest számait — valódi pénz kockáztatása nélkül.
-- =============================================================

create table if not exists live_signals (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind text not null check (
    kind in ('ORB_LONG', 'ORB_SHORT', 'FADE_LONG', 'FADE_SHORT')
  ),
  triggered_at timestamptz not null default now(),
  -- a signal-gyertya időpontja (erre horgonyzunk a kiértékelésnél)
  bar_time timestamptz not null,
  entry numeric not null,
  stop numeric not null,
  -- 2R target — a paper engine ezt követi
  target numeric not null,
  contracts int,
  reason text,
  source text not null default 'yahoo',
  status text not null default 'open' check (
    status in ('open', 'win', 'loss', 'expired')
  ),
  exit_price numeric,
  exited_at timestamptz,
  r_multiple numeric,
  created_at timestamptz not null default now(),
  -- naponta setup-típusonként egy signal (dedup a pollozás miatt)
  unique (date, kind)
);

create index if not exists idx_live_signals_date on live_signals (date desc);
create index if not exists idx_live_signals_status on live_signals (status);

alter table live_signals enable row level security;

create policy "authenticated all - live_signals"
  on live_signals for all
  to authenticated
  using (true)
  with check (true);
