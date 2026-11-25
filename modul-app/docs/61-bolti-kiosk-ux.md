# 61 — Bolti kiosk: UX, layout, wireframe

**Állapot:** 2026-11-20 — layout zárolva UX mockhoz.  
**Termék:** [60-bolti-kiosk.md](60-bolti-kiosk.md) · Certainty: [03](03-ux-certainty-first.md) · Copy: [06](06-copy-hungarian.md) · Számok: [13](13-numbers-units-formats.md) · Vizuál north star: [18](18-midday-visual-reference.md) (**kiosk eltérés:** nagyobb tipó/CTA, mint staff Linear-sűrűség).

---

## 0. Egy mondat

> Hétköznapi bolti vásárló: *lap → méret → megmunkálás → tap-él → kosár → név+telefon → rendelésszám a pultnak* — egy döntés / képernyő, nem tud Opti-szinten hibázni.

---

## 1. Persona + pszichológia

| Aggodalom | UI válasz |
|---|---|
| Szakszavak | Szál × kereszt **vizuálisan** a previewn (nem Opti-űrlap) |
| Rossz méret | Hard max = Opti `maxGrainMm`/`maxCrossMm` (tábla − szélezés) + clamp; soft warn &lt;150 mm („centi volt?”) |
| Melyik oldalra él | Preview oldal tap, nem A/B/C/D |
| Mennyi lesz? | Kosárban **Ár kiszámítása** → alsó sáv nagy Ft |
| Mi lesz utána? | „Fizetés a pultnál” |
| Benne ragadok | Vissza + Újrakezdés + idle → Attract |

---

## 2. Flow

```
[0 Attract] → [1 Anyag] → [2 Méret] → [3 Megmunkálás] → [4 Él]
     → [5 Kosár] ⇄ szerkeszt → [6 Adatok] → [7 Kész]
                                      ↓ idle 90s → [0]
```

Progress label: **Anyag · Méret · Megmunkálás · Él · Kosár · Adatok** (Kész külön success).

---

## 3. Design tokenek (kiosk)

| Token | Érték |
|---|---|
| Primary / CTA | `#18181B` |
| Háttér | `#FAFAFA` |
| Top chrome | 72px |
| Bottom chrome | ~96px (ár kártyával) |
| Body | **≥18px** (50+ / 24″) |
| Cím H1 | **36–40px** / 600 |
| Rajz felirat | **≥20px** (Szálirány, élhossz) |
| Rajz méretérték | **36–40px** |
| CTA / mező | **56–64px** |
| Touch min | 48px (él-sáv 56px) |
| 1 primary / képernyő | kötelező |
| Info szín | `ink-secondary`, nem muted |

**Tilos:** staff 32px default gomb, 13.5px body, hover-only, glow/gradiens, emoji ikon, több primary.

**24″ FHD görgetés:** Attract, Méret, Él, Kész **görgetés nélkül** férjen el (≈910 px stage a wizard chrome alatt; Kész = teljes 1080 bare). Overflow csak tartalék.

---

## 4. Brand hierarchia

| Hely | Tenant | Turinova |
|---|---|---|
| Attract | **Bemutatóterem**: `TenantHeroLogo` a bal fehér oszlop tetején, optikai méretezés (fallback: cégnév 64px) | Footer „Powered by” |
| Wizard topbar | `sm` logo, 44px magas, max 200px | — |
| Help sheet | — | Footer compact |
| Kész | `TenantHeroLogo` (Attract-méret), bal wide | Footer bal: compact |

Tenant mindig nagyobb / feljebb, mint Turinova. Flat Midday charcoal CTA — nincs glow.

---

## 5. Globális shell

```
TOP 72: [Tenant logo]  progress (zöld kész ✓)  [Kosár] [?]
STAGE: egy fókusz · bg-app token
BOTTOM ~96: [← Vissza]  [ Végösszeg kártya: success-soft + nagy Ft ]  [ PRIMARY · Ft ]
```

- Topbar: csak tenant logo (nincs „Lapméretre vágás” eyebrow).  
- Progress: lépés **ikon** (Anyag Layers · Méret Ruler · Megmunkálás Drill · Él Frame · Kosár Cart · Adatok UserRound); kész = `bg-success` + Check; aktív = charcoal + ikon; upcoming = border + muted ikon. Label megmarad. Connector zöld a kész szakaszon. Nem klikkelhető (csak ← Vissza).  
- Kosár ikon + badge = panel-sorok. Összeg **nem** a topbaron — alsó sáv középen.  
- `?` → help bottom sheet + Turinova footer.
- Idle: 75s figyelmeztetés, 90s clear → Attract.

