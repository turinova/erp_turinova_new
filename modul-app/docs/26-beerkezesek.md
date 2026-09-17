# 26 — Beérkezések + készlet (MVP+)

**Státusz:** implementált (B1 + P2 mag).  
**Route:** `/beerkezesek`  
**Migrációk:** `20260504_goods_receipts_and_stock.sql`, `20260506_receipt_extras_and_close.sql`  
**Kapcsolat:** [24-beszerzes-workflow.md](24-beszerzes-workflow.md), [25-warehouses.md](25-warehouses.md)

---

## 0. Egy mondat

> **Áru megérkezett** → számolás → **Bevételezés** → készlet nő; részszállítás = több beérkezés; váratlan áru = PO-n kívüli tétel; hiány = lezárás gomb.

---

## 1. Zárolt döntések

1. UI: **Beérkezések**; create-or-open; max 1 `checking` / PO.
2. Receive irreverzibilis; RPC all-or-nothing.
3. Overage: figyelmeztetés + engedélyezett.
4. **PO-n kívüli tétel:** explicit dialóg (nem csendes scan-add).
5. **Hiányos lezárás:** PO → `received` + `closed_incomplete_at`.
6. Confirm: tétellista + overage / extra kiemelés.
7. Soron: **készleten** (ledger SUM a célraktáron).
8. **PO detail visibility:** tételenként rendelt / beérkezett / hiányzik (csak `received` doksikból); kapcsolódó beérkezések lista a PO-n; extra sorok nem számítanak a PO teljesítésbe.
9. **Beérkezés detail outcome:** színes összefoglaló sáv (pontos / részleges / eltérés) + sor tint + StatusBadge — certainty-first, nem plain tábla.
10. **Célraktár:** PO-ról öröklődik; checking + ≥2 WH → MenuSelect override receive előtt.
11. **Termék detail:** „Készlet és beszerzés” szekció csak `beszerzes` entitlement mellett (`20260507`).

---

## 2. Flow (barcode)

```
Scannelés
  ├─ van a listán → +1
  ├─ nincs a listán, van a törzsben →
  │     Dialóg: „Nem volt a rendelésen.
  │     [Hozzáadás PO-n kívül] [Mégsem]”
  └─ nincs a törzsben →
        „Ismeretlen termék — előbb vedd fel Termékeknél.”
```

Extra sor: `is_extra=true`, `purchase_order_item_id=null` — stock nő, PO partial/received számításból kimarad.

---

## 3. Elfogadás

1. Teljes út + részszállítás.  
2. Extra termék dialóg → bevételezés → stock.  
3. Hiányos lezárás PO-n (nincs nyitott checking).  
4. Confirm mutatja a sorokat.  
5. Készleten oszlop látszik.  
6. PO detail: beérkezett qty + Beérkezések szekció a kapcsolódó doksikkal.
