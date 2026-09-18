# 35 — Home KPI-k (jégelt)

**Állapot:** 2026-09-18 — v3: Notion/Linear glance — egy soros metric row, roster nélkül.  
**Persona:** ügyvezető / kereskedő — 5 mp scan.  
**Addonok** entitlement szerint. User layout **nincs**.

---

## Szemvezetés (Notion + Linear light)

1. **Bal → jobb:** legfontosabb szám elöl (forgalom / bent).  
2. **Egy sor, egyenlő cellák**, hairline `divide` — nem színes kártyaerdő.  
3. **Hierarchia:** kis label (`text-hint`) → nagy tabular szám (~1.5rem/600) → opcionális hint.  
4. **Szín csak kivételre** (hiányzik, lejár, beteg) — nem dekoráció.  
5. **Lista / roster** a `/jelenlet` oldalon — home csak stats.

---

## Elrendezés

```
Értékesítés  [ Mai forgalom+spark | Nyitott ajánlat | Lejáró | Beszerzés ]
Jelenlét     [ Bent x/y | Nincs itt | Szabadság | Beteg | Hiányzó nap ]
Belépők      [ Belépő | Kilépő | Csúcs | Nettó ] + heatmap  ← footcounter
Elmaradás    [ Szabás m | Élzarás m | Megrendelés db ]   ← lapszabászat, heti szabás felett
(+ heti chartok ugyanazzal a header+hairline kerettel)
```

Közös UI: `src/components/home/home-metric-row.tsx` (`MetricRow` / `MetricCell`).

---

## Fájlok

| Réteg | Fájl |
|---|---|
| Query | `src/lib/home/kpi-queries.ts` |
| Spark | `src/components/home/home-sales-spark-chart.tsx` |
| UI | `src/components/home/home-kpi-strip.tsx` |
| Seeder | `scripts/seed-home-kpis.mjs` |

```bash
cd modul-app
node --env-file=.env.local scripts/seed-home-kpis.mjs --tenant-slug=demo --replace
```
