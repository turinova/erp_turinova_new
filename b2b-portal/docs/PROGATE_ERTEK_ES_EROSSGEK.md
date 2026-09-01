# ProGate — részletes érték- és erősségelemzés

**Célközönség:** Shoprenteres nagyker / viszonteladós webshop-tulajdonos, értékesítő, döntéshozó  
**Termék:** ProGate (Turinova / HÍRÖS-ABLAK Kft.)  
**App:** https://app.progate.hu · Marketing: https://progate.hu  
**Kapcsolódó docs:** [`FEATURE_INVENTORY.md`](./FEATURE_INVENTORY.md) · [`PRICING_V6_CURRENT.md`](./PRICING_V6_CURRENT.md) · [`SAAS_ARCHITECTURE.md`](./SAAS_ARCHITECTURE.md) · [`B2B_PRICING_STRATEGIES.md`](./B2B_PRICING_STRATEGIES.md)

**Státusz:** A jelenlegi, éles kódbázis és dokumentáció alapján összeállított üzleti + termék mélyelemzés.  
**Utolsó frissítés:** 2026-09-01

---

## 0. Vezetői összefoglaló (1 oldal)

### Mi a ProGate?

SaaS **B2B rendelési réteg** a meglévő Shoprenter webshopra. A viszonteladó a bolton **Gyors rendelés** widgettel rendel (SKU, Excel, szöveg, fotó, listák, újrarendelés) — **saját partneráron**, készlettel. A kereskedő egy **merchant portálon** áraz, csoportosít, automatizál és mér. **Nincs külön B2B webshop**, nincs platformcsere.

### Miért érdemes bekötni?

| Probléma ma | ProGate válasz |
|-------------|----------------|
| E-mail / Excel rendelés = 15–20 perc / rendelés | Partner önkiszolgáló, percek alatt |
| Hibás SKU, várakozás, elveszett rendelés | Élő ár + készlet + ellenőrző lépés importnál |
| Shoprenter %-kedvezmény van, gyors rendelés nincs | Réteges partnerár + teljes rendelőfelület |
| Nem látod, mit hoz a B2B | Widget vs. bolti riport, top partnerek/termékek |
| Külön B2B shop = drága, lassú | Egy script + API a meglévő boltra |

### Ár (v6)

| Csomag | Bruttó / hó | Megjegyzés |
|--------|-------------|------------|
| **Gyors rendelés** | **7 500 Ft** | Teljes termék, ProGate felirat a widgeten |
| **Saját márka** | **9 999 Ft** | White-label (felirat elrejthető) |
| **Próba** | **14 nap** | Teljes termék, kártya nélkül |

Éves: 10× havi (= 2 hónap kedvezmény). Soft infra-cap: ~500 aktív partner / hó, ~80 000 SKU — nem a pitch része.

### Egy mondatos pitch

> A meglévő Shoprenter boltodra kapsz önkiszolgáló B2B gyors rendelést saját partnerárral; te egy portálon árazol, csoportosítasz és mérsz — külön B2B shop nélkül, havi pár ezer forintért.

---

## 1. A piaci fájdalom — pontosan, amit a nagyker érez

### 1.1 Tipikus mai folyamat

1. Partner e-mailben / telefonon / Excelben küldi a listát.  
2. Valaki a boltban **kézzel** keresi a cikkszámokat, ellenőrzi a készletet, beírja a kedvezményes árat.  
3. Visszaírás, javítás, hiányzó tétel, rossz egység.  
4. Végül kosár / rendelés a Shoprenterben vagy papíron.  
5. A következő héten **ugyanaz** újra.

**Idő:** gyakran 15–20 perc / rendelés.  
**Hiba:** minden ~20. kézi rendelésnél tipikus a javítási kör (rossz SKU, elírás, elavult ár).  
**Veszteség:** amíg a partner vár, **máshol is rendelhet**.

### 1.2 Miért nem elég a natív Shoprenter B2B?

Shoprenter ad:

- vevőcsoport-kedvezményt  
- belépéshez kötött árakat  
- bolti kosarat  

**Nem ad** dedikált:

- cikkszám-központú gyors rendelőt  
- Excel / fotó / szöveges lista → kosár flow-t  
- mentett listákat és „mit rendelj ma?” javaslatokat  
- réteges B2B árat (fix kivétel + sáv + %) egy merchant UI-ban  
- automatikus partner-szintlépést + widget FOMO-t  
- külön riportot a **widget-forgalom** hatásáról  

