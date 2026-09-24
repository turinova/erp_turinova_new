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
| `finished` | Lezárva | — | PDF |
| `cancelled` | Törölve | — | UI ritka; lista „törlés” = soft-delete |

**Fizetés** külön tengely (`not_paid` / `partial` / `paid`) — nem váltja a gyártási státuszt. Detailen: **secondary** a Pénzügy csoportban.

---

## 2. Detail certainty (zárolt UX)

1. **Stepper** + „Következő: …” minden staff státuszban.  
2. **H1:** van `order_number` → `Megrendelés: {order#}` + hint `Árajánlat {quote#}`; különben `Árajánlat: {quote#}`.  
3. **Egy primary** a státusz szerint (Kész / Átadás is a detailen).  
4. Jobb sáv: Következő lépés → Pénzügy → (Gyártás) → Dokumentumok → Szerkesztés.

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

## 5. Partner

Draft beküldés → staff **Online** badge → ugyanaz a pipeline staff oldalon.

---

## 6. Számlázás (P0)

Kapcsolat: [36](36-szamlazas-workflow.md). Forrás: `related_source_type = opti_order`, id = `quotes.id`.

| Döntés | Érték |
|---|---|
| Végszámla guard | **Nincs** paid/státusz korlát (van `order_number` → OK) |
| Díjbekérő | Kézi (Pénzügy secondary) |
| Tételek | Default **összesített**; dialógusban **Részletes** = anyagonként név + szabás/él m |
| Billing | `quotes.billing_*_snapshot` |
| UX | 6a — Pénzügy secondary; gyártás primary érintetlen |
| Fizetési mód | Mindhárom típusnál **választható**; default: ERP utolsó payment → különben átutalás |

Preview kötelező → Kiállítás. Aktív végszámlánál billing zárolt.

**Fizmod ≠ ERP befizetés:** a dialógus `<fizmod>` csak a papíron; pénzmozgás = „Befizetés rögzítése”.

**Bizonylatok UX (sale parity):**
- Detail alján **Bizonylatok** szekció (`SourceInvoicesSection`) — PDF / sztornó
- Pénzügy rail: lean CTA (Befizetés + számlázás), nincs mini lista
- Nav Lapszabászat → **Bizonylatok** → `/ajanlatok/bizonylatok` (`opti_order` only)
- Kiállítás dialógus: **Tételek** = Összesített (default) | Részletes (anyagonként); előleg / részösszegű díjbekérőnél rejtve
