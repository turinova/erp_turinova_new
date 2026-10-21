# 15 — Nyomtatás és dokumentumok

Ebben a domainben a nyomtatott output a product része.

## 1. Alapelv

- A PDF, print nézet, címke nem melléktermék.
- Ugyanúgy design system felület, mint a képernyő.
- Fekete-fehérben is érthetőnek kell maradnia.

## 2. Egy fő stratégia

Minden dokumentumtípusnál dönteni kell:

- **print stylesheet**
- **szerveroldali PDF**

Ne tarts fenn párhuzamosan két elsődleges megoldást ugyanarra a dokumentumtípusra.

## 3. Dokumentumtípusok

Jellemző példák:

- munkalap
- szabásterv
- ajánlat
- szállítólevél
- címke
- számla körüli kimenetek

Mindegyiknél legyen rögzítve:

- elsődleges előállítási mód
- papírméret / formátum
- kötelező mezők
- mit hagyunk le képernyőről nyomtatásban

## 4. Print nézet szabály

Nyomtatásban ne jelenjen meg:

- sidebar
- topbar
- toast
- gombok
- felesleges interaktív UI

Csak a dokumentumhoz kellő információ maradjon.

## 5. Státuszok és színek

- Szín soha nem lehet az egyetlen jelentéshordozó
- Nyomtatásban a státusz legyen szövegesen is világos
- Fekete-fehér nyomtatásban is értelmezhető maradjon

## 6. Címkék

Ha van címkenyomtatás:

- külön formátum specifikáció kell
- méret, margó, vonalkód elhelyezés, betűméret legyen fixen definiálva

### 6a. Termék címke (33×25 mm) — v5 (Zebra Browser Print + policy)

Zárolt döntések:

- **Nyomtatás primary:** Zebra **Browser Print** → nyers **ZPL** (`lib/labels/zpl.ts` + `browser-print-client.ts`). A vonalkódot a **ZD220 firmware** rajzolja (`^BEN` EAN-13 / `^BCN` CODE128), nem Chrome raster.
- **Barcode policy (`print-policy.ts`):** 33×25-ön csak **EAN-13** vagy **rövid CODE128** (`^BY2` scannelhető). Hosszú gyártói (pl. `DT-CZ…`) → **belső EAN** kötelező; ha nincs → print **tiltva** (vagy vonalkód mező ki).
- **ZPL layout:** priority packer (`packLabel33x25`) — barcode → ár → SKU → név (név zsugorodik). Nincs silent mező-drop; adaptív betűméret; sűrű (~1 mm pad, 0 gap); barcode band ~56 dot teljes sablonnál.
- **203 dpi:** `^PW264` / `^LL200` / `^LH0,0`; modul **`^BY2`**. EAN szélesség = **113 modul** (quiet benne); FO középre + **~1 mm** oldalsó pad.
- **Szöveg:** `^FB…,C` középre; **nincs** JS ellipsis. `^MD14` default (túl sötét = olvashatatlan sávok).
- **EAN `^FD`:** pontosan **12 digit**; érvényes belső EAN default.
- **Előnézet:** HTML sheet (tájékoztató). **HTML nyomtatás** csak fallback.
- **Illesztés:** `tenant_label_print_settings` → `^LS` / `^LT`. Bal clip → negatív X (tartalom jobbra).
- **Gép / USB:** Browser Print + default ZD220; HTTPS `9101/ssl_support`; media kalibráció. **Minden nyomtatás előtt re-probe**; tab focus / visibility → re-probe; hibaállapotnál **Újracsatlakozás**; USB kihúzás → clerk-facing hiba (`mapBrowserPrintError`).
- Layout preview: `layout.ts`; print: `print-label.tsx` → ZPL.

## 7. PDF kontra HTML print

Ajánlott szemlélet:

- egyszerű listák / részletek -> HTML print is elég lehet
- hivatalos, stabil tördelést igénylő dokumentum -> szerveroldali PDF

## 8. DoD

Egy dokumentum csak akkor kész, ha:

- nyomtatva olvasható
- fekete-fehérben is érthető
- nincs rajta felesleges app chrome
- tartalmazza a domainileg szükséges azonosítókat
