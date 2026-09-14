# 16 — Reference screen

Ez nem elméleti dokumentum, hanem a jövőbeli referenciaképernyő-spec alapja.

## Cél

Az agentnek és a fejlesztőnek kell egy olyan etalon, ami:

- megmutatja a docs gyakorlati alkalmazását
- másolható szerkezetet ad
- egységesíti a döntéseket

## Két kötelező referencia

### 1. Lista képernyő

Tartalma:

- `AppShell`
- `PageHeader`
- kereső
- szűrősáv
- `DataTable`
- visible row actions
- pagination + `X / Y elem`
- empty / loading / error
- bulk action bar

### 2. Űrlap képernyő

Tartalma:

- `PageHeader`
- egyhasábos `FormField` layout
- kötelező / opcionális mezők
- hint és error
- sticky vagy stabil action area
- nem mentett változás állapot
- `ConfirmDialog`

## Rögzített UI döntések

- Toast pozíció: **jobb alul**
- Primary action helye: **jobbra**
- Destruktív dialog default fókusz: **Mégse**

## Cél

A későbbi valódi referenciaképernyő kódja legyen:

- review-olt
- accessibility-ellenőrzött
- checklist-kompatibilis

Amíg nincs kész, ez a dokumentum írja le a minimális tartalmat.
