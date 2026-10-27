# 47 — Opti panel import (szöveg / Excel / kép)

**Állapot:** tervezet (UI + parser + élkódolás zárolva; implementáció fázisokban)  
**Kapcsolódó:** [23](23-lapszabaszat-addon.md), [37](37-lapszabaszat-quote-workflow.md), [03](03-ux-certainty-first.md), [09](09-keyboard-and-data-entry.md)  
**Kód (cél):** `opti-workspace-client`, `panel-draft.ts`; Excel minta: meglévő ExcelJS importok; legacy Korpus export ötlet: main-app `quotes/[id]/export-excel`

## 1. Cél

Műszaki előkészítő gyorsan töltsön be panellistát az Optiba **anélkül**, hogy soronként gépelne — **úgy, hogy nehéz legyen elrontani az adatot**.

```
Import → előnézet (javítható) → „Hozzáadás az Opti listához (N)” → meglévő panels[]
```

Az Opti meglévő listája **nem változik**, amíg a user meg nem erősíti. Optimalizálás **nem** indul magától.

**Nem cél V1:** azonnali Optimalizálás; anyag soronkénti AI-tippelés; teljes CAD bridge; csendes él-oldal találgatás badge nélkül.

---

## 2. Bemenetek (egy pipeline, három kapu)

| Bemenet | Parser | AI | Fázis |
|---|---|---|---|
| Szöveg beillesztés | regex / sor split | csak ha bizonytalan | **A** |
| Excel / CSV (Korpus-szerű) | ExcelJS oszlopmap | nem kell | **B** |
| Kép / PDF screenshot | — | Claude vision → ugyanaz a row JSON | **C** |

Kimenet mindig: `ParsedPanelRow[]` + `warnings[]`.

### Canonical row

```ts
type ParsedPanelRow = {
  grainMm: number        // szálirány / hosszúság
  crossMm: number        // kereszt / szélesség
  quantity: number
  marking?: string
  edgeSpec: EdgeSpec
  sourceLine?: number
  confidence?: 'high' | 'low'
  issues?: string[]      // pl. ambiguous_edges, unknown_edge_code
}
```

**Anyag:** mindig az Opti UI-n kiválasztott táblás anyag (ritkán váltasz). Import előtt kötelező anyag — Import gomb disabled, mint a form kapu.

---

## 3. Dim / qty szabályok

- Egész mm, > 0; qty ≥ 1 egész.
- Szál/kereszt felcserélés: **nem** auto V1 (user javít előnézetben); warning ha mindkettő > anyag max.
- Duplikált sorok: megtartjuk (szándékos ismétlés OK).
- Max sor / import: pl. **500**.

### Szöveg minták (fázis A)

```
720 560 2 A1
800x400 x4
600;400;1;ajtó
720×560 — 2 db
720 560 2 A1 | 2-2 ABS22
800 400 1 | 2-0 ABS22 | 0-2 ABS19
```

Ambigu: `720 560` qty hiányzik → qty=1 default + warning.

---

## 4. Élzárás — Korpus `Hossz-Szél` + gépkód (zárolt)

### 4.1 Gépi Excel (export / import szimmetria)

Tipikus oszlopok:

| … | Hosszúság | Szélesség | Darab | Megnevezés | Forgatható? | Hossz₁ | Szél₁ | Azon₁ | Hossz₂ | … |
|---|---|---|---|---|---|---|---|---|---|---|

Egy élanyagra:

- **Hossz** = hány **hosszú** oldalon (0–2) → Opti: **A** (hosszú felső) + **C** (hosszú alsó)
- **Szél** = hány **széles** oldalon (0–2) → Opti: **D** (széles bal) + **B** (széles jobb)
- **Azon** = élzáró `machine_code` (nem UUID)

| Kód `Hossz-Szél` | Jelentés | Default oldal-kiosztás |
|---|---|---|
| `0-0` | nincs él | mind üres |
| `2-0` | mindkét hosszú | A+C |
| `0-2` | mindkét széles | D+B |
| `2-2` | körbe ugyanaz | A+C+D+B |
| `1-0` | egy hosszú | **A** |
| `0-1` | egy széles | **D** |
| `1-1` | egy hosszú + egy széles | **A + D** |
| `1-2` | 1 hosszú + 2 széles | A + D+B |
| `2-1` | 2 hosszú + 1 széles | A+C + D |

