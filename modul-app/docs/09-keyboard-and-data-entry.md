# 09 — Billentyűzet és adatbevitel

Ez a dokumentum az ERP/SaaS admin egyik legfontosabb használhatósági rétegét írja le:

- gyors, pontos adatbevitel
- minimális egérfüggés
- vonalkódolvasó-kompatibilis működés
- Excelből érkező adatok kezelése

Az alapelv:

> A billentyűzetes gyorsítás mindig **kiegészítés**, soha nem az egyetlen út.  
> Az UI maradjon érthető ritka felhasználónak is, de a napi 40–100 rekordot rögzítő user ne lassuljon le.

## 1. Fókusz és tab-sorrend

- A `Tab` sorrend a **valós munkafolyamatot** kövesse, ne véletlen DOM-rendet.
- Balról jobbra, fentről lefelé csak akkor jó, ha a tényleges kitöltés is így történik.
- Rejtett / disabled / collapsed elemek ne kerüljenek fókuszba.
- Sticky toolbar vagy modal ne „lopja el” a fókuszt mentés után.
- Hibás mentés után az első hibás mező kapjon fókuszt.

## 2. Enter viselkedés

### Egyszerű űrlap

- `Enter` küldheti az űrlapot, ha ez a user számára egyértelmű.
- Többsoros mezőben (`textarea`) az `Enter` új sor.

### Tételsoros / grid jellegű bevitel

- `Enter` alapból **következő logikus mező** vagy **új sor**, nem globális submit.
- `Shift+Enter` mehet visszafelé, ha konzisztens.
- Az oldal ne mentsen véletlenül csak azért, mert a user soron belül `Enter`-t ütött.

## 3. Numerikus mezők

- Magyar bevitel miatt **tizedesvessző és pont is elfogadott**.
- A tárolás lehet egységes, de a bevitel legyen toleráns.
- Használj `inputMode="decimal"` vagy `numeric`, ahol releváns.
- A numpad használata működjön külön plusz kattintás nélkül.
- A mezőhöz tartozó egység legyen látható (`mm`, `m2`, `Ft`, `%`), ne fejben kelljen tartani.

## 4. Smart parse

Az admin rendszer támogassa az olyan természetes beviteleket, mint:

- `600x400` -> szélesség + magasság
- `2db` -> mennyiség `2`, mértékegység `db`
- `12,5` és `12.5` -> ugyanaz
- `10%` -> százalék mező

Ezek mindig **segítségek**, nem rejtett trükkök:

- legyen dokumentálva hintben vagy súgóban
- hibás parse esetén konkrét hibaüzenet kell

## 5. Vonalkódolvasó mint billentyűzet

A legtöbb vonalkódolvasó billentyűzetként viselkedik. Erre külön szabály kell.

- Legyen kijelölt, látható „aktív scanner input” állapot, ha az oldal scanre vár.
- Az `Enter` terminátor támogatott legyen.
- Ha nincs fókusz a megfelelő mezőben:
  - vagy legyen globális scanner-csatorna
  - vagy a UI egyértelműen jelezze, hogy előbb melyik mezőbe kell kattintani
- Sikeres scan után legyen azonnali visszajelzés:
  - hang vagy vizuális megerősítés
  - az elem megjelölése / hozzáadása

## 6. Excelből beillesztés

ERP-ben ez alapigény.

- Tételtáblába lehessen több sort beilleszteni tabulátor / sortörés alapú parse-szal.
- Oszloprend legyen dokumentált vagy felismerhető.
- Hibás sorokat külön jelöld, ne dobj el mindent.
- Beillesztés után legyen preview, ha az akció kockázatos.

## 7. Gyorsbillentyűk

Ajánlott globális shortcutok:

- `Ctrl/Cmd + S` -> mentés
- `/` -> kereső fókusz
- `N` -> új rekord, ha az oldalon ez a fő művelet
- `Esc` -> modal bezárás / keresőből kilépés

Szabályok:

- Soha nem lehetnek az egyetlen út.
- A shortcut jelenjen meg tooltipben vagy súgóban.
- Ne ütközzen a böngésző alap viselkedésével szükségtelenül.

## 8. Paste, autofill, megszakítások

- A user gyakran másol Excelből, e-mailből, PDF-ből.
- A rendszer tolerálja a felesleges szóközt, sortörést, ezreselválasztót.
- Az input értelmezzen, ne büntessen.
- Ha az űrlap hosszú, részállapot maradjon meg draftként, ahol üzletileg fontos.

## 9. Mérés

Az új moduloknál mérhető cél:

- top adatbeviteli flow billentyűzettel végigvihető legyen egér nélkül
- a fókusz soha ne vesszen el mentés vagy hiba után
- a vonalkódos flow egy kézzel / minimális kattintással működjön
