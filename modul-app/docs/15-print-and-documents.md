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

### 6a. Termék címke (33×25 mm) — shelf-edge hierarchy

Zárolt vizuális sorrend (NIST / retail shelf-edge): **Ár > Név > vonalkód > SKU**.

- **Alap sablon: Polc** — név + ár + vonalkód (SKU ki). Vásárlói polcra.
- **Teljes** — mint Polc, plusz **SKU** (~2.7 mm, weight 600, mono) a vonalkód *felett*, soha a név és ár között.
- **Nagy SKU** — raktár pick: nagy SKU sor + ár + kód (nincs név).
- **Ár:** egy sorban **`12 345 Ft/db`** (egység inline, nem külön `/ db` sor). Ár a legnagyobb elem.
- **Név:** max 2 sor, weight 600; mindig erősebb, mint a secondary SKU.
- **Fix zónák** (`computeLabelLayout`): name / price / barcode budget mm-ben; szöveg a zónába zsugorít — ne fordítsd meg a hierarchiát.
- **HRI** alapból ki. CODE128 quiet zone ≥ **10× X**; X &lt; 0.20 mm vagy sáv &lt; 5.5 mm → print tiltva.
- **Előnézet = print:** mm + `LABEL_PX_PER_MM`, dialógus CSS `scale`.
- Nyomtató: **100% / Actual size**. Illesztés: tenant `tenant_label_print_settings` (±2 mm).
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
