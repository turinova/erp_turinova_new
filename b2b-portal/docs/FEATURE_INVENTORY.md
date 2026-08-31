# Turinova B2B — termék képességek (befektetői áttekintő)

**Mi ez?** SaaS réteg Shoprenter webshopokra: a viszonteladóknak **önkiszolgáló, gyors B2B rendelést** ad a meglévő bolton, a kereskedőnek pedig **partnerárakat, vevőkezelést és riportot** egy portálon.

**Kiknek?** Magyar B2B/viszonteladói webshopok (Shoprenter), akik ma e-mailben, Excelben vagy bolti kosárral szenvednek a partner-rendelésekkel.

**Hogyan épül fel?** Két felület, egy termék:

1. **Merchant portál** — amit a bolt tulajdonosa / csapata használ  
2. **Bolti widget („Gyors rendelés”)** — amit a belépett partner használ a webshopon  

Mindkettő a meglévő Shoprenter boltra kapcsolódik (API + egy script a sablonba) — **nincs külön B2B webshop cserélni**.

---

## 1. Értékajánlat egy mondatban

> A viszonteladó percek alatt, saját partnerárával, készlettel és listáival rendel a meglévő bolton; a kereskedő ugyanabból a rendszerből áraz, csoportosít, automatizál és mér.

---

## 2. Mit kap a kereskedő (Merchant portál)

### 2.1 Indítás és üzemeltetés
- **Önkiszolgáló regisztráció** 14 napos próbaidővel.
- **Shoprenter összekötés** API-val: egy lépésben kapcsolat, vevőcsoportok és termékkatalógus betöltése.
- **Áttekintő dashboard:** mi van kész / mi a következő lépés, havi jelzőszámok (partnerek, widget-rendelések, termékek).
- **Csapatkezelés:** több felhasználó a céghez (admin vs. korlátozott szerep).
- **Beépített tudásbázis** a beállításhoz és hibaelhárításhoz.
- **Előfizetés-kezelés:** próba státusz, csomagválasztás (havi/éves), white-label opció.

### 2.2 Partnerárak (a termék magja a kereskedő oldalon)
A kereskedő **vevőcsoportonként** állítja a B2B árat — a bolton a partner ezt látja a widgetben.

Három rétegű árazás (prioritás szerint):

| Réteg | Mit csinál |
|-------|------------|
| **Fix kivételek** | Konkrét termékekhez rögzített partnerár (SKU-szint) |
| **Mennyiségi sávok** | „Ha legalább X db → Y Ft” — volumen kedvezmény |
| **Csoport %-kedvezmény** | Pl. Arany −10%, Ezüst −5% az egész listára |

Támogatott munkafolyamatok:
- Csoportok létrehozása / törlése (Shoprenterrel szinkronban).
- Tömeges árazás kategória vagy gyártó szerint.
- Árrés-figyelés, CSV/Excel export-import a fix árakhoz.
- Beépített **árazási útmutató** (stratégia: mikor fix, sáv vagy %).

### 2.3 Vevők és partner-CRM
- Teljes **vevőlista**: újak vs. partnerek, csoport, költés, keresés.
- **Tömeges átrakás** csoportok között; Excel import/export.
- **Vevőprofil:** rendeléstörténet, „mit vesz” termékek, forgalom (havi bontás), cégek/címek, csoportváltás-napló.
- Kézi felülírás: „ez a vevő ne menjen az automatába”.

### 2.4 Automatizmus (szintlépés)
- Szabályok: *ha X Ft / Y rendelés Z időszak alatt → csoport A → B*.
- Napi automatikus futtatás + manuális „most futtasd”.
- Irány: csak felfelé, vagy fel+le (türelmi idő, cooldown).
- A widgetben megjeleníthető **következő szint / jutalom** (FOMO) — a szabályokhoz igazítva.

### 2.5 Riport és üzleti átláthatóság
- Bevétel, rendelésszám, AOV, trend 3–24 hónapra.
- Vendég / új / partner funnel; widget vs. bolti mix.
- Vevőcsoportok teljesítménye.
- Top partnerek és top termékek.
- Cél: a kereskedő **lássa**, hogy a B2B réteg hogyan hoz forgalmat.

### 2.6 Widget vezérlőpult
- Gomb be/ki, felirat, szín, stílus, pozíció, méret — élő előnézettel.
- FOMO kapcsolók: csoportnév, következő szint progress, ingyenes szállítási küszöb.
- Egyszerű **telepítő útmutató** (egy script a Shoprenter sablonba).

---

## 3. Mit kap a viszonteladó (Bolti widget)

A partner a webshopon egy **„Gyors rendelés”** gombbal (vagy menülinkkel) nyit egy teljes rendelőfelületet — **nem kell külön B2B URL**.

### 3.1 Hozzáférés
- Bejelentkezés után; csak a jogosult (partner) vevőknek.
- Partnerár és készlet a **saját vevőcsoportja** szerint.

### 3.2 Rendelés felvétele (négy mód)
1. **Kézi:** cikkszám / gyári szám / vonalkód kereső + darabszám  
2. **Excel / CSV** feltöltés (sablonnal)  
3. **Szöveges lista** (e-mailből / jegyzetből bemásolt SKU-k)  
4. **Fotó / kézírás** → AI-szerű feldolgozás listává  