A ProGate pontosan ebbe a résbe ül: **B2B growth layer** a meglévő bolton — nem Billingo, nem Logzi, nem teljes ERP helyettesítő.

### 1.3 Kik a tipikus ICP (ideal customer profile)?

| Jellemző | Irány |
|----------|--------|
| Platform | Shoprenter |
| Modell | Nagyker / viszonteladó / disztribútor a webshopon |
| Partner bázis | kb. 5–200+ aktív B2B vevő |
| Rendelésmód ma | E-mail, Excel, telefon, ritkán bolti böngészés |
| Katalógus | Több száz – több ezer SKU (tízezres is OK) |
| Fájdalom | Adminidő + lassú partnerélmény + elveszett forgalom |

**Nem ICP (most):** multi-platform (Shopify/Unas elsődleges), teljes ERP-t kereső, sales-agent quote builder igényű enterprise.

---

## 2. Architektúra — miért „komplett termék”, nem gomb

```
┌────────────────────────────────────────────────────────────┐
│  ProGate (egy Next app)                                    │
│  Merchant portál · Platform admin · /widget.js · API-k     │
└────────────────────────────┬───────────────────────────────┘
                             │
                      shared Postgres
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        katalógus sync   partnerár-motor   b2b_orders
        (SKU, stock)     (fix/sáv/%)       (widget fact)
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    Shoprenter bolt
              (kosár + checkout marad natív)
```

**Kulcselv:**

| Réteg | Ki az igazság |
|-------|----------------|
| Áru, listaár, kosár, checkout | **Shoprenter** (channel SoR) |
| Partnerár-szabály, vevő ujjlenyomat, widget rendelés-tény, riport | **ProGate Postgres** (operatív SoR) |
| Storefront rendelés UX | **Widget** a meglévő bolton |

A partner **nem** új URL-re megy: a boltodon nyitja a gyors rendelőt, a kosár a tiéd.

**Telepítés nagyjából:**

1. Regisztráció / próba  
2. Shoprenter API összekötés → csoportok + katalógus  
3. Egy script a sablonba  
4. Partnerár beállítás  
5. Élő demó órák–napok alatt (bolt függvénye)

---

## 3. Widget erősségek — amit a viszonteladó naponta használ

Ez a termék **látható** fele. Ha a partner szeret rendelni, a boltulaj fizet.

### 3.1 Hozzáférés és jogosultság

- Csak **belépett**, jogosult (partner) vevőknek.  
- Ár és készlet a **saját vevőcsoport** szerint.  
- Kill switch a portálon (`widget_enabled`) — biztonsági / üzemeltetési kontroll.

### 3.2 Négy rendelésfelvételi mód

| Mód | Mikor használja a partner | Miért erős |
|-----|---------------------------|------------|
| **Kézi kereső** | Ismeri a cikkszámot / gyári számot / vonalkódot | Typeahead, gyors db-beírás |
| **Excel / CSV** | Van kész listája, sablonnal | Tömeges felvétel, ellenőrző lépés |
| **Szöveges lista** | E-mailből / jegyzetből bemásol | Nincs fájl-export kör |
| **Fotó / kézírás** | Papírlista, raktári cetli | AI-szerű feldolgozás listává |

Minden importnál: **ellenőrzés → élő ár- és készletellenőrzés** → kosár.  
Ez a nagyker meglévő munkamódjához igazodik — nem kényszerít „böngéssz a webshopban” DTC-élményt.

### 3.3 Rendelési munkafelület

- Táblázatos lista: termék, készlet, db, kedvezmény-sáv, listaár vs. partnerár, sorösszeg  
- **Nettó / bruttó** váltás  
- Szűrés: mind / készleten / problémás tételek  
- Csomagolási szabályok (min. db, lépésköz)  
- Összesítés: megtakarítás, ÁFA-bontás, figyelmeztetések  
- **Egy kattintás → Shoprenter kosár** → megszokott checkout  

**Üzleti hatás:** a partner percek alatt „kész” rendelést rak a ti kosaratokba; te nem másolsz Excelből.

### 3.4 Újrarendelés, listák, kezdőlap

