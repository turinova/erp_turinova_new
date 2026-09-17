# 27 — Készlet: áttárolás + mozgások (v1)

**Státusz:** implementált (azonnali áttárolás).  
**Route:** `/keszlet/atadasok`, `/keszlet/mozgasok`  
**Migráció:** `supabase/migrations/20260508_stock_transfers_and_movements.sql`  
**Kapcsolat:** [24-beszerzes-workflow.md](24-beszerzes-workflow.md), [25-warehouses.md](25-warehouses.md), [26-beerkezesek.md](26-beerkezesek.md)

---

## 0. Egy mondat

> **Áttárolás** = készlet azonnal A raktárból B-be (ledger OUT + IN). **Mozgások** = a teljes ledger lista szűrőkkel.

---

## 1. Zárolt döntések (v1)

1. **Azonnali** átadás — nincs draft, nincs in-transit (az v2).
2. Egy RPC: `create_stock_transfer` — validál → header + items + 2× `stock_movements` (`source_type = transfer`).
3. Negatív készlet tilos a forráson (`accessory_on_hand`).
4. Lista limit **25**, URL page/szűrő.
5. ≥2 aktív raktár kell az „Új áttárolás”-hoz.
6. Irreverzibilis (mint bevételezés) — korrekció = későbbi `adjustment`.

---

## 2. UI

| Képernyő | Primary |
|---|---|
| Áttárolások lista | Új áttárolás |
| Új áttárolás | **Átadás rögzítése** |
| Áttárolás detail | — (olvasás) |
| Mozgások | — (szűrők) |

Termék detail Készlet szekció: **Áttárolás** link (`?accessoryId=&fromWarehouseId=`).

---

## 3. Következő fázisok

| Fázis | Mit |
|---|---|
| **v2** | In-transit (küldés → úton → fogadás) |
| **v3** | Korrekció (`adjustment`) UI |
| **v1.5** | Raktár detail: on-hand snapshot + mozgások |

---

## 4. Migráció

Futtasd: `20260508_stock_transfers_and_movements.sql` (SQL Editor vagy CLI).
