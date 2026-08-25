# `/arak` UX terv — 3 fül (Shopify / Jobs)

**Státusz:** implementálva 2026-08-25  
**Cél:** 15 éves műhelyes is értse; 100–8000 SKU-nál legyen tömeges út.

## Fülek

| Fül | Egy feladat |
|-----|-------------|
| **Szabály** | Csoport −% + élő példa |
| **Kivételek** | Fix Ft, Beszer+%, lista−%, kijelölés, CSV |
| **Sávok** | Mennyiségi kedvezmény (drawer) |

## Status bar

`{csoport}: lista −X%. {N} fix. Sávok a Sávok fülön.`

## Skála

- **Kategória** szűrő (elsődleges) + leszármazottak + „Ezekre mind…”
- Márka szűrő (másodlagos)
- Kijelölés → sticky bulk
- CSV export (fix / látható sorok)
- **Sűrű lista:** 1 soros termékcella (név truncate + SKU), ~32px sor, 100/oldal

## Kategória (P-12)

- SQL: `023_catalog_categories.sql` (manuális)
- Sync: kategória fa (`categoryExtend`) + termék↔kategória M:N (`productCategoryRelations` — a `/products` lista csak href stub)
- Heal `/arak`: üres link tábla / hiányzó nevek → SR-ből pótlás
- API: `categoryInnerId` a GET `/prices` és POST `/prices/bulk`-on

## Nem ebben a passzban

- CSV import (P-13 folytatás)

## Sáv bulk (A+D)

- Kijelölés / kategória / márka → sticky „Sáv ezekre” (lista −% vagy Ft)
- „Másold erről” = nyitott termék sávjai a kijelöltre / szűrtre
- API: `POST /api/merchant/prices/tiers/bulk` (max 40 SKU / kérés)

## Sáv visszajelzés

- Panel: „N sáv aktív” + „Mentve: 10+ → … · 50+ → …”
- „Összes sáv törlése” csak ha van mentett sáv
- Lista badge: `2 sáv` (Postgres tükör `partner_volume_tiers` — SQL `025`)
- Mentés / panel open → tükör heal