| Funkció | Érték |
|---------|--------|
| **Rendeléseim** | Korábbi rendelések, szűrés, Excel export, tételek visszatöltése |
| **Listáim** | Mentett listák (pl. „heti feltöltés”), gyors indítás |
| **Piszkozat** | Munkamenetben megmarad |
| **„Mit rendelj ma?”** | Utolsó rendelés, gyakori / esedékes tételek, javasolt mennyiség |

Ez **ismétlődő B2B forgalomra** épít. A nagyker nem egyszeri kosarat akar, hanem heti/havi rutint — a listák és javaslatok ezt sticky-vé teszik.

### 3.5 Motiváció a panelen (FOMO)

Ha a kereskedő bekapcsolja:

- Ingyenes szállítás progress („még X Ft”)  
- Partner szint / **következő szint** jutalom (szintlépési szabályokhoz kötve)  

A partner **látja**, miért érdemes többet / gyakrabban rendelni — nem csak a boltulaj tudja a háttérben.

### 3.6 Widget összefoglaló — „miért szeretné a partner?”

1. Gyorsabb, mint e-mail.  
2. Látja a **saját** árát és a készletet.  
3. A meglévő listáival dolgozik (Excel/fotó).  
4. Újrarendelés egy kattintással.  
5. Nem kell új B2B portálra tanulnia — a **megszokott bolton** van.

---

## 4. Merchant portál erősségek — amit a boltulaj fizet

### 4.1 Indítás és üzemeltetés

- Önkiszolgáló **signup + 14 nap próba**  
- Shoprenter **API összekötés** (vevőcsoportok, katalógus)  
- **Dashboard:** mi kész / mi a következő lépés; havi jelzőszámok  
- **Csapat:** több user, szerepkörök  
- **Tudásbázis** a portálban (összekötés, script, szinkron, Excel)  
- **Előfizetés:** próba státusz, csomag (Gyors rendelés / Saját márka), éves opció  

### 4.2 Partnerár-motor (a termék magja)

A bolton a partner a widgetben **ezt** az árat látja. Prioritás (egyszerűsítve):

```
1. Fix kivétel (SKU-szintű partnerár)
2. Mennyiségi sáv („legalább X db → Y Ft”)
3. Csoport %-kedvezmény (pl. Arany −10%)
4. Listaár
```

**Munkafolyamatok:**

- Csoportok létrehozása / törlése (Shoprenterrel szinkronban)  
- Tömeges árazás **kategória / gyártó** szerint  
- Árrés-figyelés  
- CSV/Excel export-import fix árakhoz  
- Beépített **árazási útmutató** (mikor fix, sáv, %)  

**Miért nem „csak egy kupon”?**  
A nagykernek vegyes stratégia kell: kulcstételeken fix ár, volumenre sáv, tömegre %. Egy rétegű %-kedvezmény ezt nem fedi.

### 4.3 Vevők és partner-CRM

- Teljes vevőlista: újak vs. partnerek, csoport, költés, keresés  
- Tömeges átrakás csoportok között; Excel import/export  
- **Vevőprofil:** rendeléstörténet, „mit vesz”, forgalom havi bontásban, címek, csoportváltás-napló  
- Kézi felülírás: „ez a vevő ne menjen az automatába”  

**Érték:** az értékesítő / ügyfélszolgálat **30 másodperc alatt** látja, mit tegyen a partnerrel — nem Excel-ből vadászik.

### 4.4 Automatizmus (szintlépés)

- Szabályok: *ha X Ft / Y rendelés Z időszak alatt → csoport A → B*  
- Napi automata + manuális „most futtasd”  
- Irány: csak felfelé, vagy fel+le (türelem, cooldown)  
- Widgeten: **következő szint / jutalom** megjelenítés  

**Érték:** a partner-lifecycle a rendszerben él, nem „évente egyszer átnézzük az Excel csoportokat”.

### 4.5 Riport és átláthatóság

- Bevétel, rendelésszám, AOV, trend (3–24 hó)  
- Vendég / új / partner funnel  
- **Widget vs. bolti mix** — látod, mit hoz a B2B réteg  
- Vevőcsoportok teljesítménye  
- Top partnerek és top termékek  

**Érték:** a 7 500 Ft/hó döntés **adatból** jön, nem érzésből. A próba után meg tudod mutatni: „ennyi widget-rendelés, ennyi időspórolás”.

### 4.6 Widget vezérlőpult

