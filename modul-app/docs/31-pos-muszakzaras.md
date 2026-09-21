# 31 — POS műszakzárás + pénztárak + audit

**Státusz:** P0 implementálva.  
**Route:** `/pos` (nyitás/zárás) · `/ertekesitesek/muszakok` (ügyvezető)  
**Migráció:** `20260514_pos_shifts_and_registers.sql` (+ `20260523_warehouse_default_pos_register.sql`: új raktár → default Főpénztár + backfill)  
**Kapcsolat:** [28](28-ertekesites-workflow.md), [29](29-pos-workflow.md)

---

## 0. Egy mondat

> Pultos saját belépővel, egy **pénztáron** nyit műszakot → elad → záráskor számol; ügyvezető 2–3 kattintással látja: ki · kassza · KP eltérés.

**Nem** NAV adóügyi zárás. Copy: „Műszakzárás (belsős elszámolás)”.

---

## 1. Fogalmak

| UI | DB |
|---|---|
| Pénztár | `pos_registers` |
| Műszak | `pos_shifts` (kulcs = register) |
| Feladás/betét | `pos_shift_cash_moves` |
| Eladó | `sales_orders.created_by` + `created_by_label_snapshot` |

Zárolt: max 1 `open` / pénztár · zárt immutable · manuális eladás nem megy a műszakba.

---

## 2. Elvárt KP

```
opening + KP befizetés − KP visszatérítés + cash in − cash out
```

---

## 3. UX

- POS: kapu (nyitó Ft) → topbar Műszakzárás / KP feladás  
- 1 pénztár = auto; több = választó  
- Lista: `/ertekesitesek/muszakok` — eltérés chip  

---

## 4. Edge (rövid)

Nincs műszak → POS tilt · eltérés note kötelező · WH/register váltás open mellett tilt · előző záró default nyitáskor.
