# trading-app — MNQ + crypto day trading terminal

Személyes (1 felhasználós) trading elemző app két, egymástól teljesen független
modullal:

- **MNQ Futures** — session támogatás (ORB + VWAP), trade journal, statisztika,
  backtest, napi guardrailek
- **Crypto** — SOL + DOGE élő scalp-signalok BTC/ETH kontextussal, 24/7 paper
  trading validáció

**Az app mér és segít dönteni — nem tradel helyetted.**

## Stack

Ugyanaz, mint a `hiros-ablak/site`: Next.js 16 + React 19 + Tailwind CSS v4 +
TypeScript + Supabase, Vercel deploy. Admin-elrendezés fix bal oldali menüvel,
dark téma.

## Futtatás

```bash
npm install
npm run dev        # http://localhost:3010
```

## Fázisok

1. **Mock adat (jelenlegi)** — a teljes UI a `src/lib/mock-data.ts`-ből él.
   Nincs auth, nincs DB. A mock struktúra 1:1 követi az SQL sémát.
2. **Supabase bekötés** — `sql/001_init.sql` kézi futtatása a Supabase SQL
   editorban (külön projekt!), env kitöltése (`env.template`), mock lecserélése
   API route-okra, login + middleware (signup letiltva, 1 user kézzel).
3. **Adat API (később, ha kell)** — real-time MNQ ár, auto ORB/VWAP.
4. **Go-live modul** — 60 trade / +20R checklist, live mode.

## Oldalak

| Útvonal | Funkció |
|---------|---------|
| `/` | Dashboard: pre-session checklist, mai trade-számláló, napi R, -2R guardrail |
| `/session` | Élő session: auto ORB lock (9:45 ET), VWAP + RVOL, élő signal engine, chart, értesítés |
| `/signals` | Paper trading: az élő signalok automatikus naplója és kiértékelése (win/loss/R) |
| `/journal` | Trade lista (skip-ekkel együtt), win rate, nettó R |
| `/journal/new` | Új trade form: 5 setup-típus, auto R-számítás, ICT tagek, fegyelem-mezők |
| `/analytics` | Equity curve (R), setup statisztika, rezsim mátrix, go-live progress |
| `/backtest` | A 4 stratégia historikus tesztje NQ 5m gyertyákon, konfigurálható filterekkel |
| `/crypto` | Élő crypto panel: SOL + DOGE signalok, BTC/ETH rezsim, funding, chartok |
| `/crypto/signals` | Crypto paper trading napló: coin + setup bontás, win rate, nettó R |
| `/settings` | Account size, risk %, napi limitek, ORB periódus, demo mód |

## Backtest adat

```bash
npm run fetch-data   # Yahoo Finance → data/bars-NQ-5m.json (~60 nap, ingyenes)
```

Konzervatív szimuláció: entry a jelzőgyertya záróárán; ha egy gyertyán belül
a stop és a target is elérhető lenne, a stop számít. Mélyebb historikához
(évek, 1 perces) később: Databento.

## Élő feed (Session oldal)

Alapból Yahoo Finance a forrás (ingyenes, ~1-10 perc késés). Valós idejű
adathoz Tradovate:

1. Tradovate fiók (demó is jó) + **API Access add-on** (Application Settings →
   API Access, ~$15/hó) — itt kapod a Client ID-t (cid) és a Secretet.
2. Töltsd ki a `.env.local`-ban a `TRADOVATE_*` változókat (lásd `env.template`).
3. Restart — a session oldal fejlécében látod: "Tradovate real-time feed".

Ha a Tradovate hívás hibázik, az app automatikusan Yahoo-ra esik vissza.

## Paper trading (élő signal validáció)

A `sql/002_live_signals.sql` (és `sql/003_signal_kinds.sql`) futtatása után
minden élő signal automatikusan a `live_signals` táblába kerül, és a rendszer
papíron végigköveti: stop = -1R, 2R target = win, session vége (15:55 ET) =
zárás piaci áron. Az eredmények a `/signals` oldalon — ezek igazolják (vagy
cáfolják), hogy az élő signalok hozzák a backtest számait, mielőtt valódi
pénz menne rájuk.