- Gomb be/ki, felirat, szín, stílus, pozíció, méret — **élő előnézet**  
- FOMO kapcsolók: csoportnév, következő szint, ingyenes szállítási küszöb  
- Telepítő útmutató: egy script a Shoprenter sablonba  

---

## 5. A teljes értékajánlat egy képen

```
NAGYKER (merchant)                    VISZONTELADÓ (partner)
─────────────────                    ──────────────────────
Áraz (fix / sáv / %)                  Belép a boltra
Csoportosít + automata szint         Gyors rendelés gomb
Látja a riportot                     SKU / Excel / fotó / lista
Beállítja a widgetet                 Látja a saját árát + készletet
                                     Kosárba → ti checkoutotok
         └── ugyanaz a katalógus + csoport + ármotor ──┘
```

**Egy termék, két felület, egy üzleti logika.**

---

## 6. Üzleti indoklás — számok, ROI, FOMO

### 6.1 Adminidő (példa-kalkulus)

Feltételezés (a landing kalkulátor alapértelmezéseihez igazítva):

| Paraméter | Példa |
|-----------|--------|
| Havi B2B rendelés | 120 |
| Perc / kézi felvétel | 20 |
| Órabér (bruttó bérköltség) | 5 000 Ft |
| Hibajavítás | minden 20. rendelés, ~15 perc |

**Kézi munka / hó:**  
\(120 × 20 / 60 ≈ 40\) óra + hibajavítás ≈ **42 óra**  
**Költség / hó:** ≈ **200 000+ Ft**  
**Évente:** ≈ **2,4–2,5 M Ft** tartomány  

**ProGate:** 7 500 Ft/hó ≈ **egy átlagos vacsora ára** — a fenti veszteség töredéke.

> A pontos szám boltfüggő. A lényeg: a plugin ára **nem** a döntés nehéz része; az elveszett órák és a várakozó partner az.

### 6.2 Forgalmi / verseny FOMO

Amíg a partner e-mailre vár:

- máshol is megrendelheti ugyanazt  
- a te „sticky” rutinod nem alakul ki (nincs lista, nincs újrarendelés)  
- az értékesítőd adminisztrál, nem értékesít  

A widget **gyorsaságot + saját árat + rutint** ad — ez tartja a partnert a te boltodon.

### 6.3 Mit mér a próba alatt? (14 nap checklist)

1. Legalább 1–3 top partner kipróbálja a widgetet.  
2. Van-e Excel/lista flow, ami nálatok tipikus?  
3. Látszik-e a riportban widget-rendelés?  
4. Mennyi adminidőt spórolt az első hét?  
5. Döntés: Gyors rendelés vs. Saját márka (felirat).

### 6.4 Árpozíció a döntésben

| Érv | Üzenet |
|-----|--------|
| Abszolút ár | 7 500 Ft bruttó / hó |
| Relatív ár | ≈ 1 vacsora / hó a kézi admin millióihoz képest |
| Kockázat | 14 nap teljes termék, kártya nélkül |
| Upsell | Saját márka +2 499 Ft (white-label) |
| Éves | 2 hónap kedvezmény |

**Fontos (őszinte):** v1 fizetés mailto + admin aktiválás (nincs Stripe a portálon). A termék megy; a kartya-checkout későbbi lépés.

---

## 7. Összehasonlító keret — mihez képest erős?

| Alternatíva | Hol gyengébb a ProGate-hez képest | Hol erősebb az alt. |
|-------------|----------------------------------|---------------------|
| **Csak Shoprenter csoport-%** | Nincs gyors rendelő, lista, újrarendelés, szintlépés UI | Már benne van a platformban |
| **Külön B2B webshop** | Drága, lassú, két katalógus | Teljes elszigetelés |
| **Excel + e-mail örökké** | Null költség látszólag — de drága az idő | Nincs szoftverköltség |
| **Általános ERP** | Túl nagy, nem „widget a bolton” | Raktár / számlázás / teljes back-office |
| **Külföldi B2B layer (pl. SparkLayer-szerű)** | Nem Shoprenter-natív HU, ár, support | Érettebb multi-platform / sales agent |

**ProGate pozíció:**  
„Shoprenteres nagykernek a **leggyorsabb út** a self-serve B2B rendeléshez a meglévő bolton — magyar supporttal, ésszerű áron.”

---

## 8. Védettség — miért nem másolható egy hétvége alatt

