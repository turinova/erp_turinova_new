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

### 6a. Termék címke (33×25 mm) — v3

Zárolt döntések:

- **Default sablon: Teljes** — név + **SKU ON** + ár + vonalkód (SKU kikapcsolható).
- **Vizuális hierarchia mérettel** (minden `font-weight: 550`): **Ár > SKU > Név**.
- **SKU** (Teljes): ~**3.5 mm**, saját sor a név és az ár között; `sku.font ≥ name.font + 0.4 mm`.
- **Név soha nincs levágva** — nincs ellipsis; shrink + max **3** sor; min ~**2.8 mm**.
- **Nagy SKU** — raktár pick (~4.2 mm SKU sor, nincs név).
- **Ár:** egy sor **`12 345 Ft/db`**.
- **Fix zónák**: SKU sor védve; leftover → név; scan floor barcode-on.
- **HRI** alapból ki. X &lt; 0.20 mm vagy sáv &lt; 5.5 mm → print tiltva.
- **Előnézet = print:** mm + `LABEL_PX_PER_MM` + CSS `scale`.
- Nyomtató: **100% / Actual size**. Illesztés: `tenant_label_print_settings`.
- Layout: `src/lib/labels/layout.ts`; UI: `ProductLabelPrintDialog`.

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
