# 10 — Jogosultságok és tenancy

Ez SaaS-specifikus alapdokumentum a **jogosultság és tenancy UX**-ről. A teljes platformstruktúra (deploy, shared DB + RLS, backup/restore, platform gerinc): **`17-saas-architecture.md`**.

A `main-app` belső ERP logikája itt nem elég: a modul-app több cégre, több szerepkörre és előfizetési állapotra készül.

## 1. Alapelv

- A jogosultság **nem csak backend kérdés**, hanem UX kérdés is.
- A kliensoldali rejtés csak ergonómia, nem security.
- A szerver **mindig** végrehajtás előtt ellenőriz.

## 2. Rejtsd vagy tiltsd?

Alapszabály:

- **Navigációban rejtsd** azt, ami biztosan nem releváns a szerepkörnek.
- **Akciónál inkább tiltsd és magyarázd**, ha a user látja az adott rekordot, de nincs joga az akcióhoz.

Miért:

- a teljesen eltűnő akció zavaró lehet, ha a user tud róla
- a disabled állapot magyarázattal bizonyosságot ad

Példák:

- menüpont „Számlázás” elrejthető, ha a usernek soha nincs hozzáférése
- `Törlés` gomb lehet disabled tooltip/inline magyarázattal: „Csak tulajdonos törölhet rendelést”

## 3. Szerepkörök

UI-ban a szerepkörök emberi, magyar nevekkel jelenjenek meg.

Ajánlott alap-szótár:

- `Tulajdonos`
- `Irodai munkatárs`
- `Műhely`
- `Csak megtekintés`
- `Pénzügy`
- `Adminisztrátor`

Ne jelenjen meg nyers technikai kulcs a felületen.

## 4. Tenant-váltó

Ha egy user több céghez tartozik:

- a tenant-váltó legyen mindig könnyen elérhető, tipikusan topbarban
- az aktuális cég neve legyen állandóan látható
- váltás után egyértelmű visszajelzés kell
- a rendszer soha ne hagyja bizonytalanságban a usert, hogy „melyik cégben dolgozik”

## 5. Support impersonation

Ha support vagy belső admin más nevében nézi a rendszert:

- legyen **tartós, erős banner**
- látszódjon, kit néz, melyik tenantban
- az impersonation megszüntetése könnyű és jól látható legyen

Ez nem dísz, hanem bizalmi és hibamegelőzési kérdés.

## 6. Előfizetés, kizárás, állapotok

Kezelendő üzleti állapotok:

- lejárt előfizetés
- olvasási módra korlátozott előfizetés
- ideiglenes felfüggesztés
- user kizárva / deaktiválva

UI szabály:

- tartós állapotot **inline banner** jelezzen
- a user mindig tudja:
  - mi történt
  - ez mire van hatással
  - mit tehet most

## 7. Rekordszintű hozzáférés

Ha a user lát egy rekordot, de nem tehet meg rajta mindent:

- a látható akciók maradjanak konzisztensen ugyanott
- ami tiltott, az disabled + magyarázat
- ne „villogjon” a gomb szerepkör vagy aszinkron fetch miatt

## 8. Audit és magyarázhatóság

Magas kockázatú műveletnél a UI-ban is legyen nyom:

- ki módosította
- mikor
- milyen állapotban van

Ez a supportot és a user bizalmát is segíti.

## 9. Implementációs elv

- kliens: láthatóság / tiltás / magyarázat
- szerver: végleges engedélyezés
- dokumentáció: role matrix képernyőnként vagy modulonként