| Képesség | Miért számít |
|----------|----------------|
| Réteges partnerár (fix + sáv + %) | Valódi B2B, nem kupon |
| Többcsatornás felvétel (Excel, szöveg, fotó, kézi) | Partner rutinjához igazodik |
| Újrarendelés + listák + javaslatok | Ismétlődő forgalom |
| Automatikus szintlépés + widget FOMO | Lifecycle a termékben |
| Riport a widget hatásáról | Mérhető ROI |
| Shoprenter sync + shared schema multi-tenant | Éles SaaS gerinc |
| Merchant + widget + tudásbázis + trial | Go-to-market kész csomag |

A „FAB gomb” könnyű. A **ármotor + sync + listák + riport + trial** együtt már termék.

---

## 9. Hol tart ma — őszinte snapshot

### Készen áll (működő termékfelszín)

- Teljes merchant portál (árak, vevők, szint, riport, widget, csapat, csomag)  
- Teljes bolti widget (rendelés, listák, történet, insights, FOMO)  
- Shoprenter sync (termék, csoport, ár, rendelés-tények)  
- Self-serve trial + tudásbázis  
- Soft cap 500 partner / 80k SKU  

### Még nem enterprise sales deck szint

- Nincs beépített Stripe a portálon  
- Elsősorban **Shoprenter** (nem multi-platform)  
- Nincs külön sales-agent / quote builder modul  

**Következtetés:** komplett **go-to-market termék** a Shoprenter B2B gyors rendelés + partnerár problémára — nem MVP vázlat. A hiányzó elemek upsell / következő fázis, nem blocker az első 10–50 fizető boltnál.

---

## 10. Demó és sales script (részletes)

### 10.1 15 perces élő demó struktúra

| Perc | Mit mutatsz | Mit mondasz |
|------|-------------|-------------|
| 0–2 | Fájdalom | „Ma e-mailben jön a lista — 15–20 perc / rendelés.” |
| 2–7 | **Widget** | Belépés → Excel/lista → partnerár → kosár |
| 7–11 | **Árak** | Fix / sáv / % egy csoportnál |
| 11–13 | **Szint + riport** | „A partner látja a következő szintet; te a widget-mixet.” |
| 13–15 | **Ár + próba** | 7 500 Ft, 14 nap, ma indítható |

### 10.2 Ellenvetések és válaszok

| Ellenvetés | Válasz |
|------------|--------|
| „Van már csoportkedvezményünk.” | Az ár megvan; a **gyors felvétel + listák + újrarendelés** nincs. |
| „Drága.” | Számold ki 50–100 rendelés × 15 perc irodai költségét vs. 7 500 Ft. |
| „Nincs idő telepíteni.” | API + egy script; első partnereknek gyakran órák–napok. |
| „A partnereim nem fogják használni.” | Próbáld a top 3-mal a 14 nap alatt — Excel/fotó a meglévő rutinjuk. |
| „Kell külön B2B shop?” | Nem. A meglévő Shoprenter boltra épül. |
| „Mi van a próba után?” | Ugyanaz a termék; Gyors rendelés vagy Saját márka. |

### 10.3 Záró CTA-k (copy)

- „Ingyen kipróbálom →” (14 nap)  
- „Kezdd a próbát” (árkártya)  
- „Írj a info@turinova.hu címre” (demo egyeztetés)

---

## 11. Pitch változatok (kész szöveg)

### 11.1 Nagykernek (rövid)

„Partneráraid és viszonteladóid egy helyen; ők a boltodon percek alatt rendelnek Excelből, listából vagy fotóból — te látod a forgalmat. Nincs külön B2B shop. 14 nap próba, utána 7 500 Ft/hó.”

### 11.2 Nagykernek (hosszú)

„Ha a viszonteladóid e-mailben és Excelben rendelnek, minden rendelés irodai időt és hibát visz. A ProGate a meglévő Shoprenter boltodra tesz egy Gyors rendelés réteget: a partner saját áron, készlettel, listákkal és újrarendeléssel dolgozik; te a portálon állítod a fix árakat, sávokat és csoportokat, automatizálod a szintlépést, és méred, mit hoz a widget. Nem kell platformot cserélni. 14 napig a teljes termék a tiéd.”

### 11.3 Befektetőnek / stratégiai partnernek

