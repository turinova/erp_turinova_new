# 34 — Jelenlét add-on

**Státusz:** P0 MVP (+ terminál, platform-managed)  
**Migráció:** `20260518_jelenlet_addon.sql`, `20260519_hr_employee_types.sql`, `20260520_hr_work_calendar_page.sql`, `20260573_jelenlet_terminal.sql`, `20260574_jelenlet_terminal_platform_only.sql`, `20260927_jelenlet_sheet_presets.sql`, `20260928_hr_employees_archive.sql`  
**Ár:** **9 900 Ft** nettó/hó  
**Key:** `jelenlet`

Kapcsolódó: [33-packages-and-addons.md](33-packages-and-addons.md), [jelenlet-pi.md](jelenlet-pi.md)

---

## Mit nyit (tenant)

| Route | Job |
|---|---|
| `/jelenlet` | Csapat naptár — napi érkezés/távozás / szabadság / beteg |
| `/jelenlet/naptar` | Globális munkarend: ünnep / céges szünnap / áthelyezett nap |
| `/dolgozok` | Dolgozó lista + havi hiányzó/hiányos nap + jelenléti ív varázsló |
| `/dolgozok/uj`, `/dolgozok/[id]` | Alap adatok + műszak + PIN/RFID + távollét lista |
| `/dolgozok/tipusok` | Dolgozó típus törzs (Bolt / Műhely / …) |

**Terminál eszközök:** csak **platform** Cég részletező — tenantnak nincs `/jelenlet/terminalok`. A tenant csak PIN/RFID-t kezel; a hardvert mi telepítjük.

**Nem** része: bér, geo, approval workflow (P2).

---

## Oldalak

1. **Naptár** = író felület (cell dialógus).  
2. **Munkarend** = tenant-szintű `hr_work_calendar` (minden dolgozóra).  
3. **Dolgozók** = törzs + PIN/RFID + távollét intervallumok.  
4. **Típusok** = szerkeszthető törzsadat (`hr_employee_types`).  
5. **Jelenléti ív varázsló** — `/dolgozok` kijelölés → „Jelenléti ív (N)” → 4 lépés (lásd lent).

---

## Entitlement

Features: `jelenlet`, `/jelenlet`, `/jelenlet/naptar`, `/dolgozok`, `/dolgozok/tipusok`.  
Platform enable → `grantJelenletPageAccess` + `seed_hr_hu_holidays_for_tenant` + `seed_hr_employee_types_for_tenant`.

Független a `footcounter` add-ontól.

---

## Terminál (platform)

API: `POST /api/jelenlet/terminal/scan` — Bearer / `x-jelenlet-secret`.  
Eszköz + token: platform Cég detail. RLS: csak `is_platform_admin` (tenant tag nem olvas/ír).  
Részletek: [jelenlet-pi.md](jelenlet-pi.md).

Dolgozó: `pin_code` (4 digit), `rfid_card_id` — partial unique / tenant (soft-delete NULL-ra állít).

---

## Táblák

`hr_employees`, `hr_employee_types`, `hr_attendance_days`, `hr_absences`, `hr_work_calendar`, `jelenlet_devices`

### Munkarend (`hr_work_calendar`)

- 1 nap / tenant (`unique tenant_id, work_date`).
- Típusok: `national`, `company`, `relocated_work`, `relocated_rest`.
- Seed: `seed_hr_hu_holidays_for_year(tenant, year)` — meglévő napot nem ír felül.
- Ünnep/céges/áthelyezett pihenő → mindenki pihen; áthelyezett munkanap → kötelező nap.

### Dolgozó típus

- Soft delete (`deleted_at`), egy aktív `is_default` / tenant.
- Seed: Bolt, Műhely, Iroda, Lapszabász, Egyéb (alapértelmezett).
- Törlés tiltott, ha van hozzárendelt dolgozó vagy alapértelmezett.

### Dolgozó állapotok

| Állapot | Mező | Lista | Naptár / terminál | Jelenléti ív |
|---|---|---|---|---|
| Aktív | `active = true` | elöl | igen | igen |
| Inaktív (átmeneti, pl. tartós betegség) | `active = false` | a lista végén | nem | igen |
| Archivált (kilépett) | `archived_at` | csak „Archivált” szűrő | nem; PIN/RFID felszabadul | igen; adatok csak olvashatók |
| Törölt (hibás felvétel) | `deleted_at` | nem | nem | nem |

Visszaállítás archiválásból: inaktívként, PIN/RFID újra megadandó.

### Szombat

- Szombat **sosem kötelező** nap: üres szombat nem teendő, csak a hiányos (csak érkezés/távozás) szombat.
- `works_on_saturday` = „Szombaton dolgozhat” (lehetőség, nem elvárás).

---

## Jelenléti ív varázsló

Kód: `lib/jelenlet/sheet-rules.ts` (szabály séma + beépített sablonok), `sheet-engine.ts` (tiszta számítás, teszt: `npm run test:jelenlet-sheet`), `sheet-data.ts` (batch lekérés), `sheet-template.ts` (HTML), API: `POST /api/jelenlet/iv/preview`, `POST /api/jelenlet/iv/pdf` (max 100 dolgozó; 1 → PDF, több → ZIP vagy összefűzött PDF).

Lépések: **Kik és mikor** → **Sablon** → **Szabályok** → **Előnézet** (dolgozónkénti összesítő + figyelmeztetések + HTML előnézet, mentés sablonként).

| Szabály | Hivatalos (beépített) | Belső / papír (beépített) |
|---|---|---|
| Időpontok | generált: nyitó 08:00 / záró 08:30, 8 óra + ebéd | rögzített idők |
| Nyitó/záró rotáció | kiválasztott típusok (alap: Bolt + Iroda) kód szerint, napi váltás | — |
| Szombat | max 4 óra, levonás a következő munkanapból (hónaphatáron át) | látszik, nem számít |
| Napi óra | max 8 | 8 + X túlóra (pl. 9 órás műszak: 8 + 1) |
| Távollét + bejött | távollét (0 óra) | távollét, „bent volt: x óra” megjegyzés |
| Hiányos nap | üres | HIÁNYOS felirat |

A szombati levonás célnapja: a következő kötelező munkanap távollét nélkül, érvényes jelenléttel (14 napon belül); ha a hónapon túlra esik → figyelmeztetés. A main-app ismert hibái javítva (fél órás ebédhiba, szombati ebéd átfedés nélkül, hónaphatáron elveszett levonás, fordított idő 8 órának).

**Jog:** a generált idők nem a tényleges időpontok (Mt. 134. §) — a UI figyelmeztet.

### Sablonok (`hr_sheet_presets`)

- Tenant-szintű, `rules jsonb` (zod: `sheetRulesSchema`), név egyedi / tenant (kis-nagybetű független).
- RLS: olvasás `is_tenant_member`, írás `can_write_tenant`.

### Dolgozói túlóra (`hr_employees`)

- `overtime_rounding_minutes` / `_mode` (floor / nearest / ceil).
- Korai túlóra: `early_overtime_enabled`, `early_overtime_trigger_time` (ennél korábbi érkezés), `early_overtime_pay_until_time` (NULL = műszak kezdete), `early_overtime_max_minutes`, `early_overtime_grace_minutes`.
- Csak a belső ívre hat (`includePolicyOvertime`).
