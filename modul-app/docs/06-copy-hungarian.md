# 06 — Magyar UX writing

A szöveg a UI része. Rossz copy = rossz UX, hiába szép a Flat 2.0.

## Hangnem

- Közvetlen, udvarias, **nem** leereszkedő.
- Aktív igék. Rövid mondatok.
- Ne hibáztasd a usert („Hibás adatot adtál meg”) → „Az adószám 11 számjegyű.”
- Tegeződés: az app hangja **tegező** (konzisztensen), kivéve ha termékdöntés mást mond — akkor az egész app egységes.

## Gombok

| Tilos | Kötelező minta |
|---|---|
| OK, Igen, Mégsem (önmagában) | Mentés / Mégse |
| Submit, Send | Küldés / Ajánlat küldése |
| Delete | Törlés |
| Save changes | Változtatások mentése |

Forma: **ige + tárgy**, ha nem egyértelmű a kontextus.

## Címkék és hint

- Label: amit a user a mezőnek nevez („Adószám”, nem `vat_number`).
- Hint: formátum / példa / szabály egy mondatban.
- Placeholder: **csak példa**, pl. `pl. 2510` — nem utasítás.

## Hibák

Szerkezet kötelező:

1. **Mi** történt  
2. **Miért** (ha segít)  
3. **Mit tegyen**

Példa:

> Nem sikerült menteni a rendelést. A hálózat megszakadt. Ellenőrizd a kapcsolatot, majd kattints újra a „Rendelés mentése” gombra.

Tilos UI-ban: stack trace, nyers PostgREST kód, angol technikai zsargon magyarázat nélkül.

## Státuszok

Magyar, rövid, állandó szótár — ne szinonimák keveréke.

Példa szótár (bővítsd domainenként, tartsd egy fájlban):

| Kulcs | Label |
|---|---|
| draft | Piszkozat |
| sent | Elküldve |
| active | Aktív |
| cancelled | Visszavonva |
| pending | Függőben |
| error | Hiba |

## Üres állapot

> Még nincs rendelés.  
> [+ Új rendelés]

Egy mondat. Nem vicc, nem marketing.

## Navigáció

Hangosan kimondható nevek.  
„Ügyfél rendelések” jobb, mint „Fulfillment”.  
Idegen márkanév (pl. NETTFRONT) maradhat, ha a user így ismeri.

## Nagybetű

- Mondatkezdő (sentence case) gombokon és menüben.
- Nincs FULL CAPS gomb.
- Tulajdonnevek kivétel.

## Angol a kódban, magyar a UI-ban

- Kod: `status === 'pending'`
- UI: `Függőben`  
Soha ne jelenjen meg a nyers enum a felületen.
