# 35 — Home KPI-k (jégelt)

**Állapot:** 2026-09-18 — döntés rögzítve, UI implementáció még nincs.  
**Persona:** átlagos kereskedő / bolt (Alap ERP SaaS). **Nem** műhelyvezető-first.  
**Addonok** (POS, Jelenlét, Lapszabászat, Belépő) csak entitlement szerint jelennek meg.

Kapcsolódó: [33-packages-and-addons.md](33-packages-and-addons.md), [03-ux-certainty-first.md](03-ux-certainty-first.md), [11-empty-tenant-and-onboarding.md](11-empty-tenant-and-onboarding.md).

---

## Alapelv

1. Home = kereskedő mag (forgalom, ajánlat, beszerzés, figyelendő).
2. Extra modulok ne uralják a default home-ot.
3. Sűrű, kis számok / listák — nincs brand banner, nincs műhely-dashboard alapból.
4. Egy mondatos teszt: *„Tudja-e azonnal, mennyi ment el, kire kell visszahívni, mi csúszik a beszállításban?”*

---

## Tartósan megjeleníthető KPI-k

### Alap (kereskedő mag)

| # | KPI |
|---|---|
| 1 | Mai forgalom (Ft) |
| 2 | Mai eladások (db) |
| 3 | Nyitott árajánlatok (db) |
| 4 | Nyitott beszállítói rendelések (db) |
| 5 | Késő beérkezések (db) |
| 6 | Ma / holnap várható áru (db vagy lista) |
| 7 | Figyelendő tételek (összesített db / lista) |

### POS (addon `pos`)

| # | KPI |
|---|---|
| 8 | Mai POS forgalom vs. napi cél (%) |
| 9 | Nyitott műszak (van / nincs + kassza) |
| 10 | Havi POS forgalom vs. havi cél (chip) |

### Jelenlét (addon `jelenlet`)

| # | KPI |
|---|---|
| 11 | Hiányzó jelenléti napok (db) |
| 12 | Ma távol (db / nevek) |

### Lapszabászat (addon `lapszabaszat`)

| # | KPI |
|---|---|
| 13 | Nyitott szabás backlog (db / m) |
| 14 | Mai / heti kész szabás |

### Belépőszámláló (addon `footcounter`)

| # | KPI |
|---|---|
| 15 | Most bent (élő IN) |
| 16 | Mai belépők (db) |

---

## P0 default home

**Alap default:** 1, 3, 4, 5, 7.  
A többi csak entitlement szerint; custom layout később (user ki/be).

**Kihagy P0:** konverzió %, havi chart, készletmozgás db, műhely backlog (ha nincs lapszabászat).

---

## Megjelenítési formák (későbbi UI)

| Kód | Forma | Hol |
|---|---|---|
| A | Figyelmeztető / nagy szám | Alap KPI strip |
| B | Cél / progress | POS |
| C | Élő státusz | Műszak |
| D | Névlista | Ma távol / várható |
| E | Mini lista | Figyelendő |
| F | Chart | P1 trend |
| G | Chip (hónap) | POS P1 |
