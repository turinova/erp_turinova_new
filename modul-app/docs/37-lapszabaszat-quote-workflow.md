# 37 — Lapszabászat árajánlat → gyártás workflow

**Route:** `/ajanlatok`, `/ajanlatok/[id]`, `/ajanlatok/bizonylatok`, `/megrendelesek`, `/scanner`, `/opti`  
**Tábla:** `quotes` (ugyanaz a sor végig)  
**Kapcsolat:** [23](23-lapszabaszat-addon.md), [36](36-szamlazas-workflow.md)  
**Nem ez:** termék árajánlat [32](32-arajanlat-workflow.md) (`/ertekesitesek/arajanlatok`)

---

## 0. Egy mondat

> Opti konfigurál → piszkozat ajánlat → **megrendelés** (szám) → **gyártásba adás** (gép/nap/barcode) → műhely **kész** → ügyfél **átadás** (+ opcionális befizetés / SMS).

---

## 1. Státuszgép

| Státusz | HU | Következő fő lépés | Hol |
|---|---|---|---|
| `draft` | Piszkozat | Megrendelés létrehozása | Detail |
| `ordered` | Megrendelve | Gyártásba adás | Detail / lista |
| `in_production` | Gyártásban | Készre jelöl | **Detail** / lista / scanner |
| `ready` | Kész | Átadás | **Detail** / lista / scanner |
| `finished` | Lezárva | — | PDF; opcionális **átvételi blokk** nyomtatás átadáskor ([43](43-atveteli-blokk.md)) |
| `cancelled` | Törölve | — | UI ritka; lista „törlés” = soft-delete |

**Fizetés** külön tengely (`not_paid` / `partial` / `paid`) — nem váltja a gyártási státuszt. Detailen: külön `#fizetesek` szekció; a Műveletek csak deep-link.

---

## 2. Detail certainty (zárolt UX)

1. **Stepper** + „Következő: …” minden staff státuszban.  
2. **H1:** van `order_number` → `Megrendelés: {order#}` + hint `Árajánlat {quote#}`; különben `Árajánlat: {quote#}`.  
3. **Egy primary** a státusz szerint (Kész / Átadás is a detailen).  
4. Jobb sáv: Következő lépés → Pénzügy (csak „Befizetések →” / „Bizonylatok →”) → (Gyártás) → Dokumentumok → Szerkesztés.

---

## 3. Gyártásba adás

Nem új entitás. Ugyanaz a `quotes` sor:

- `production_machine_id`, `production_date`, `barcode`
- `status = in_production`

Clear → vissza `ordered`.

---

## 4. Hol mit csinálj

| Művelet | Detail | Megrendelések | Scanner |
|---|---|---|---|
| Megrendelés | ✓ | — | — |
| Gyártásba adás | ✓ | ✓ | — |
| Kész (+ SMS) | ✓ | ✓ | ✓ |
| Átadás (+ hátralék) | ✓ | ✓ | ✓ |

---

## 5. Árajánlat összesítő — Mennyiség (main-app parity)

Kiírás: `(charged_sqm / waste_multi) m² / boards_charged db`.

| Mező | Jelentés |
|---|---|
| `boards_charged` | Csak `full_board` táblák száma |
| `charged_sqm` | **Csak** `panel_area` charged m² (waste már benne); full-board area **nincs** benne |

Snapshot: `materialLineFromPricing`. Backfill: `20260587_quote_material_charged_sqm_panel_only.sql`.

---

## 6. Partner

Draft beküldés → staff **Online** badge → ugyanaz a pipeline staff oldalon.

---

## 7. Számlázás (P0)

Kapcsolat: [36](36-szamlazas-workflow.md). Forrás: `related_source_type = opti_order`, id = `quotes.id`.

| Döntés | Érték |
|---|---|
| Végszámla guard | Csak **paid** (unpaid végszámla tilt — mint sale) |
| Díjbekérő | Unpaid + 0 doksi; paid mellett **tilt** |
| Előleg | Unpaid; összeg ≤ hátralék |
| Tételek | Default **összesített**; **Részletes** = anyagonként. Mennyiség = `boards×boardArea + charged_sqm/waste` **m²** (hulladék **nem** a qty-ban, hanem az egységárban) |
| Billing | `quotes.billing_*_snapshot` |
| UX | 6a — Pénzügy secondary; gyártás primary érintetlen |
| Fizetési mód | Díjbekérő = **csak átutalás**; előleg/számla = KP/kártya/utalás |
| CTA | `quoteInvoiceCtaLabel` — pl. „Díjbekérő kiállítása” / „Előlegszámla…” / „Végszámla…” |

Preview kötelező → Kiállítás. Aktív végszámlánál billing zárolt. Helper: `resolveQuoteInvoiceKindOptions` + `assertCanIssue` (`issue-quote.ts`).

**Fizmod ≠ ERP befizetés:** a dialógus `<fizmod>` csak a papíron; pénzmozgás = „Befizetés rögzítése”.

**Bizonylatok UX (sale parity):**
- Detail alján **`#fizetesek`** — státusz, chippek, napló, **Befizetés rögzítése** (egy hely)
- Detail alján **`#bizonylatok`** (`SourceInvoicesSection`) — kiállítás CTA + PDF / sztornó (egy hely)
- Számlázási adatok szerkesztése: bal oldali InfoCard (nem a Műveletekben)
- Műveletek Pénzügy: csak deep-link (`Befizetések →` / `Bizonylatok →`) — nincs gomb-duplikáció
- Nav Lapszabászat → Megrendelések / Ajánlatok. Lista: **Pénzügy → Bizonylatok** (`/szamlak?source=opti_order`).
- Kiállítás dialógus: **Tételek** = Összesített (default) | Részletes (anyagonként); előleg / részösszegű díjbekérőnél rejtve