Több élanyag = több `(Hosszᵢ, Szélᵢ, Azonᵢ)` triplet — oldalakra sorban, amíg szabad.

**Miért ez a nyelv:** round-trip Korpus / legacy Excel exporttal; előkészítők ismerik; Opti belső modell továbbra is A/B/C/D UUID.

### 4.2 Ambiguity policy (kötelező)

A count **nem** mondja meg, *melyik* oldal, ha < 2.

**V1 default (determinisztikus, UI-n kiírva):**

| Szükség | Sorrend |
|---|---|
| Hosszú | A → C |
| Széles | D → B |

Előnézet: chip *„alap kiosztás (A/D)”* + szerkeszthető 4 él.  
Conflict (két triplet ugyanarra az oldalra): első nyer, `issues: edge_overlap`.  
Ismeretlen Azon: **hiba**, él üres — ne fuzzy név V1.  
`3-0` / `2-3`: reject.  
Üres Azon + nem `0-0`: invalid.

### 4.3 EdgeSpec

```ts
type EdgeTriplet = { long: 0 | 1 | 2; short: 0 | 1 | 2; code: string }

type EdgeSpec =
  | { mode: 'none' }           // explicit 0-0 / „nincs”
  | { mode: 'inherit_ui' }     // nincs él a sorban → Opti form aktuális éljei
  | { mode: 'korpus'; triplets: EdgeTriplet[] }
  | { mode: 'sides'; a?: string; b?: string; c?: string; d?: string }
```

`korpus` → resolve → `sides` (UUID) a review lépésben.

### 4.4 Szöveg él

```
720 560 2 A1 | 2-2 ABS22
600 400 1 ajtó              ← nincs él rész → inherit_ui
600 400 1 | 0-0             ← explicit none
```

---

## 5. Excel (fázis B)

1. Fejléc synonymok: Hosszúság|Szál|Grain; Szélesség|Kereszt; Darab; Megnevezés|Jelölés; Hossz/Szél/Azon 1..4.
2. Ha fejléc nem stimmel → **oszlop-párosító** (kötelező Szál+Kereszt) — ne tippeljen csendben.
3. Forgatható: V1 ignore (+ warning).
4. Tábla Azonosító (gépkód): V1 ignore ha ≠ aktuális anyag; warning.
5. Üres méretű sor skip.

Export (később): ugyanaz a triplet forma.

---

## 6. Kép + Claude (fázis C)

- Ugyanarra a `ParsedPanelRow` JSON schemára.
- Prompt: Korpus él = `Hossz-Szél` + kód; ne találjon ki oldalneveket.
- Low confidence → review kiemelés.
- Rate limit / `lapszabaszat` entitlement — ne legyen korlátlan ingyen vision.
- Szabályos szöveg/Excel **előbb** (0 költség); AI csak képnél vagy koszos szövegnél.

---

## 7. UI / UX (certainty-first)

### 7.1 Belépési pont

**Panel felvitele** kártya, anyag után (`entryEnabled`):

```
                         [Import ▾]     ← secondary / ghost
[Panel hozzáadása]                      ← marad az egyetlen primary a formon
```

Dropdown: Szöveg beillesztése… · Excel / CSV… · Fotó / kép… (C: disabled ha nincs jog).  
Anyag nélkül: Import disabled — *„Előbb válassz táblás anyagot.”*

### 7.2 Három állapot (dialógus / sheet — nem külön route)

```
① Bemenet → ② Előnézet + javítás → ③ Kész (toast + lista)
   Mégse        Mégse | Hozzáadás (N)
```

Háttérben az Opti session / anyag megmarad.

### 7.3 ① Bemenet

**Szöveg:** nagy textarea; példa-chipek (kattintásra minta); 1 sor súgó:  
*„Szál Kereszt Db [Jelölés] [| él pl. 2-2 KÓD]”*  
CTA: **Beolvasás előnézetbe** (nem „Importálás”).

**Excel:** dropzone → sikeres parse után ②; rossz fejléc → oszlop-párosító.

**Kép:** „AI kiolvassa — ellenőrizd az előnézetben” + spinner.

### 7.4 ② Előnézet — „nehéz elrontani” mag

Fejléc:

```
12 sor · 10 OK · 2 javítandó
Anyag: UB19 … (minden sorra ez kerül)
[✓] Hibás sorok kihagyása     ← default BE, ha van hiba
```

