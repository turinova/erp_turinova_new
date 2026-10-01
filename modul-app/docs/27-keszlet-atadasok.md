# 27 — Készlet: áttárolás + mozgások + nyitó

**Státusz:** áttárolás + mozgások implementált; **nyitó készlet (P0)** implementált.  
**Route:** `/keszlet/atadasok`, `/keszlet/mozgasok`, `/keszlet/nyito`  
**Migráció:** `20260508_stock_transfers_and_movements.sql`, `20260578_opening_stock.sql`  
**Kapcsolat:** [24-beszerzes-workflow.md](24-beszerzes-workflow.md), [25-warehouses.md](25-warehouses.md), [26-beerkezesek.md](26-beerkezesek.md)

---

## 0. Egy mondat

> **Áttárolás** = készlet azonnal A raktárból B-be. **Mozgások** = ledger lista. **Nyitó készlet** = PDA séta: scan → qty → `adjustment` IN (induláshoz).

---

## 1. Zárolt döntések (v1 + nyitó P0)

1. **Azonnali** átadás — nincs draft, nincs in-transit (az v2).
2. Egy RPC: `create_stock_transfer` — validál → header + items + 2× `stock_movements` (`source_type = transfer`).
3. Negatív készlet tilos a forráson (`accessory_on_hand`).
4. Lista limit **25**, URL page/szűrő.
5. ≥2 aktív raktár kell az „Új áttárolás”-hoz.
6. Irreverzibilis (mint bevételezés) — korrekció = `adjustment`.
7. **Nyitó készlet (P0):** PDA / Chrome–Brave; wedge scanner; egy primary **Készlet rögzítése**; soft stock (meglévő qty mellett is hozzáad, figyelmeztetéssel); termék + (lapszab) tábla/szálas; RPC `commit_opening_stock`.
8. Nyitó ≠ teljes leltár — nincs review/approve/diff (az P1).

---

## 2. UI

| Képernyő | Primary |
|---|---|
| Nyitó készlet | **Készlet rögzítése** |
| Áttárolások lista | Új áttárolás |
| Új áttárolás | **Átadás rögzítése** |
| Áttárolás detail | — (olvasás) |
| Mozgások | — (szűrők) |

Termék detail Készlet szekció: **Áttárolás** link (`?accessoryId=&fromWarehouseId=`).

**Nyitó PDA UX:** `100dvh − topbar` flex shell (nincs page scroll); idle = lista scroll + footer Rögzítés; qty = lista rejtve, RF azonosító-skála (kép ~176–192px, név 22px, SKU 18px ink, on-hand 36–40px, qty h-14, gombok h-12); no-focus wedge; soft stock.

---

## 3. Következő fázisok

| Fázis | Mit |
|---|---|
| **v2** | In-transit (küldés → úton → fogadás) |
| **P1 Leltár** | Session + gép vs számolt + submit/approve (Shopify/Lightspeed minta) |
| **v1.5** | Raktár detail: on-hand snapshot + mozgások |

---

## 4. Migráció

Futtasd: `20260508_…`, `20260578_opening_stock.sql` (SQL Editor vagy CLI).
