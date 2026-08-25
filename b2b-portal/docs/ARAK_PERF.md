# Árak (`/arak`) — teljesítmény

**Cél:** 5–6000 termék / tenant, 150–200 tenant — `/arak` oldalváltás **villám** (p95 meleg GET &lt; 200 ms), Shoprenter rate-limit nélkül a hot pathon.

**Dátum:** 2026-08-25

---

## 1. Döntés

| Opció | Verdikt |
|-------|---------|
| N× `findGroupPrice` / oldal | ❌ diszkvalifikálva |
| Teljes webshop dump | ❌ nem kell — `product_catalog` már vékony tükör |
| Redis-only cache | 🟡 átmeneti |
| **`partner_group_prices` Postgres mirror + write-through** | ✅ **győztes** |

**Aranyszabály:** GET `/api/merchant/prices` read path = **Postgres**. Shoprenter = írás + ritka full sync (stale / `?resync=1`).

---

## 2. Adatmodell

- `sql/022_partner_group_prices.sql`
  - `partner_group_prices` — shop × csoport × termék fix nettó + `sr_price_id`
  - `partner_group_price_sync` — `synced_at`, `row_count`, `last_error`
- Lib: `src/lib/commerce/group-price-mirror.ts`
- Write-through: `PUT` + `POST .../bulk` → SR majd local upsert/delete

**Frissesség:** default **5 perc** (`GROUP_PRICE_MIRROR_MAX_AGE_MS`). Közben page flip = 0 SR group-price hívás.

---

## 3. Hot path (meleg)

1. `listCustomerGroups` — process cache ~45 s  
2. `ensureGroupPriceMirror` — **skip** ha friss  
3. `listCatalogPage` + manufacturers (60 s cache) + counts — SQL  
4. `mapMirroredPricesForInners` — SQL `= any(int[])`  
5. Nincs `healMissingNames`, nincs N× find, nincs SR `countGroupPrices`

Debug: `GET ...&debug=1` → `_timing` JSON + server log.

Kényszer sync: `...?resync=1`.

---

## 4. Siker kritérium

| Mérés | Cél |
|-------|-----|
| Meleg GET p95 (`ensureMirror` skipped) | **&lt; 200 ms** |
| Hideg első sync / csoport | egyszeri SR list (elfogadott) |
| Page flip 2–N | **&lt; 200 ms**, `mirror.skipped: true` |
| SR hívás / meleg page | **0** group-price endpoint |

---

## 5. Bench

```bash
cd b2b-portal
# migráció (egyszer):
psql "$DATABASE_URL" -f sql/022_partner_group_prices.sql

npx tsx scripts/bench-arak-prices.ts
```

A script: SQL path timing + (ha van shop+creds) hideg sync vs meleg re-read összevetés.

### Mért eredmény (2026-08-25, `vasalatmester`, 8573 aktív SKU)

| Mérés | Eredmény |
|-------|----------|
| `listCatalogPage` 50 sor | ~120 ms |
| Hideg mirror sync (SR → DB, 1 fix ár) | **229 ms** egyszer |
| Meleg path (ensure skip + catalog + map + count) ×3 | **197 / 197 / 198 ms** |
| Cél meleg p95 | &lt; 200 ms → **PASS** |
| Legacy becslés (50× findGroupPrice) | ~4290 ms |

UI: `GET /api/merchant/prices?...&debug=1` → `_timing` a válaszban.