Tábla: `# | Szál | Kereszt | Db | Jelölés | Él | Állapot`  
- Inline edit méret/db/jelölés.  
- Él: összefoglaló chip + **Élek…** → A/C/D/B select.  
- Állapot: **OK / Figyelem / Hiba** = szín **+** szöveg (tilos szín-only).

| Állapot | Mehet a confirmba? |
|---|---|
| OK | igen |
| Figyelem (pl. `1-1` default A+D) | igen; soft copy a default kiosztásról |
| Hiba | nem — javítás vagy „kihagyás” pipa |

Sticky footer:

```
Mégse          Hozzáadás az Opti listához (10)
               ↑ disabled, ha 0 OK sor
```

Destruktív nincs (nem töröl meglévő Opti panelt).

### 7.5 Él chip-ek

| Spec | Chip |
|---|---|
| `2-2 CODE` match | Körbe · CODE |
| `1-1` | Figyelem · alap A+D · CODE |
| Ismeretlen CODE | Hiba · nincs ilyen élzáró |
| `inherit_ui` | Mint a formon |
| `none` / `0-0` | Nincs él |

Soha ne cserélje csendben a form sticky éljét — a sor `edgeSpec` dönt.

### 7.6 ③ Kész

- Dialógus zár.  
- Toast: *„10 panel hozzáadva az Opti listához.”* (+ opcionális 8 mp undo batch).  
- Részleges: *„10 hozzáadva, 2 sor kihagyva.”*  
- Fókusz → **Szálirány** (meglévő ritmus).  
- Optimalizálás **nem** auto.

### 7.7 Copy (ige+tárgy)

| Elem | Szöveg |
|---|---|
| Menü | Import… |
| Szöveg CTA | Beolvasás előnézetbe |
| Excel CTA | Fájl előnézete |
| Confirm | Hozzáadás az Opti listához (N) |
| Cancel | Mégse |
| 0 OK sor | Nincs hozzáadható sor — javítsd a pirosakat. |

Kerüld: OK, Submit, Feldolgozás kész, AI siker.

### 7.8 Mobil

Full-screen sheet; tábla vízszintes scroll; élek bottom sheetben (ne 4 select a szűk gridben).

### 7.9 Adatvédelmi checklist (UX)

| Védelem | Hol |
|---|---|
| Anyag kapu | Import disabled |
| Nincs silent write | Csak confirm után |
| Hibás sor default kimarad | Checkbox + számláló |
| Ambiguous él látható | Figyelem + default szöveg |
| Ismeretlen élzáró | Hiba, nem random match |
| Max mm | Figyelem/hiba anyag alapján |
| Egy primary a confirmban | Kitöltött gomb |
| Mégse | Null mellékhatás |
| Undo toast | Véletlen nagy import |

---

## 8. Edge case checklist (parser)

| Eset | Viselkedés |
|---|---|
| qty 0 / negatív | reject sor |
| 720,5 mm | reject vagy floor+warning |
| Egy szám a sorban | reject |
| `2-2` két Azon overlap | error |
| Ugyanaz a code `1-0`+`1-0` | merge → `2-0` |
| `1-0`+`0-1` ugyanarra a code | merge → `1-1` |
| Másik code, A foglalt | C (A→C sorrend) |
| Nincs tenant él a code-hoz | hiba; méret OK |
| 0 panel | toast, semmi |
| Edit mode quote | ugyanaz |
| Partner Opti | ugyanaz; él lista RLS |

---

## 9. Implementációs fázisok

| Fázis | Scope |
|---|---|
| **A** | Szöveg + review dialógus; él: `inherit_ui` \| `none` \| `2-2` / `2-0` + code |
| **B** | Excel Korpus oszlopok + teljes triplet merge + oszlop-párosító |
| **C** | Kép + Claude; fuzzy él-név opcionális; oldal-preferencia setting |

Párhuzamosan (külön, kis diff): Opti **él sticky** panel hozzáadás után (méret wipe, él marad) — napi gépelést is gyorsítja import nélkül.

---

## 10. Explicit NEM V1

- Él oldalkód `A`/`C` betűkkel mint *elsődleges* importnyelv (Korpus count nyer)
- AI minden Excel-sorra
- Import = auto optimize
- Forgatható / tábla Azonosító kötelező match
- Silent fuzzy él-név match
- Külön route `/opti/import` (maradjon dialógus)