---

## 6. Képernyők (rövid wire)

### 0 Attract (asztali PC, fekvő · 24″ FHD)
Kutatás: attract = cégtábla, „mi ez, mit kapok” ≤10 szóban, 1 domináns gomb; „Touch to start” önmagában rossz; valódi termék, nem díszkép (Square le is vette a marketing hátteret); termék-rövidítés a nyitóról.

- Layout „Bemutatóterem”: nincs felső sáv; két teljes magasságú oszlop a teljes szélességen (52/48), alatta lábléc. 1920×1080-on görgetés nélkül kifér.
- **Bal (tiszta fehér `bg-surface`, cég + teendő):** tenant logo → rövid fekete vonal → H1 **Bútorlap szabás méretre, élzárással** (56px) · supporting · primary **Rendelés indítása** (72px, autofocus, Enter) · vízszintes 4 lépés · „Kell hozzá:” sor. Fehér, mert a cégek logója jellemzően fekete felirat (és sok fehér hátterű JPG) — sötét felületre tilos tenni, invertálni sem szabad.
- **Logó optikai méretezés** (`heroLogoBox` a `kiosk-brand.tsx`-ben): azonos látszó terület (~90 000 px²), max 680×200 px. Pl. 8:1 felirat → 680×85, 4,4:1 → 630×143, 1:1 jel → 200×200. Logó feltöltés: min. 1000px széles, átlátszó PNG/SVG, üres szél nélkül.
- **Jobb (`bg-app`, termék):** **Népszerű lapok** — 4 vagy 6 nagy csempe 2 oszlopban, a lap képe kitölti a magasságot → Méret. **Segítség** gomb a jobb felső sarokban. Ha 4-nél kevesebb kiemelt lap van: helyette nagy „Így működik” kártya (és a bal oldali lépéssor elmarad).
- Lábléc: „Különleges kérésed van? Kérdezd a pultot.” + Powered by Turinova.
- Tilos: egész képernyős gomb, dísz gradiens, nem kattintható pill chip, logó külön magas sávban (üres hely). Kód: `components/kiosk/attract/kiosk-attract.tsx`.

### 1 Anyag — „Katalógusfal” (teljes szélesség, 24″ FHD)
Ugyanaz a logika, mint az Attract Bemutatóterem: **bal = döntés eszközei, jobb = termék**. `KioskShell wide` — nincs `max-w-[1100px]`.

- **Bal (400 px, fehér `bg-surface`, nem görgetődik el a ráccsal):** H1 **Válaszd ki a lapot** (36px) · kereső 64px · **Vastagság** chip-ek (Mind + max 8 gyakori/featured vastagság, preferált: 18/16/12/10/8/3) · **Csak raktáron** · súgó („Rendelésre” magyarázat, Kérdezd a pultot). Dekor csere / másolás: doboz a kereső felett; vastagság chip-ek elrejtve.
- **Jobb (`bg-app`):** fejléc + **5 oszlopos** rács (xl). Üres query: **kiemeltek elöl** (`quote_panels` 90 nap, max 8), **utána a teljes katalógus többi lapja**. Vastagság/raktár szűrő ugyanezen a listán. Gépelésre találati grid + highlight. Üres szűrés → „Szűrők törlése”.
- Csempe: nagyobb kép, `Raktáron` / `Rendelésre`, vastagság badge, név 17px, `L×W×T` · gyártó · Ft/m², `machine_code`. Tap = Méret.
- Footer: csak **← Vissza** (nincs primary — a lap kiválasztása a CTA).

### 2 Méret — „Műhelyasztal” (teljes szélesség, 24″ FHD, **görgetés nélkül**)
Ugyanaz a minta: **bal = mezők (fehér, 640 px), jobb = nagy rajz**. `KioskShell wide`. Hasznos magasság ≈ 910 px (1080 − 72 top − 96 footer).

- **Bal (~560 px magas):** egysoros lapkártya (64 px) · H1 **36px** · **Szálirány + Keresztirány egymás mellett** (72px mező, 32px szám) · **Darab + Megnevezés egy sorban**.
- **Jobb:** hibák / soft warn **a rajz fölött** 20px · `ResizeObserver` max 1200×720. Dim címke **20px**, érték **40px**. Panel közép **40px**. Soft &lt;150 mm. Enter → tovább.