„B2B rendelési réteg a meglévő Shoprenter boltra: self-serve SaaS, partnerár-motor, automatikus szintlépés és ismétlődő rendelés — magyar e-kereskedelmi sínre építve, alacsony belépőárral és gyors time-to-value-val.”

### 11.4 Egy mondat a landing / email tárgyhoz

„Gyorsabb feldolgozás neked. Könnyebb rendelés a partnerednek. Több forgalom mindkettőtöknek.”

---

## 12. Funkció → haszon mátrix (gyors referencia)

| Funkció | Haszon a boltulajnak | Haszon a partnernek |
|---------|----------------------|---------------------|
| Excel / fotó / szöveg import | Kevesebb manuális felvétel | Meglévő listával dolgozik |
| Réteges partnerár | Kontrollált árrés, stratégia | Megbízható saját ár |
| Mennyiségi sáv | Volumen-ösztönző | Látja, mikor olcsóbb |
| Listáim / újrarendelés | Ismétlődő forgalom | Perc alatt heti lista |
| Szintlépés + FOMO | Automatikus lifecycle | Motiváció több rendelésre |
| Riport widget-mix | ROI a próba után | — |
| Shoprenter kosár | Natív checkout, kevesebb IT | Megszokott fizetés |
| 14 nap próba | Alacsony kockázat | Kipróbálható élőben |
| 7 500 Ft/hó | Könnyű igen | — |
| Saját márka | Brand kontroll | Tisztább boltélmény |

---

## 13. Ajánlott onboarding sorrend (első 14 nap)

| Nap | Teendő | Kész = |
|-----|--------|--------|
| 0 | Signup, API kulcs, sync indul | Bolt összekötve |
| 0–1 | Script a footerbe, widget be | Gomb látszik a bolton |
| 1–2 | 1–2 vevőcsoport + alap % vagy fix minta | Partnerár él |
| 2–3 | Belső teszt + 1 barátságos partner | Első widget-kosár |
| 3–7 | Top 3–5 partner meghívása | Rendszeres használat |
| 7–10 | Szintlépés / FOMO finomhangolás (opcionális) | Motiváció a panelen |
| 10–14 | Riport átnézés, csomagválasztás | Döntés fizetésről |

---

## 14. Kapcsolódó dokumentumok

| Dokumentum | Mit ad |
|------------|--------|
| [`FEATURE_INVENTORY.md`](./FEATURE_INVENTORY.md) | Befektetői / termék képességlista |
| [`PRICING_V6_CURRENT.md`](./PRICING_V6_CURRENT.md) | Aktuális árak, trial, feature gate |
| [`SAAS_ARCHITECTURE.md`](./SAAS_ARCHITECTURE.md) | Multi-tenant, határok, sync elvek |
| [`B2B_PRICING_STRATEGIES.md`](./B2B_PRICING_STRATEGIES.md) | Partnerár-stratégiák részlete |
| [`ARAK_MERCHANT_GUIDE.md`](./ARAK_MERCHANT_GUIDE.md) | Merchant árazási útmutató |
| [`DATABASE.md`](./DATABASE.md) | Táblák, widget_settings, b2b_orders |

---

## 15. Záró ítélet

A ProGate **akkor érdemes bekötni**, ha:

1. Shoprenteres a boltod, és van **ismétlődő B2B / viszonteladói** rendelésed;  
2. Ma e-mail / Excel / telefon viszi az adminidőt;  
3. Nem akarsz külön B2B shopot építeni;  
4. Szeretnéd, hogy a partner **önkiszolgálva**, saját áron, listákkal rendeljen;  
5. 14 nap alatt ki akarod mérni a hatást alacsony kockázattal.

**Nem** akkor az első tool, ha teljes ERP-t, multi-platformot vagy sales-agent quotingot keresel — ezek későbbi / más termékek.

A jelenlegi app **elegendően erős** ahhoz, hogy az első fizető Shoprenteres nagykereknél értékesítsd: a widget a partnernek gyors, a portál a boltulajnak kontrollt és mérést ad, az ár pedig a kézi admin költségéhez képest elhanyagolható.

---

*Készült a ProGate kódbázis és a `b2b-portal/docs` dokumentáció alapján. Frissítéskor ellenőrizd a `FEATURE_INVENTORY.md` és `PRICING_V6_CURRENT.md` egyezését a kóddal (`src/lib/billing/plans.ts`).*
