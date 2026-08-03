-- =============================================================
-- trading-app: egyben futtatható javítás + ellenőrzés
-- Másold be a Supabase SQL Editorba (a trading-app projekt!).
-- =============================================================

-- 1) 005 táblák
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
drop policy if exists "authenticated all - crypto_oi_snapshots" on crypto_oi_snapshots;
create policy "authenticated all - crypto_oi_snapshots"
  on crypto_oi_snapshots for all to authenticated using (true) with check (true);

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
create index if not exists idx_crypto_news_published on crypto_news (published_at desc);
alter table crypto_news enable row level security;
drop policy if exists "authenticated all - crypto_news" on crypto_news;
create policy "authenticated all - crypto_news"
  on crypto_news for all to authenticated using (true) with check (true);

alter table crypto_signals
  add column if not exists oi_delta_1h numeric,
  add column if not exists catalyst_mode boolean default false,
  add column if not exists settlement_freeze boolean default false,
  add column if not exists context_note text;

-- 2) 006 kind CHECK (minden régi kind-check ledobása)
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

-- 3) Ellenőrző lekérdezés — ezt kell látnod:
select 'crypto_signals' as obj, to_regclass('public.crypto_signals') is not null as ok
union all
select 'crypto_oi_snapshots', to_regclass('public.crypto_oi_snapshots') is not null
union all
select 'crypto_news', to_regclass('public.crypto_news') is not null
union all
select 'kind allows FVG_LONG',
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.crypto_signals'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%FVG_LONG%'
  );
