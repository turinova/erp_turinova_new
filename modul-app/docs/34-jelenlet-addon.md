# 34 — Jelenlét add-on

**Státusz:** P0 MVP  
**Migráció:** `20260518_jelenlet_addon.sql`, `20260519_hr_employee_types.sql`, `20260520_hr_work_calendar_page.sql`  
**Ár:** **9 900 Ft** nettó/hó  
**Key:** `jelenlet`

Kapcsolódó: [33-packages-and-addons.md](33-packages-and-addons.md)

---

## Mit nyit

| Route | Job |
|---|---|
| `/jelenlet` | Csapat naptár — napi érkezés/távozás / szabadság / beteg |
| `/jelenlet/naptar` | Globális munkarend: ünnep / céges szünnap / áthelyezett nap |
| `/dolgozok` | Dolgozó lista + havi hiányzó/hiányos nap + hivatalos PDF |
| `/dolgozok/uj`, `/dolgozok/[id]` | Alap adatok + műszak + távollét lista |
| `/dolgozok/tipusok` | Dolgozó típus törzs (Bolt / Műhely / …) |

**Nem** része: RFID/terminál, bér, geo, approval workflow (P2).

---

## Oldalak

1. **Naptár** = író felület (cell dialógus).  
2. **Munkarend** = tenant-szintű `hr_work_calendar` (minden dolgozóra).  
3. **Dolgozók** = törzs + távollét intervallumok.  
4. **Típusok** = szerkeszthető törzsadat (`hr_employee_types`).  
5. **Hivatalos PDF** — `/dolgozok` kijelölés → ZIP/PDF.

---

## Entitlement

Features: `jelenlet`, `/jelenlet`, `/jelenlet/naptar`, `/dolgozok`, `/dolgozok/tipusok`.  
Platform enable → `grantJelenletPageAccess` + `seed_hr_hu_holidays_for_tenant` + `seed_hr_employee_types_for_tenant`.

Független a `footcounter` add-ontól.

---

## Táblák

`hr_employees`, `hr_employee_types`, `hr_attendance_days`, `hr_absences`, `hr_work_calendar`

### Munkarend (`hr_work_calendar`)

- 1 nap / tenant (`unique tenant_id, work_date`).
- Típusok: `national`, `company`, `relocated_work`, `relocated_rest`.
- Seed: `seed_hr_hu_holidays_for_year(tenant, year)` — meglévő napot nem ír felül.
- Ünnep/céges/áthelyezett pihenő → mindenki pihen; áthelyezett munkanap → kötelező nap.

### Dolgozó típus

- Soft delete (`deleted_at`), egy aktív `is_default` / tenant.
- Seed: Bolt, Műhely, Iroda, Lapszabász, Egyéb (alapértelmezett).
- Törlés tiltott, ha van hozzárendelt dolgozó vagy alapértelmezett.
