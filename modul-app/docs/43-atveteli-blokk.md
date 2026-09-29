# 43 — Átvételi blokk (hőnyomtató, Opti)

**Route:** `/beallitasok/atveteli-blokk`  
**Migráció:** `20260565_handover_slip_settings.sql`  
**Kapcsolat:** [23](23-lapszabaszat-addon.md), [37](37-lapszabaszat-quote-workflow.md)

---

## 0. Egy mondat

> Lapszabászat **ajándék** feature: Opti átadáskor (`ready` → `finished`) opcionálisan 0/1/2 példányos átvételi elismervény USB hőnyomtatóra; tartalom tenant beállításokban, élő preview-val.

---

## 1. Csomagolás

| | |
|---|---|
| Add-on | **Nincs külön díj** — `lapszabaszat` része |
| Page entitlement | `/beallitasok/atveteli-blokk` |
| Ki/be (tenant) | `tenant_handover_slip_settings.enabled` + `copies` |
| Scope | **Csak Opti quotes** — nem CSO |

---

## 2. Beállítások

Tábla: `tenant_handover_slip_settings` (1 sor / tenant).

Fő mezők: `enabled`, `copies` (0|1|2), `single_copy_kind` (`customer` default ha 1), `auto_on_handover`, fejléc/tételek/jogi kapcsolók (`show_edge`, `show_services`, …), `legal_text`, `gate_line_text`, `customer_copy_label`.

UI: bal kapcsolók, jobb **80 mm preview** (Üzleti / Vevői tab), primary **Mentés**, secondary **Teszt blokk nyomtatása**.

---

## 3. Nyomtatás

| Réteg | Path |
|---|---|
| ESC/POS | `lib/handover-slip/escpos.ts` |
| WebUSB | `lib/handover-slip/webusb.ts` |
| Browser fallback | `lib/handover-slip/browser-print.ts` |
| Orchestrator | `lib/handover-slip/print.ts` |
| Payload | `prepareHandoverSlipPrint(quoteId)` |

**Wire:** `HandoverDialog`, `ScannerHandoverDialog` — USB request a gomb clickjén (user gesture), majd átadás, majd print.

Print hiba **nem** rollbackeli a `finished` státuszt.

**2 példány:** `original` (aláírás + kapu szöveg) + `customer` (vevői felirat).  
**1 példány:** default **vevői**.

---

## 4. Explicit nem P0

- CSO átvételi blokk  
- Külön fizetős add-on  
- 58 mm layout finomhangolás  
- Logo bitmap ESC/POS  
- „Blokk újra” finished state (P1)
