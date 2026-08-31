# B2B portál — partnerár-stratégiák (terv)

**Scope:** `b2b-portal` merchant oldal (`/arak`, widget resolve, vevőcsoportok)  
**Státusz:** **Tervezési dokumentum** — implementáció csak explicit GO után  
**Dátum:** 2026-08-24  
**Verzió:** 1.0

Kapcsolódó:

| Dokumentum | Szerep |
|------------|--------|
| [`PRICES_S0.md`](./PRICES_S0.md) | Shoprenter viselkedés mérése (GO/NO-GO kapu) |
| [`PLATFORM_AND_ADMIN_IMPLEMENTATION.md`](./PLATFORM_AND_ADMIN_IMPLEMENTATION.md) | D9 resolve-live, D16 árrés, M8 economics, katalógus séma |
| [`PRICING.md`](./PRICING.md) | **Plugin csomag-ár** (Start/Plus/Pro) — ne keverd a partnerár-stratégiákkal |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | UI: radius 0, kompakt sorok, hover kép |
| [`ARAK_GUIDE_PLAN.md`](./ARAK_GUIDE_PLAN.md) | Merchant útmutató IA + edge case (GO) |
| [`ARAK_MERCHANT_GUIDE.md`](./ARAK_MERCHANT_GUIDE.md) | Merchant-facing copy forrás |

---

## Tartalom

