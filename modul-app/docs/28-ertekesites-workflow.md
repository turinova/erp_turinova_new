# 28 — Értékesítés workflow (Sale)

**Státusz:** S0/S1 implementálva (manuális azonnali eladás).  
**Route:** `/ertekesitesek`  
**Migráció:** `supabase/migrations/20260509_sales_orders.sql` (+ soft stock: `20260510_sale_soft_stock_allow.sql`)  
**Kapcsolat:** [24](24-beszerzes-workflow.md), [25](25-warehouses.md), [27](27-keszlet-atadasok.md)

---

## 0. Egy mondat

> Egy **Értékesítés** doksi = termékek + kedvezmények + fizetés(ek) + készletkiadás. Csatorna: manuális / POS / webshop — ugyanaz a mag.

**Nem** a lapszabászat megrendelés (`quotes` → gyártás). Az külön életút.

---

## 1. Fogalmak

| UI | DB | Jelentés |
|---|---|---|
| Értékesítés | `sales_orders` | Mit adtunk el |
| Tétel | `sales_order_items` | product \| fee |
| Díj | `fee_types` → fee item | Törzsadatból |
| Fizetés | `sales_payments` | 1..N mód |
| Csatorna | `channel` | `manual` \| `pos` \| `webshop` |
| Készlet | `stock_movements` `sale` / `out` | Kiadás |

---

## 2. S1 happy path (create UX)

```
[Raktár chip] [+ Ügyfél] → Kereső (katalógus + on_hand) → Kosár
→ Díj (fee_types) → Jobb panel: kedv. + fizetés → Confirm → fulfilled + stock out
```

**Layout:** 2 hasáb — bal kosár/kereső, jobb sticky összesítő + primary CTA.  
**Raktár:** kontextus (1 WH = label; több = select), nem wizard lépés.  
**Ügyfél:** opcionális chip + **Új ügyfél** gyors dialog (név + telefon).  
**Keresés:** teljes katalógus + aktuális WH készlet a találatban; opcionális „Csak készleten”.  
**0 készlet:** soft allow — UI figyelmeztet, RPC nem tilt; on_hand mehet negatívba.  
**Díj:** `[+ Díj]` dialog → `fee_types`; díj a kosár táblában.  
**Összesítés:** tételek / díjak / részösszeg / kedvezmény / **nettó** / **ÁFA** / fizetendő / készpénz kerekítés.

Primary: **Eladás rögzítése**.  
Szám: `E-YYYY-NNN`.  
Készpénz egyedül: magyar kerekítés.

Kedvezmény sorrend: sor → díjak (nincs sor kedv.) → globál → cash round.

---

## 3. Státusz

| status | S1 |
|---|---|
| `fulfilled` | Azonnali eladás (RPC) |
| `cancelled` / `returned` / `draft` / `confirmed` | későbbi fázis |

`payment_status`: unpaid \| partial \| paid (Σ ≥ due − 1 Ft).

---

## 4. Fázisok

| | Scope |
|---|---|
| **S1** | Manuális lista + create + detail — **kész** |
| **S2** | POS UI (`/pos`) — **P0+P1 kész** ([29](29-pos-workflow.md)) |
| **S3** | Számla provider + storno |
| **S4** | Webshop ingest (`external_ref`) + channel WH map |
| **S5** | Visszáru |

---

## 5. Migráció

Futtasd: `20260509_sales_orders.sql`.  
Ha a 20260509 már lefutott a régi hard stock blockkal: futtasd `20260510_sale_soft_stock_allow.sql`.