### 3 Megmunkálás — „Műhelyasztal” (teljes szélesség)
- **Bal:** H1 40px · 3 sor (20px cím, Be/Ki). Inline opciók.
- **Jobb:** `fillStage` — sarok **64px / 24px**, élhossz badge **22px**, közép méret **40px**, caption **20px**.
- **Enter** = **Élzárás megadása →**.

### 4 Él — „Műhelyasztal” (teljes szélesség, **görgetés nélkül**)
- **Bal (560 px):** egysoros lapkártya · H1 **36px** · kompakt mintasáv · **egy él = egy sor** (badge 40px + név + `MenuSelect` h-14). 4–5 él is belefér.
- **Jobb:** `fillStage` — 22px élhossz badge, 40px közép. Caption = summary.
- Footer: **Él nélkül a kosárba** · **Kosárba →**.

### 5 Kosár — „Átnézés” (teljes szélesség, 3 oszlop)
- **Bal (400 px, fehér):** H1 40px · meta · **ár állapot** · **+ Másik anyag** · **Mikor lesz kész?** · alul **Kosár ürítése**.  
- **Közép (lista):** anyag-csoportolt kártyák. Header: swatch + név (2 sor) + **anyag Ft 28px** · **Hogyan jött ki…** + **+ Ugyanebből még** / **Dekor csere** / **Másolás** / **Szín törlése**.  
- Sor: `CartPanelThumb` 80×64 (szálvonal **csak** `grainDirection` lapon) · 20px méret · 16px chipek · **Módosítás**. Kijelölés **csak kattintásra** / billentyűzettel; hover = finom keret. Kijelölt: fehér + 6px fekete bal sáv + fekete keret + „Rajzon” címke. Csoport fejléc fehér, kártya `shadow-sm`. Dupla katt = szerkesztés.  
- **Jobb (preview):** kijelölt sor nagy `KioskMachiningPreview` `fillStage` (él + megmunkálás).  
- **Dekor csere** / **Másolás:** `lib/kiosk/recolor-cart.ts`. Footer: **Ár kiszámítása** → **Tovább · {Ft} →**.

### Árazás (manuális, Opti-parity)
- Nincs élő auto-price / draft nesting.  
- Egy gomb: **Ár kiszámítása** → `/api/kiosk/.../price` (nest + quote; **egy** Opti futás, mint `/opti`).  
- Kosár változás → `stale`, újra kell számolni. Alsó navbar nagy Ft csak `ok` után.  
- Nincs külön „Végösszeg” kártya / **nincs soronkénti Ft** (zavaró arányos allokáció). Ár = anyag fejléc.  
- **Hogyan jött ki ez az ár?** — anyag-csoport header → széles dialog (Opti/Square-szerű szekciótáblák). Oszlopok: **Tétel · Menny. · Egységár · Összeg**. Szekciók: Lap / Élzárás / Vágás / Megmunkálás + **Összesen (bruttó)**. Lap 2 eset: teljes tábla (kihasználtság) | m² × hulladékszorzó. Forrás: Opti `MaterialPricing` → `materials[]`.

### 6 Adatok — „Leadás” (teljes szélesség) · asztali PC, egér + billentyűzet
- **Bal (720 px, fehér):** H1 40px · 3 accordion. Címke a mező felett **18px**. Input **`h-16` / 22px**. Enter = következő mező.
- **1 Elérhetőség** · **2 Számla** (nagy radio) · **3 Ellenőrzés**.
- **Jobb (bg-app, teljes szélesség):** **Rendelésed** nyugta — anyagkártyák **2 oszlopban**, swatch + `CartPanelThumb` + 17px meta. **Összesen 48px** Ft · **Kosár módosítása** h-14. „Elakadtál?”.
- Footer CTA **Leadom a pultnak · {Ft}**; tiltva → konkrét hiány.
- **Közös gép:** `autoComplete="off"`; idle ≥120 mp. Kód: `details/*`, `cart/cart-panel-thumb.tsx`, `lib/kiosk/guest.ts`.

### 7 Kész (peak-end, **teljes szélesség** mint a többi wide lépés, **görgetés nélkül**)
`KioskShell wide` + bare (nincs progress chrome). **Tilos** `max-w-[1100px]` — 1920-on edge-to-edge.

