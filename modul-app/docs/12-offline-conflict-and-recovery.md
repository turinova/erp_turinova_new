# 12 — Offline, konfliktus és helyreállítás

A modul-app felhasználói megszakítva dolgoznak. A rendszernek ezt támogatnia kell.

## 1. Mire kell készülni

- mentés közben megszakadó kapcsolat
- gyenge műhely-wifi
- több user ugyanazt a rekordot szerkeszti
- véletlen bezárás / refresh

## 2. Minimum elvárás

Minden fontos flow-ban legyen:

- loading állapot
- hibaállapot
- nem mentett változás figyelmeztetés
- egyértelmű újrapróbálási út

## 3. Draft és autosave

Nem minden űrlaphoz kell autosave, de ahol sok adatvesztés lehetséges, ott tervezni kell vele.

Javaslat:

- rövid, egyszerű űrlap: kézi mentés elég
- hosszú, összetett űrlap: draft mentés vagy helyi állapotmegőrzés ajánlott

A user mindig tudja:

- mentve van-e
- piszkozatban van-e
- volt-e hiba

## 4. Konfliktus két szerkesztő között

Ha többen nyitják meg ugyanazt a rekordot:

- legalább ütközés-figyelmeztetés kell
- mentéskor világos üzenet kell, ha valaki közben módosította
- ne írjunk felül csendben adatot

Minimum:

- `updated_at` alapú ellenőrzés
- konkrét UI üzenet
- lehetőség újratöltésre vagy változások összevetésére

## 5. Hálózati hibák

Hibaüzenet szerkezete:

- mi nem sikerült
- az adat megmaradt-e
- mit tehet most a user

Példa:

> Nem sikerült menteni a rendelést. A kapcsolat megszakadt. A mezők tartalma megmaradt, próbáld újra a mentést.

## 6. Helyreállítás

Ha van helyi draft:

- legyen felajánlható visszatöltés
- ne töltsd vissza csendben a user tudta nélkül
- a user dönthessen: helyi draft vagy szerver adat

## 7. Ne ígérj többet, mint amit tudsz

Ha nincs valódi offline support:

- ne használj megtévesztő nyelvet
- inkább „kapcsolati hiba” és „próbáld újra”, mint hamis biztonság

## 8. DoD

Egy kritikus űrlap csak akkor kész:

- ha mentési hibánál nem vész el az adat
- ha bezárás előtt figyelmeztet
- ha konkurens szerkesztés legalább felismerhető
