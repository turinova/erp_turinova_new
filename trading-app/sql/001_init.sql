-- =============================================================
-- trading-app: kezdő séma (KÉZZEL futtatandó a Supabase SQL editorban)
-- Külön Supabase projekt — NEM a main-app adatbázisa!
-- Egy felhasználós app: a user-t kézzel hozod létre a Supabase Authban,
-- és a "Disable new user signups" opciót kapcsold be a dashboardon.
-- =============================================================

-- Beállítások (1 sor elég, de user_id-t tartunk a jövőnek)
create table if not exists trading_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  account_size numeric not null default 5000,
  risk_per_trade_pct numeric not null default 1,
  max_trades_per_day int not null default 2,
  max_daily_loss_r numeric not null default 2,
  orb_minutes int not null default 15,
  is_demo_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Napi MNQ session
create table if not exists trading_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  orb_high numeric,
  orb_low numeric,
  orb_locked_at timestamptz,
  vwap_side text check (vwap_side in ('above', 'below', 'at')),
  regime text check (regime in ('trend_up', 'trend_down', 'range', 'choppy')),
  overnight_high numeric,
  overnight_low numeric,
  notes text,
  created_at timestamptz not null default now()
);

-- Trade-ek (a skip-eket is ide logoljuk, setup_type = 'skip')
create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references trading_sessions (id) on delete cascade,
  traded_at timestamptz not null default now(),
  setup_type text not null check (
    setup_type in (
      'orb_long',
      'orb_short',
      'failed_breakout_fade',
      'vwap_reversion',
      'momentum_pullback',
      'skip'
    )
  ),
  entry_price numeric,
  stop_price numeric,
  target_price numeric,
  exit_price numeric,
  -- R = (exit - entry) / (entry - stop); shortnál a nevező negatív, így az előjel helyes
  r_multiple numeric generated always as (
    case
      when exit_price is not null
        and entry_price is not null
        and stop_price is not null
        and entry_price <> stop_price
      then round((exit_price - entry_price) / (entry_price - stop_price), 2)
    end
  ) stored,
  result text check (result in ('win', 'loss', 'be')),
  vwap_side text check (vwap_side in ('above', 'below', 'at')),
  volume_confirmed boolean not null default false,
  liquidity_swept boolean not null default false,
  fvg_present boolean not null default false,
  followed_plan boolean not null default true,
  emotion_tag text check (emotion_tag in ('calm', 'fomo', 'revenge', 'hesitant', 'confident')),
  notes text,
  screenshot_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trades_session on trades (session_id);
create index if not exists idx_trades_traded_at on trades (traded_at desc);

-- Napi összesítő view a guardrailekhez és a heti riporthoz
create or replace view daily_summary as
select
  s.date,
  s.regime,
  count(t.id) filter (where t.setup_type <> 'skip') as trades_count,
  coalesce(sum(t.r_multiple) filter (where t.setup_type <> 'skip'), 0) as net_r,
  bool_or(not t.followed_plan) filter (where t.setup_type <> 'skip') as rule_broken
from trading_sessions s
left join trades t on t.session_id = s.id
group by s.date, s.regime
order by s.date desc;

-- =============================================================
-- RLS: egy felhasználós app — minden bejelentkezett user olvashat/írhat.
-- (Signup le van tiltva, tehát csak te.)
-- =============================================================

alter table trading_settings enable row level security;
alter table trading_sessions enable row level security;
alter table trades enable row level security;

create policy "authenticated all - settings"
  on trading_settings for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated all - sessions"
  on trading_sessions for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated all - trades"
  on trades for all
  to authenticated
  using (true)
  with check (true);

-- Kezdő beállítás-sor
insert into trading_settings (account_size, risk_per_trade_pct, max_trades_per_day, max_daily_loss_r, orb_minutes, is_demo_mode)
values (5000, 1, 2, 2, 15, true);