1. [Mi ez a dokumentum](#1-mi-ez-a-dokumentum)
2. [Mi a termék határa](#2-mi-a-termék-határa)
3. [Alapelvek](#3-alapelvek)
4. [Ár-precedencia (egy igazság)](#4-ár-precedencia-egy-igazság)
5. [Stratégia-katalógus](#5-stratégia-katalógus)
6. [Nettó és bruttó megjelenítés](#6-nettó-és-bruttó-megjelenítés)
7. [Economics: beszerzés, árrés, cost-plus](#7-economics-beszerzés-árrés-cost-plus)
8. [Piaci benchmark](#8-piaci-benchmark)
9. [Fázistervezés](#9-fázistervezés)
10. [Adatmodell és API](#10-adatmodell-és-api)
11. [UX irányelvek (`/arak`)](#11-ux-irányelvek-arak)
12. [Plan-kapuk és ERP határ](#12-plan-kapuk-és-erp-határ)
13. [Szándékosan nem csináljuk](#13-szándékosan-nem-csináljuk)
14. [Nyitott kérdések és kockázatok](#14-nyitott-kérdések-és-kockázatok)
15. [Implementációs GO checklist](#15-implementációs-go-checklist)

---

## 1. Mi ez a dokumentum

Ez a fájl rögzíti, **milyen partnerár-stratégiákat** tervezünk beépíteni a Turinova B2B portálba, hogy a nagykereskedő:

- vevőcsoportonként kezelje a B2B árakat,
- ugyanazt az árat lássa a portálon, mint amit a Shoprenter bolt ad a partnernek,
- egyszerűen tudjon tárgyalni (lista −%, fix ár, mennyiségi sáv),
- döntéskor lássa a nettó/bruttó párost (és később az árrés-asszisztenst).

**Nem tartalmaz kódot.** A [`PRICES_S0.md`](./PRICES_S0.md) kitöltése előtt nem szállítunk új SR-író funkciót.

---

## 2. Mi a termék határa

Három réteg — ne keverd:

| Réteg | Ki állítja az árat | Turinova szerepe |
|-------|-------------------|------------------|
| **Shoprenter bolt** | Merchant admin + SR API | Forrás igazság a vevő felé |
| **B2B portál (`/arak`)** | Merchant a portálon | SR-be ír / olvas; nem második ár-rendszer |
| **Turinova ERP (később)** | Teljes fulfillment | Mély árrés, NRR, készlet, számla — [`PRICING.md`](./PRICING.md) §8.3 |

A widget **resolve-live** (D9): typeahead listaár DB-ből OK; pontos csoportár = adapter hívás rendeléskor.

---

## 3. Alapelvek

### 3.1 „15 éves teszt”

Minden stratégia egy mondatban érthető legyen. Ha magyarázó szöveg kell hozzá a fő UI-ban, a stratégia túl bonyolult vagy rossz helyen van.

### 3.2 Shoprenter-first

Amit a Shoprenter natívan támogat → **oda írunk** (`customerGroups`, `customerGroupProductPrices`, termék akciók / special).

Amit nem → **portál-asszisztens** (számol, javasol), mentéskor **fix nettó ár** vagy **%** megy SR-be.

### 3.3 Egy precedencia-sorrend

A bolt, a widget és a portál ugyanazt a „melyik ár győz” szabályt használja. Alapértelmezés (S0 után igazítandó):

```
saját csoportár (fix)  >  mennyiségi sáv (special/tier)  >  csoport %  >  listaár
```

Forráskód terv: `src/lib/merchant/pricing-engine.ts`.

### 3.4 Nettó a belső igazság

Magyar B2B: tárgyalás **nettóban**. A **bruttó** megjelenítés segít ellenőrizni (számla, bolt UI), de mentés és SR API **nettó** (kivéve, ha SR explicit bruttót vár — S0-ban rögzítendő).

### 3.5 Nem automatikus cost-plus

A Shoprenter **költség mezője admin-only**, nincs natív „beszer + 25% minden termékre” motor. Cost-plus **javaslat**, nem háttér-szinkron újraszámolás.

---

## 4. Ár-precedencia (egy igazság)

| Prioritás | Forrás | `priceSource` | Shoprenter |
|-----------|--------|---------------|------------|
| 1 | Termék × csoport fix nettó | `own` | `customerGroupProductPrices` |
| 2 | Mennyiségi / időszakos sáv | `tier` / `special` | Termék → Akciók / `productSpecials` |
| 3 | Vevőcsoport globális % | `percent` | `customerGroups.percentDiscount` |
| 4 | Bolti listaár | `list` | Termék `price` |

**Több fix ár ugyanarra a csoportra:** SR szabály = **legalacsonyabb** érvényes (Shoprenter Akadémia).

**Csoport % + fix ár:** fix győz (terv; S0.2 validálja).

**`percentDiscountSpecialPrices`:** ha true, a csoport % az akciós (special) árra is vonatkozik — külön csoport-beállítás, UI-ban checkbox (P2).

---

## 5. Stratégia-katalógus

Minden stratégia: **ID**, leírás, SR natív?, portál fázis, plan, státusz.

**Státusz jelölés:** ✅ kész · 🔨 részben · 📋 terv · ⛔ nem · ❓ S0 függő

---

### P-01 — Bolti listaár (referencia)

| | |
|--|--|
| **Leírás** | Alap nettó ár, amiből a kedvezmények számolódnak. |
| **Képlet** | SR termék ár |
| **Shoprenter** | ✅ Natív |
| **Portál** | `/arak` „Bolti” oszlop; csak olvasás |
| **Fázis** | **P0** (S1a) |
| **Plan** | Start+ |
| **Státusz** | ✅ |

---

### P-02 — Vevőcsoport globális % kedvezmény

| | |
|--|--|
| **Leírás** | „Minden termékre −15%” a csoport összes tagjának. |
| **Képlet** | `lista × (1 − p/100)` |
| **Shoprenter** | ✅ `customerGroups.percentDiscount` |
| **Portál** | Sidebar csoportkártya slider; debounced mentés |
| **Fázis** | **P0** (S1a) |
| **Plan** | Start+ |
| **Státusz** | ✅ |
| **UX megjegyzés** | Ez **nem** bulk kijelölés — az egész csoportra vonatkozik. Bulk = P-03 asszisztens. |

---

### P-03 — Fix csoportár termékenként

| | |
|--|--|
| **Leírás** | Egy SKU-ra egy konkrét nettó ár adott csoportban (felülírja a %-ot). |
| **Képlet** | Explicit `priceNet` |
| **Shoprenter** | ✅ `customerGroupProductPrices` |
| **Portál** | `/arak` ár cella katt → inline szerkesztés; „Fix áras” tab |
| **Fázis** | **P0** (S1a) |
| **Plan** | Start+ |
| **Státusz** | ✅ |
| **Törlés** | Üres mentés / bulk „Törlés” → DELETE SR rekord → visszaesik P-02-re |

---

### P-04 — Listaár − X% (egyedi vagy bulk)

| | |
|--|--|
| **Leírás** | „−10 / −15 / −20% a bolti árból” kijelölt termékekre; eredmény **fix árként** mentődik. |
| **Képlet** | `round(lista × (1 − x/100))` → P-03 |
| **Shoprenter** | ✅ Indirekt (fix ár = számolt nettó) |
| **Portál** | Bulk mód lebegő sáv (−10/15/20%, Törlés) |
| **Fázis** | **P0** (S1b) |
| **Plan** | Start+ |
| **Státusz** | ✅ |

---

### P-05 — Szerkesztő mód választó (fix / % / −% lista)

| | |
|--|--|
| **Leírás** | Egy cellánál 3 rádió: (1) csoport % szerint, (2) fix nettó, (3) lista − X%. Csökkenti a félreértést P-02 vs P-03 között. |
| **Shoprenter** | ✅ Kombináció P-02 + P-03 |
| **Portál** | Popover / mini panel ár cellánál |
| **Fázis** | **P1** (S1d) |
| **Plan** | Start+ |
| **Státusz** | 📋 |

---

### P-06 — Mennyiségi ársáv (volume / tier)

| | |
|--|--|
| **Leírás** | 1–9 db lista/%, 10+ db olcsóbb fix ár. |
| **Képlet** | `productSpecial` minQuantity szerint |
| **Shoprenter** | ✅ Termék → Akciók / mennyiségi kedvezmény; API: `productSpecials` |
| **Portál** | `/arak` sor expand vagy „Sávok” mini tábla; SR-be ír |
| **Fázis** | **P2** (S2) |
| **Plan** | Start+ |
| **Státusz** | ✅ (UI: Sáv panel → `productSpecials`) |
| **Függőség** | S0.4, S0.6, S0.7 |

---

### P-07 — Időszakos csoport-akció

| | |
|--|--|
| **Leírás** | Dátumtól-dátumig érvényes ár vagy % adott csoportra (pl. Q4 kampány). |
| **Shoprenter** | ✅ Termék → Akciók fül, vevőcsoport + dateFrom/dateTo |
| **Portál** | Kampány nézet vagy termék-sor „Időszak” mezők |
| **Fázis** | **P3** (S2+) |
| **Plan** | Plus+ (terv — nem végleges) |
| **Státusz** | 📋 |

---

### P-08 — Csoport % az akciós árra is

| | |
|--|--|
| **Leírás** | A globális csoport % a special/akciós árra számít, nem a listára. |
| **Shoprenter** | ✅ `percentDiscountSpecialPrices` |
| **Portál** | Csoport kártya checkbox: „Kedvezmény az akciós árra is” |
| **Fázis** | **P2** |
| **Plan** | Start+ |
| **Státusz** | 📋 (API write kész: `customer-groups-write.ts`) |

---

### P-09 — MOQ / lépésköz (mennyiségi szabály)

| | |
|--|--|
| **Leírás** | Min. rendelési egység, csomagolási lépés (pl. 6 db). **Nem ár**, de árazással együtt jelenik meg. |
| **Shoprenter** | ✅ Termék pack / min qty |
| **Portál** | Katalógus sync → `min_qty`, `qty_step`; widget figyelmeztet |
| **Fázis** | **P1** (katalógus már syncel) |
| **Plan** | Start+ |
| **Státusz** | 🔨 (DB sync ✅, `/arak`-on opcionális oszlop 📋) |

---

### P-10 — Cost-plus asszisztens (beszer + árrés %)

| | |
|--|--|
| **Leírás** | Merchant megadja: „25% árrés a beszerzésen”; a portál **javasol** nettó árat: `cost × (1 + margin/100)`. Mentés = P-03 fix ár. |
| **Képlet** | `javasoltNet = round(costNet × (1 + m/100))` |
| **Shoprenter** | ⛔ Nincs natív automatikus cost-plus |
| **Portál** | Szerkesztő panel „Beszer + …%” tab; sorban cost + effektív árrés % olvasás |
| **Fázis** | **P1** |
| **Plan** | **❓ döntés szükséges** — lásd [§12](#12-plan-kapuk-és-erp-határ) |
| **Státusz** | ✅ (bulk `cost_plus` + szerkesztő +20/+25%) |

---

### P-11 — Minimum árrés figyelmeztetés (floor)

| | |
|--|--|
| **Leírás** | Ha effektív ár alatt van a beállított min. árrés %, sárga figyelmeztetés (nem blokkol). |
| **Képlet** | `(effectiveNet − cost) / effectiveNet < floor` |
| **Shoprenter** | ⛔ |
| **Portál** | Sor badge / tooltip |
| **Fázis** | **P2** |
| **Plan** | Pro vagy ERP |
| **Státusz** | ✅ (Árazás: Min. árrés %, sárga !) |

---

### P-12 — Kategória-szintű %

| | |
|--|--|
| **Leírás** | „Minden szerszám −20%” kategória alapján. |
| **Shoprenter** | ⛔ Natívan nincs csoport×kategória % |
| **Portál** | Bulk: kategória szűrő + P-04 bulk |
| **Fázis** | **P2** (kategória sync + szűrő + bulk) |
| **Plan** | Start+ |
| **Státusz** | ✅ sync `023` · `/arak` kategória elsődleges szűrő · bulk |

---

### P-13 — Excel / CSV import-export árak

| | |
|--|--|
| **Leírás** | Csoportárak tömeges feltöltése cikkszám alapján (Shoprenter is támogatja export/import). |
| **Shoprenter** | ✅ Admin export/import |
| **Portál** | Feltöltés → validál → batch SR upsert |
| **Fázis** | **P3** (S3) |
| **Plan** | Plus+ |
| **Státusz** | 📋 |

---

### P-14 — Ár-előzmény / audit log

| | |
|--|--|
| **Leírás** | Ki, mikor, milyen árat állított (compliance, vita). |
| **Shoprenter** | Részleges (admin log) |
| **Portál** | `price_change_log` tábla |
| **Fázis** | **P3** |
| **Plan** | Pro / Egyedi |
| **Státusz** | 📋 |

---

### P-15 — Deviza / több pénznem

| | |
|--|--|
| **Leírás** | EUR lista, HUF számla. |
| **Shoprenter** | Korlátozott multi-currency |
| **Portál** | — |
| **Fázis** | — |
| **Státusz** | ⛔ v1 HU Fókusz |

---

### Összefoglaló tábla

| ID | Stratégia | Fázis | Plan | Státusz |
|----|-----------|-------|------|---------|
| P-01 | Listaár (referencia) | P0 | Start+ | ✅ |
| P-02 | Csoport % | P0 | Start+ | ✅ |
| P-03 | Fix csoportár | P0 | Start+ | ✅ |
| P-04 | Lista − X% bulk | P0 | Start+ | ✅ |
| P-05 | 3 mód szerkesztő | P1 | Start+ | 📋 |
| P-06 | Mennyiségi sáv | P2 | Start+ | ✅ |
| P-07 | Időszakos akció | P3 | Plus+ | 📋 |
| P-08 | % az akciós árra | P2 | Start+ | 📋 |
| P-09 | MOQ / lépés | P1 | Start+ | 🔨 |
| P-10 | Cost-plus asszisztens | P1 | Start+ | ✅ |
| P-11 | Min. árrés figyelmeztetés | P2 | Start+ | ✅ |
| P-12 | Kategória / márka szűrt bulk | ✅ kategória + márka | Start+ | ✅ |
| P-13 | Excel import | P3 | Plus+ | 📋 |
| P-14 | Audit log | P3 | Pro | 📋 |
| P-15 | Deviza | — | — | ⛔ |

---

## 6. Nettó és bruttó megjelenítés

### 6.1 Követelmény

Minden ár-oszlopban **nettó az elsődleges**, alatta vagy mellette **bruttó** kisebb típussal.

Példa:

```
Bolti:  12 500 Ft
        15 875 Ft bruttó

Ár:     10 625 Ft  [−15%]
        13 494 Ft bruttó
```

### 6.2 Számítás

```
bruttó = round(nettó × (1 + vatRate / 100))
```

- **Widget** már számol: `src/lib/shoprenter/api.ts` (`resolveVatRate`, `formatPriceBundle`).
- **`/arak` API** jelenleg csak nettót ad — bővítendő: `listPriceGross`, `effectiveGross`, `vatRate`.

### 6.3 ÁFA forrás

| Megoldás | Előny | Hátrány |
|----------|-------|---------|
| **A)** Sync `vat_rate` katalógusba (`taxClass` SR-ből) | Gyors lista, pontos termékenként | Migráció + sync |
| **B)** Default 27% minden sor | Azonnali | Hibás 5%/18% termékeknél |
| **C)** Lazy SR fetch termékenként | Pontos | Lassú, 429 |

**Terv:** **A)** P1-ben; addig **B)** + tooltip „ÁFA: 27% (becsült)” ha nincs sync.

### 6.4 Fázis

| Elem | Fázis |
|------|-------|
| Nettó + bruttó oszlopok UI | **P1** |
| `vat_rate` katalógus sync | **P1** |
| ÁFA badge eltérésnél | **P1** |

---

## 7. Economics: beszerzés, árrés, cost-plus

### 7.1 Adat

- Shoprenter `cost` → `product_catalog.cost_net` (sync ✅).
- Vevő **nem látja** a cost-ot (SR szabály).

### 7.2 Megjelenítés terv (`/arak`)

| Mező | Jelentés | Fázis |
|------|----------|-------|
| `costNet` | Beszerzési nettó | P1 (opcionális oszlop / hover) |
| `marginPct` | `(effectiveNet − cost) / effectiveNet × 100` | P1 |
| `marginNet` | `effectiveNet − cost` | P1 |

Ha nincs cost: „—” + link „Töltsd ki a Shoprenterben”.

### 7.3 Cost-plus vs kedvezmény

| Művelet | Mit csinál |
|---------|------------|
| **Csoport −15%** (P-02) | Listaárból számol — **nem** cost-ból |
| **Cost + 25%** (P-10) | Javasolt fix ár cost-ból — **nem** automatikus újraszámolás |
| **Bulk −15%** (P-04) | Lista −15% → fix ár |

A merchantnek explicit választania kell a módot (P-05).

### 7.4 Product döntés: plugin vs ERP

[`PRICING.md`](./PRICING.md) §8.3: mély árrés / NRR / alvó vevő = **ERP horog**, nem plugin Pro.

[`PLATFORM_AND_ADMIN_IMPLEMENTATION.md`](./PLATFORM_AND_ADMIN_IMPLEMENTATION.md) D16 / M8: cost → **Pro riport**.

**Javasolt kompromisszum (lezárandó):**

| Funkció | Hol |
|---------|-----|
| Cost + árrés **oszlop** árazás közben (`/arak`) | Plugin **P1** — döntéstámogatás, nem riport |
| Csoport profitabilitás, NRR, alvó vevő | ERP |
| Coverage % dashboard | ERP vagy Pro home mini-KPI (M8) |

---

## 8. Piaci benchmark

### 8.1 Shoprenter (natív bolt)

| Stratégia | SR |
|-----------|-----|
| Vevőcsoport % | ✅ |
| Fix csoportár termékenként | ✅ |
| Több ár → legalacsonyabb győz | ✅ |
| Mennyiségi kedvezmény | ✅ |
| Időszakos akció csoportonként | ✅ |
| Beszerzési ár (admin) | ✅ |
| Cost-plus automatikus | ⛔ |
| Kategória % csoportra | ⛔ |

### 8.2 Shopify B2B (Plus + appok)

| Stratégia | Natív Plus | Wholesale app |
|-----------|------------|---------------|
| Price list fix / % | ✅ | ✅ |
| Volume breaks (≤10/variáns) | ✅ | ✅ |
| Quantity rules (MOQ, lépés) | ✅ | ✅ |
| Company-specific lista | ✅ | ✅ |
| Ex-VAT (nettó) megjelenítés | ✅ | ✅ |
| Cost-plus / margin floor | ⛔ | Részleges app |
| Tag-alapú tier | App | ✅ |

**Tanulság:** 2–3 vevőtier elég; a mi P-02…P-06 csomag lefedi a CEE nagyker 80%-át.

### 8.3 Turinova cél-pozíció

Shoprenter **ár-igazság** + portál **gyors szerkesztés** (Shopify Wholesale UX) + widget **gyors rendelés**. Nem CPQ, nem ERP árazó motor.

---

## 9. Fázistervezés

```
P0 (S1a/b) ──► P1 (S1c/d) ──► P2 (S2) ──► P3 (S3+) ──► ERP economics
     │              │              │              │
  % fix bulk    nettó/bruttó   sávok P-06    import P-13
  ✅ kész       cost P-10      P-08 P-11     audit P-14
                P-05 P-09
```

### P0 — Alap árazás (GO: S0 pipálva)

- P-01 … P-04 ✅
- Csoport CRUD, `/arak` UI
- Engine precedencia

**Done when:** demo shopon S0.1–S0.5 zöld; merchant 1 csoport % + 3 fix árat beállít; boltban ugyanaz látszik.

### P1 — Megjelenítés + szerkesztő intelligencia

- P-05, P-06 UI alap nélkül: P-05, P-09 oszlop
- §6 nettó/bruttó + `vat_rate` sync
- P-10 cost-plus asszisztens (ha product GO)
- Hover kép, kompakt sorok ✅

**Done when:** merchant lát nettó/bruttót; cost-ból javasolt árat egy kattintással menthet fixként.

### P2 — Haladó SR-stratégiák

- P-06 mennyiségi sávok
- P-08 `percentDiscountSpecialPrices`
- P-11 min. árrés figyelmeztetés (ha Pro GO)

**Done when:** 10+ db sáv boltban és portálon egyezik; S0.4 zöld.

### P3 — Tömeges és governance

- P-07 időszakos akció (opcionális)
- P-13 Excel import
- P-14 audit log

### P4 — ERP

- Csoport profitabilitás, NRR, teljes economics — külön termék

---

## 10. Adatmodell és API

### 10.1 Meglévő (`product_catalog`)

| Oszlop | Használat |
|--------|-----------|
| `list_price_net` | P-01 |
| `cost_net` | P-10, P-11 |
| `image_url` | UX |
| `min_qty`, `qty_step` | P-09 |

### 10.2 Tervezett bővítés

| Oszlop / mező | Fázis | Cél |
|---------------|-------|-----|
| `vat_rate` | P1 | Bruttó számítás |
| `price_change_log` tábla | P3 | P-14 |

### 10.3 API (`/api/merchant/prices`)

**GET bővítés (P1):**

```json
{
  "listPriceNet": 12500,
  "listPriceGross": 15875,
  "effectiveNet": 10625,
  "effectiveGross": 13494,
  "vatRate": 27,
  "costNet": 8200,
  "marginPct": 22.8,
  "priceSource": "percent"
}
```

**POST:** változatlan elv — `priceNet` | null (törlés) | csoport % külön endpoint.

**Bulk POST** (`/api/merchant/prices/bulk`): P-04 ✅.

### 10.4 Shoprenter írási végpontok

| Művelet | SR API |
|---------|--------|
| Csoport % | `PUT customerGroups/{id}` |
| Fix ár | `POST/PUT/DELETE customerGroupProductPrices` |
| Mennyiségi sáv | Termék `productSpecials` (S2 — pontos path S0) |
| Csoport létrehozás | `POST customerGroups` ✅ |

---

## 11. UX irányelvek (`/arak`)

### 11.0 Információs architektúra (2026-08-25)

| Útvonal | Szerep |
|---------|--------|
| `/arak` | **Árazás** — szerkesztő (csoportok + terméklista) |
| `/arak/utmutato` | **Útmutató** — 5 stratégia merchant guide (nincs first-visit banner) |

Sidebar: **Árak** szülő → Árazás + Útmutató. Részletek: [`ARAK_GUIDE_PLAN.md`](./ARAK_GUIDE_PLAN.md).

### 11.1 Layout (2026-08-25 UX)

- Bal: vevőcsoport választó (név + −% badge) — **slider a Szabály fülön**
- Jobb: **3 fül** — Szabály · Kivételek · Sávok
- Status bar: „lista −X% · N fix · Sávok”
- Kivételek oszlopok: Termék · Bolti · Partner · Árrés (egyszerűsítve)
- Checkbox **mindig** a Kivételeken; sticky bulk kijelöléskor (nincs „Több” mód)
- Sávok: külön fül + drawer (`VolumeTiersPanel`)
- CSV: fix árak export + aktuális oldal

Részletek: [`ARAK_UX_PLAN.md`](./ARAK_UX_PLAN.md).

### 11.2 Interakciók

| Akció | Viselkedés |
|-------|------------|
| Szabály slider | Optimistic + debounced SR |
| Kivétel cella | Inline fix nettó; +20/+25% cost chip |
| Bulk / márka | Lista −% · Beszer+% · törlés |
| Sávok fül | Termék → Sáv drawer |
| CSV fix | Összes own group price oldalazva |

### 11.3 Copy (rövid)

- Csoport %: „Az egész csoport termékeire vonatkozik, kivéve a fix árasakat.”
- Fix: „Felülírja a csoport kedvezményt.”
- Bulk: „A kijelöltekre fix árat állít (lista − X%).”
- Teljes guide: [`ARAK_MERCHANT_GUIDE.md`](./ARAK_MERCHANT_GUIDE.md) / `/arak/utmutato`

---

## 12. Plan-kapuk és ERP határ

### 12.1 Plugin csomagok ([`PRICING_V6_CURRENT.md`](./PRICING_V6_CURRENT.md))

| Funkció | start | plus/pro | Próba |
|---------|-------|----------|-------|
| P-01…P-04 árazás | ✅ | ✅ | ✅ |
| P-06 mennyiségi sáv | ✅ | ✅ | ✅ |
| Widget modulok (kereső, excel, kép, …) | ✅ | ✅ | ✅ |
| Turinova felirat elrejtése | — | ✅ (fizetős) | soha |
| Portál vevő soft cap | 500 | 500 | 500 |
| Mély árrés riport / NRR | — | — | — (ERP) |

### 12.2 Lezárandó product döntés

**Kérdés:** A cost/árrés oszlop minden fizetős csomagon látszik-e árazás közben, vagy Pro unlock?

| Opció | Indok |
|-------|-------|
| **A)** Minden plan | Egyszerűbb; árazás alapfunkció |
| **B)** Pro + tease | Illeszkedik PRICING §8.3 ERP horoghoz |
| **C)** Plus+ | Középút |

**Ajánlás:** **A)** a `/arak` cost/árrés **oszlopra** (csak olvasás, nem riport); **B)** a home KPI / NRR / csoport profitabilitásra.

---

## 13. Szándékosan nem csináljuk

| Elem | Miért |
|------|-------|
| Második ár-rendszer DB-ben | SR az igazság |
| Automatikus cost-plus szinkron minden éjjel | Meglepő árváltozás, support |
| CPQ / jóváhagyási workflow v1 | ERP / enterprise |
| Kategória % natív SR nélkül | Admin pokol (P-12 később bulk) |
| Bruttó mentés SR-be | Nettó az belső standard |
| Árazás a widget typeahead-ben | D9: csak resolve-kor pontos |
| 8+ vevőtier | Shopify tanulság: 2–3 elég |
| Deviza v1 | HU fókusz |

---

## 14. Nyitott kérdések és kockázatok

| # | Kérdés | Blokkol | Döntő |
|---|--------|---------|-------|
| Q1 | S0.2: fix vs % pontos SR viselkedés | P0 copy | Demo shop mérés |
| Q2 | Cost oszlop plan kapu (§12.2) | P1 | Product |
| Q3 | `vat_rate` sync vs 27% default | P1 pontosság | Eng |
| Q4 | `productSpecial` API shape (S0.6) | P2 | Demo shop |
| Q5 | Parent vs child ár (S0.7) | P0 write | Demo shop |
| Q6 | SR 429 párhuzamos heal | UX lassúság | Throttle/cache |
| Q7 | Fix áras tab: client vs server filter | ~~Nagy katalógus~~ | ✅ `ownOnly=1` server JOIN + lapozás |

**Kockázat:** Portál és bolt eltérő precedenciát mutat → S0 kötelező before scale.

---

## 15. Implementációs GO checklist

Mielőtt bármely fázis kódja merge-elődik:

- [ ] [`PRICES_S0.md`](./PRICES_S0.md) S0.1–S0.5 kitöltve demo shopon
- [ ] Precedencia rögzítve; ha ≠ „saját > tier > % > lista”, engine + doc frissítve
- [ ] OAuth write scope OK (S0.5)
- [ ] §12.2 cost oszlop plan döntés lezárva
- [ ] Nettó/bruttó + ÁFA stratégia (§6.3 A/B) kiválasztva
- [ ] UX copy §11.3 jóváhagyva (magyar, rövid)

---

## Változásnapló

| Verzió | Dátum | Változás |
|--------|-------|----------|
| 1.0 | 2026-08-24 | Első teljes stratégia-terv (P-01…P-15, fázisok, API, UX) |
