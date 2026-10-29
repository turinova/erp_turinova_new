# 35 — Home KPI-k (jégelt)

**Állapot:** 2026-10-26 — v4: ügyvezetői bevétel-glance + micro-viz (opció A).  
**Persona:** ügyvezető — 5 mp scan, **Ft / pénzhatás** első.  
**Addonok** entitlement szerint. User layout **nincs**.

---

## Szemvezetés (Notion + Linear light)

1. **Bal → jobb:** legfontosabb szám elöl (mai forgalom).  
2. **Egy sor, hairline `divide`** — nem színes kártyaerdő.  
3. **Hierarchia:** kis label → nagy tabular Ft → hint → **micro-viz**.  
4. **Szín csak kivételre** (visszáru, kinnlevő) — nem dekoráció.  
5. Ajánlat / beszerzés **nem** az Értékesítés strip része (ops, nem bevétel).

---

## Elrendezés

```
Értékesítés
  [ Mai forgalom+spark (2col)
  | Mai lapszabászat + mini spark   ← lapszabászat entitlement
  | Havi forgalom + progress vs előző hó
  | Mai visszáru + ratio bar
  | Kinnlevő + paid ring ]

Új partner rendelések  (lista inbox)  ← partner_orders; üresen rejtve
Jelenlét     [ Bent x/y | Nincs itt | Szabadság | Beteg | Hiányzó nap ]
Belépők      [ Belépő | Kilépő | Csúcs | Nettó ] + heatmap  ← footcounter
Elmaradás    [ Szabás m | Élzarás m | Megrendelés db ]   ← lapszabászat, heti szabás felett
Heti szabás  H–P · gépenként külön oszlop (grouped) · erős színek · Mai % / Hátra
Heti élzárás H–P · élanyag stack (top 5 + Egyéb) · 700 m kapacitás vonal
```

Grid: lapszabászat ON → `lg:grid-cols-6`, OFF → `lg:grid-cols-5`.

### Elmaradás KPI

| Szabály | Részlet |
|---|---|
| Definíció | Lejárt gyártási nap (`production_date` ≤ tegnap BP), még nem kész |
| Status | csak `ordered` \| `in_production` |
| Ablak | max **90 nap** (`BACKLOG_MAX_AGE_DAYS`) — régebbi → `staleOrderCount` hint, nem méter |
| Méter + db | **egy** query (`getBacklogMeters`) |
| Kizár | `cancelled`, **archív** (`archived_at`), soft-delete; `ready_at`/`finished_at` ha mégis van |
| Link | `/megrendelesek?overdue=1` (lista chip: Elmaradás) |
| Copy | „Lejárt gyártási nap, még nem kész” |
| Query / UI | `chart-queries.ts` · `backlog-meters-card.tsx` |

### Heti gyártás chartok (ügyvezetői glance)

| Szabály | Részlet |
|---|---|
| Hét | **H–P** (szombat nincs gyártás) |
| Szabás | `production_date` + gép; `cutting_length_m`; **nem stacked** — gépenként saját oszlop / nap |
| Színek | `chart-colors.ts` erős hue (kék/narancs/zöld/lila…) — nem charcoal skála |
| Glance | Mai terhelés % (Σ m / Σ limit), Hátra m, status mondat |
| Limit | dashed ReferenceLine = max géplimit; legend: `Név · N m` |
| Élzárás | `quote_edge_lines` (fallback material `edge_length_m`); top 5 + **Egyéb** |
| Query | `src/lib/home/chart-queries.ts` · UI: `weekly-*-chart.tsx` |
| Archív | **minden** home quote-stat: `archived_at IS NULL` (heti szabás/él, gépátlag, elmaradás, lapszabászat KPI) |
| Lista | **nincs** „Lapszabászati megrendelések” tábla a homeon — részletek: `/megrendelesek`; actionable inbox: partner portal |

### Definíciók

| Cella | Forrás | Vizuál |
|---|---|---|
| Mai forgalom | `sales_orders` fulfilled (7 nap spark) | area spark |
| Mai lapszabászat | `quotes.ordered_at` ma + 7 nap; nem cancelled; status-független | mini spark |
| Havi forgalom | MTD gross; progress = MTD / előző hó 1…D | progress bar |
| Mai visszáru | `sales_returns` ma | return / mai forgalom bar |
| Kinnlevő | unpaid+partial remaining (`sales_payments` nettó) | ring = befizetett hányad a nyitott számlákon |

Közös UI: `src/components/home/home-metric-row.tsx` (`MetricRow` / `MetricCell` + `footer`).  
Micro-viz: `src/components/home/home-kpi-micro.tsx`.

### Partner portál inbox

- Main-app „Ügyfél árajánlatok” pár: `source=portal` + `portal_submitted_at` + `status=draft`
- Oszlopok: Partner · Ajánlat · Fizetési mód (+ comment hint) · Összeg · Beérkezett
- Fizetési mód: `preferred_payment_method_name` / `_comment` snapshot
- Link: `/ajanlatok/:id`

---

## Fájlok

| Réteg | Fájl |
|---|---|
| Query | `src/lib/home/kpi-queries.ts` |
| Partner inbox | `src/lib/home/partner-portal-inbox.ts` |
| Spark | `src/components/home/home-sales-spark-chart.tsx` |
| Micro-viz | `src/components/home/home-kpi-micro.tsx` |
| UI | `src/components/home/home-kpi-strip.tsx` |
| Partner UI | `src/components/home/partner-portal-inbox-card.tsx` |
| Seeder | `scripts/seed-home-kpis.mjs` |

```bash
cd modul-app
node --env-file=.env.local scripts/seed-home-kpis.mjs --tenant-slug=demo --replace
```
