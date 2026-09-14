# 03 — UX: Certainty-first (bizonyosság-first)

Célcsoport: alacsonyabb digitális rutin, gyengébb / terhelt munkamemória, hibától való félelem.  
**Nem** „buta UI” — hanem **kevesebb döntés, több magyarázat, visszafordítható hibák**.

## Alapelv

> A siker metrika: *„Biztos vagyok benne, hogy jól csináltam.”*  
> Nem: *„Kevesebb kattintással megúsztam.”*

Kutatási támasz (összefoglaló):

- Munkamemória ~**4 chunk** (Nielsen / cognitive load) — a usert nem szabad arra kényszeríteni, hogy képernyők vagy lépések között fejben tartson fontos információt. Ami a döntéshez kell, legyen együtt látható: aktív szűrők, összegzések, mit szerkeszt éppen.
- Low digital literacy: a userek **nem kísérleteznek**; bizonyosság kell, nem felfedezés.
- GOV.UK / NHS: egy fókusz / lépés, plain language.
- Stripe: job-alapú navigáció; empty state = következő lépés.
- ERP mode-error: figyelmeztető dialógust átkattintják — **struktúrális gát** kell.

## 10 kötelező szabály

### 1. Egy cél / képernyő

Egy H1, egy mondatnyi segédszöveg ha kell, **egy** primary gomb.  
Ha két „fő” dolgot akarsz: két képernyő vagy wizard.

### 2. Feladatfolyam > menülabirintus

A fő munkák legyenek **vezethetők**: Új rendelés → tételek → mentés → kész.  
A navigáció **job neveket** használjon („Rendelések”), ne adatmodell-neveket („Quote entities”).

### 3. Látható akciók

Gyakori művelet (Szerkeszt, Töröl, Nyomtat, Státusz) **látszik** szöveggel vagy ikon+szöveggel.  
Tilos: csak `⋯`, csak hover, csak billentyűparancs.

### 4. Egyértelmű következmény a gombon

| Rossz | Jó |
|---|---|
| OK | Rendelés mentése |
| Igen | Törlés |
| Submit | Ajánlat küldése |
| Folytatás | Következő: szállítási cím |

### 5. Progressive disclosure

- Látszik: napi munka.
- Egy kattintásra: szűrő, oszlopválasztó.
- Szándékos mélység: ritka beállítások.

Ne dumpold a power-user felületet az első látogatónak.

### 6. Struktúrális védelem

Destruktív / tömeges / pénzmozgás:

- Nem elég a „Biztosan?”.
- Írd ki a tárgyat; kérj megerősítő gesztust (pl. darabszám / név begépelése), ha visszafordíthatatlan.
- Ha lehet: **undo 8 mp** a megerősítő modal helyett.

### 7. Konzisztens helyek = tanulás nélkül

Minden listán: kereső felül, tábla középen, lapozó alul, primary jobb felül.  
Mentés gomb **mindig ugyanott** az űrlapokon.

### 8. Üres / töltő / hiba emberinek

- Üres: „Még nincs X.” + egy gomb.
- Töltés: skeleton (ne ugráló layout).
- Hiba: mi + miért + mit tegyen. Soha nyers exception a UI-ban.

### 9. Kevesebb opció = kevesebb szorongás

Ha három gomb van „Mentés / Mentés másként / Piszkozat / Mégse / Bezárás”, a user **megáll**.  
Max. 2–3 értelmes választás egyszerre; a ritkát tedd secondary/ghost alá.

### 10. „Ész teszt” minden képernyőre

1. 5 mp alatt világos a teendő?
2. A primary gomb megtalálható olvasás nélkül?
3. Elrontás után egyedül vissza lehet lépni?
4. A menüpontot hangosan így mondaná a user?
5. Van-e elem, amit csak „rendszerismerettel” ért? → vedd ki vagy magyarázd.

## Density

- **Comfortable default** új / átlag usernek (44px input, 52px sor).
- Compact csak explicit kapcsolóval (power user).

## Ami tilos ebben a célcsoportban

- „Fedezd fel a funkciókat” üres felfedező UI
- Sok azonos súlyú gomb
- Zsargon (sync, entity, payload, commit)
- Rejtett gesztusok (swipe-only, long-press-only desktopon)
- Auto-navigálás mentés után magyarázat nélkül (ha mégis: egyértelmű visszajelzés + hova került)

## Kapcsolat a Flat 2.0-hoz

A Flat 2.0 a **vizuális** keret.  
Ez a dokumentum a **viselkedési** keret.  
Mindkettő kötelező; konfliktusnál a certainty-first **nem** áldozható fel a „menőbb” UI kedvéért.
