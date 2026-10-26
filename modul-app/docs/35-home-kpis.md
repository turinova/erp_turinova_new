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
(+ heti chartok ugyanazzal a header+hairline kerettel)
```

Grid: lapszabászat ON → `lg:grid-cols-6`, OFF → `lg:grid-cols-5`.

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
