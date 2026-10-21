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

### 6a. Termék címke (33×25 mm) — v4 (Zebra Browser Print)

Zárolt döntések:

- **Nyomtatás primary:** Zebra **Browser Print** → nyers **ZPL** (`lib/labels/zpl.ts` + `browser-print-client.ts`). A vonalkódot a **ZD220 firmware** rajzolja (`^BEN` EAN-13 / `^BCN` CODE128), nem Chrome raster.
- **203 dpi:** `^PW264` / `^LL200`; modul **`^BY2`** (0,25 mm). `^BY3` EAN-13-nál **nem fér** 33 mm-re.
- **EAN `^FD`:** pontosan **12 digit** (check digit a nyomtató); érvényes belső EAN default.
- **Előnézet:** HTML sheet (tájékoztató). **HTML nyomtatás** csak secondary fallback (gyengébb szkennelés).
- **Illesztés:** `tenant_label_print_settings` → ZPL `^LS` / `^LT` (mm→dot).
- **Gép:** Browser Print fut + default = ZD220; HTTPS-en egyszer `https://127.0.0.1:9101/ssl_support`; Accepted Hosts = production domain.
- **Default sablon: Teljes** — név + SKU + ár + vonalkód. HRI alapból ki.
- Layout preview: `layout.ts` / `ProductLabelSheet`; print: `print-label.tsx` → ZPL.

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