Az élő engine mind az 5 stratégiát figyeli, prioritási sorrendben:
failed breakout fade → ORB breakout (csak a kitörés utáni 30 percben, VWAP +
RVOL filterrel, chase-védelemmel) → momentum pullback (VWAP-visszateszt a
trend irányába) → VWAP reversion (range napokon 10:30 ET után). A napi
guardrail (max trade-szám / max napi -R a journalból) limit felett elnémítja
a signal panelt — de a paper napló ilyenkor is rögzít, mert az a stratégiát
méri, nem a fegyelmet.

## Vercel deploy + cron (önjáró adatgyűjtés)

1. Commit + push (a repo gyökeréből): `git add trading-app && git commit && git push`
2. Vercel dashboard → Add New Project → a repo importálása → **Root Directory:
   `trading-app`** (monorepo!), a framework auto-detect (Next.js).
3. Env-változók a Vercel projektben (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     (ugyanaz, mint a `.env.local`-ban)
   - `SUPABASE_SECRET_KEY` — Supabase → Project Settings → API keys →
     service_role (a cron RLS nélkül ír)
   - `CRON_SECRET` — hosszú random string (pl. `openssl rand -hex 32`);
     a Vercel Cron ezzel hitelesíti magát a `/api/cron` felé
4. Deploy. A `vercel.json` cron bejegyzése (`*/5 * * * *`) 5 percenként,
   24/7 hívja a `/api/cron`-t: a crypto tick mindig fut (a crypto piac sosem
   zár), az NQ tick csak hétköznap 13:00–21:00 UTC között. Ellenőrzés:
   Vercel → Project → Cron Jobs fül, illetve a `live_signals` /
   `crypto_signals` táblák.

A cron a paper trading adatgyűjtést végzi — a böngészős élő nézet ettől
függetlenül működik, amikor nyitva van.

## Crypto modul (SOL + DOGE)

Az NQ-tól teljesen külön modul (`src/lib/crypto/`, `/crypto` oldalak,
`crypto_signals` tábla — `sql/004_crypto_signals.sql` futtatandó). Adatforrás:
Bybit publikus perp API (kulcs nem kell), Binance USDT-M fallback. A trade-eket
kézzel viszed be a saját platformodon — itt csak a signal születik.

Setupok prioritási sorrendben:

1. **Sweep-reclaim** — prev day/week high/low likviditás-sweep + visszazárás
2. **US-open breakout** — 13:00–13:30 UTC range kitörése volumennel (RVOL ≥ 1.5)
3. **Momentum pullback** — trendmozgás utáni VWAP-visszateszt
4. **VWAP mean reversion** — csak range piacon (ADX < 25), ha az ár ≥ 2×ATR-re
   nyúlt a napi VWAP-tól

Kapuk: BTC-rezsim (risk-off → long tiltva, risk-on → short tiltva; hirtelen
15 perces BTC-mozgás felülír), DOGE volumen-kapu (RVOL < 1.3 → semmi), extrém
funding (±0.05%/8h → a zsúfolt oldal irányába nincs friss entry). Napi limit:
max 5 signal vagy -3R (a kettő coin együtt), utána a panel elnémul.

Paper kiértékelés: stop = -1R, 2R target = win (mean reversionnél a VWAP a
target), 12 óra után zárás piaci áron. Eredmények a `/crypto/signals` oldalon —
6 hét adat után döntés, melyik coin+setup páros marad.

Tesztek: `npx tsx scripts/test-crypto.ts` (szintetikus), `--live` fleggel valódi
Bybit lekéréssel.

## Az 5 stratégia (setup_type)

`orb_long`, `orb_short`, `failed_breakout_fade`, `vwap_reversion`,
`momentum_pullback` — plusz `skip` a kihagyott setupok logolásához (az edge
validálásához az is adat).