Minden importnál: ellenőrző lépés, majd élő ár- és készletellenőrzés.

### 3.3 Rendelési munkafelület
- Táblázatos lista: termék, készlet, db, kedvezmény-sáv jelzés, listaár vs. partnerár, sorösszeg.
- **Nettó / bruttó** váltás.
- Szűrés: mind / készleten / problémás tételek.
- Csomagolási szabályok (min. db, lépésköz).
- Összesítés: megtakarítás, ÁFA-bontás, figyelmeztetések.
- Egy kattintás: **kosárba** a Shoprenter kosárba — onnan a megszokott checkout.

### 3.4 Újrarendelés és listák
- **Rendeléseim:** korábbi rendelések, szűrés, Excel export, tételek visszatöltése új rendelésbe (eredeti / javasolt mennyiség).
- **Listáim:** mentett rendelési listák (pl. „heti feltöltés”), szerkesztés, gyors indítás új megrendelésbe.
- Piszkozat megmarad a munkamenetben (kilépés után is visszatérhető).

### 3.5 Intelligens kezdőlap
- „Mit rendelj ma?” — utolsó rendelés újra, gyakori / esedékes tételek, javasolt mennyiségek.
- Cél: **kevesebb keresés, több ismétlődő rendelés**.

### 3.6 Motiváció a panelen
- Ingyenes szállítás progress („még X Ft”).
- Partner szint / következő szint jutalom (ha a kereskedő bekapcsolta).

---

## 4. A teljes termék egy képen

```
Shoprenter bolt
      │
      ├── Merchant portál ─── árazás · vevők · automatizmus · riport · widget setup
      │
      └── Widget a bolton ─── partner belép → gyors rendelés → kosár → checkout
                                    ↑
                         partnerár + készlet + listák + újrarendelés
```

**Üzleti logika a középben:** ugyanaz a katalógus, ugyanazok a vevőcsoportok, ugyanaz az árazási motor szolgálja ki a portált és a widgetet.

---

## 5. Monetizáció (jelenlegi modell)

| Csomag | Bruttó / hó | Jelleg |
|--------|-------------|--------|
| **Gyors rendelés** | 7 500 Ft | Teljes termék, Turinova felirat a widgeten |
| **Saját márka** | 9 999 Ft | Ugyanaz + white-label (saját márka a partnerfelületen) |

- **14 napos próba**, self-serve signup.
- Éves előfizetés: 2 hónap kedvezmény.
- Soft kapacitás: akár ~500 aktív partner / hó, nagyméretű katalógus (tízezres SKU) — a limit nem a pitch, hanem infra-védelem.
- Fizetés v1: kereskedői választás + manuális aktiválás (kártyás checkout későbbi lépés).

---

## 6. Miért védhető / miért nem „csak egy gomb”

| Képesség | Miért számít |
|----------|----------------|
| **Réteges partnerár** (fix + sáv + %) | Valódi B2B árazás, nem egy globális kupon |
| **Többcsatornás rendelésfelvétel** (Excel, szöveg, fotó, kézi) | A viszonteladó meglévő munkamódjához igazodik |
| **Újrarendelés + listák + javaslatok** | Ismétlődő B2B forgalom, nem egyszeri kosár |
| **Automatikus szintlépés** | Partner-lifecycle a rendszerben, nem Excelben |
| **Riport a widget hatásáról** | A kereskedő méri a ROI-t |
| **Shoprenter-natív** | Nincs platformcsere; gyors telepítés, magyar piac |

---

## 7. Hol tart ma a termék (őszinte snapshot)

**Készen áll (működő termékfelszín):**
- Teljes merchant portál a fenti modulokkal  
- Teljes bolti widget (rendelés, listák, történet, insights, FOMO)  
- Shoprenter sync (termék, csoport, ár, rendelés-tények)  
- Self-serve trial + tudásbázis  

**Még nem „enterprise sales deck” szint:**
- Nincs beépített kártyás fizetés (Stripe) a portálon  
- Platform: elsősorban **Shoprenter** (nem multi-platform)  
- Nincs külön „sales agent / quote builder” modul (célzott későbbi bővítés lehet)  

A jelenlegi app **komplett go-to-market termék** a Shoprenter B2B gyors rendelés + partnerár problémára — nem MVP vázlat.

---

## 8. Egy mondatos pitch változatok

**Kereskedőnek:**  
„Partneráraid és viszonteladóid egy helyen; ők a bolton percek alatt rendelnek — te látod a forgalmat.”

**Befektetőnek:**  
„B2B rendelési réteg a meglévő Shoprenter boltra: self-serve SaaS, partnerár-motor, automatikus szintlépés és ismétlődő rendelés — magyar e-kereskedelmi sínre építve.”

---

*Forrás: a jelenlegi, éles kódbázis képességei. Technikai oldal-/API-leltár: `FEATURE_INVENTORY` belső változat vagy repo docs; ez a fájl a befektetői / üzleti olvasatra van hangolva.*
