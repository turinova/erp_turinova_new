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
- **ZPL layout:** fix %-zónák (`packLabel33x25`) — név 28 / SKU 18 / ár 22 / kód 32. Kikapcsolt mező = **üres sáv** (többi nem nő) → egységes pozíció. SKU+ár **1 sor**, név **max 2**. Kivétel: „Csak kód” max barcode.
- **Név limit:** címke dialógus + ZPL **`LABEL_NAME_MAX_CHARS = 36`**. Packer: `fitTextToFbLines` + `FB_CHAR_WIDTH_FACTOR=0.62` → max **2 sor**, soha nem folyik SKU-ra (ellipsis). Törzsadat név maradhat 200.
- **203 dpi:** `^PW264` / `^LL200` / `^LH0,0`; modul **`^BY2`**. EAN / CODE128: `^FO` = **látható sávok** bal széle (quiet kívül); sávközép = `ZPL_LABEL_CENTER_X` = `^FB` szövegtengely.
- **Szöveg:** `^FB…,C` a tartalomdobozban; `^A0` width = height (1:1 — condensed elcsúsztatta a középre igazítást); `^MD11` default.
- **EAN `^FD`:** pontosan **12 digit**; érvényes belső EAN default.
- **Előnézet:** ugyanaz a ZPL → PNG (`@zebrash/browser`, 8 dpmm native + **3×** smooth upscale a képernyőre; self-host font `/fonts/zebrash/`). Offset (`^LS`/`^LT`) a previewban is. Renderer fail → HTML sheet fallback. **HTML nyomtatás** csak fallback.
- **Illesztés:** `tenant_label_print_settings` → `^LS` / `^LT`. Bal clip → negatív X (tartalom jobbra).
- **Gép / USB:** Browser Print + default ZD220; HTTPS `9101/ssl_support`; media kalibráció. **Minden nyomtatás előtt re-probe**; tab focus / visibility → re-probe; hibaállapotnál **Újracsatlakozás**; USB kihúzás → clerk-facing hiba (`mapBrowserPrintError`).
- Preview + print truth: `generateLabelZpl` → `zpl-preview.ts` / Browser Print `write`.

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