- **Bal (fehér ~46%):** `TenantHeroLogo` (Attract-méret, max ~680×200) · zöld pipa **112px** · „Köszönjük!” **56px** · **név clamp 52–96px** (ezt mondja a pultnál) · instrukció **26px** · leftover 20px.
- **Jobb (`bg-app`):** „Mi a következő lépés?” **36px** · 3 kártya max ~900px (sorszám **72px**, cím **30px**, szöveg **22px**).
- **Alsó sáv (~96px, mint wizard footer):** bal Turinova · közép visszaszámláló 20px + 8px progress · jobb primary **Új rendelés indítása** h-16 / 22px. Auto-reset 30 mp. Nincs „írd fel”.

---

## 7. Guardrail mátrix

| Szabály | Hol |
|---|---|
| 1 döntés / képernyő | wizard (Adatok: 1 oldal, 3 számozott szekció) |
| CTA disabled + ok szöveg | shell |
| Méret ≤ anyag max | Méret |
| Él on ⇒ chip kell | Él |
| Consent kell submithoz | Adatok |
| Speciális vágás kívül | Help / Attract |

---

## 8. Copy (HU)

- Attract CTA: **Rendelés indítása** (ige + tárgy; nem „Kezdem”, nem „Méretre vágok”)
- Válaszd ki a lapot  
- Mekkora legyen a lap? (+ preview tanít szálat)  
- Hol legyen élzáró? A táblában élenként választ; sáv: „Nézd meg az élzáró mintákat a kiosk mellett” (fizikai minták a kiosk mellett)  
- Él nélkül a kosárba (text-link a Méreten)  
- Nézd át a rendelésed  
- Leadom a pultnak  
- Köszönjük! + nagy {név} · Mondd a neved a pultnál.

Kerülendő: Opti, nesting, grain, quote, draft, panel, **fent / lent / felső / alsó** (bútorlap orientáció), „hulladékszorzó”, gondolatjel a mondatokban, érintős igék („érintsd”, „koppints”): a kiosk **asztali PC, egér + billentyűzet**.

### 8.1 Bizonyosság (a vevőnek ne kelljen kérdeznie)

| Kérdés | Hol válaszolunk |
|---|---|
| Elronthatom? | Lábléc minden lépésen: „Nem végleges. A pultnál még mindent átnézünk veled.” + Súgó „Hibáztam, mi lesz?” |
| Melyik darab melyik? | Méret lépés: **Megnevezés** (nem kötelező, max 40) → kosár, Adatok összegzés, `quote_panels.label` |
| Felcseréltem a méretet? | Szálirányos lapnál majdnem négyzet (≤10% eltérés) → figyelmeztetés |
| Mikor lesz kész? | Kosár „Mikor lesz kész?” doboz + Kész képernyő. **Nincs pontos nap**; rendelésre lapnál: be kell szereznünk, a pultnál megmondjuk |
| Melyik élzáró? | Fizikai minták a kiosk mellett (sáv az Élzárás lépésen) |
| Miért ennyi az ár? | Ár magyarázó: „Darabjaid X m², a vágás miatt Y m² lapot használunk fel” |
| Kész vagy vágási méret? | Méret lépés + Súgó: **kész méret, élzáróval együtt**. A vágásnál mi számolunk az élzáróval |
| Mi lesz a maradékkal? | Ha teljes táblát számolunk, a maradék a megrendelőé (kosár, ármagyarázat, Kész, Súgó; pult + PDF minden ajánlatnál) |

Az ár gomb (**Ár kiszámítása**) marad kézi.

---

## 9. Mock kód helye

| Path | Szerep |
|---|---|
| `src/app/k/[slug]/` | Publikus route, no auth |
| `src/components/kiosk/` | Shell + brand + wizard |
| `src/components/kiosk/kiosk-brand.tsx` | Tenant + Turinova logo |
| `src/lib/kiosk/mock-data.ts` | Fake anyag / él / ár / logo |

**Persist tilos** amíg a UX el nem fogadott — lásd [60](60-bolti-kiosk.md) §4.

---

## 10. Landscape / portrait

| | Landscape | Portrait |
|---|---|---|
| Méret/Él | 45/55 split | stack preview → form |
| Anyag grid | 3–4 col | 2 col |
| CTA | jobb bottom | full width |
