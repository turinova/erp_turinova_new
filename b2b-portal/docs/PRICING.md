# Turinova B2B — árazás (**v6**)

**Dátum:** 2026-08-27 · **v6** — belépő 7 500 + saját márka 9 999  
**Kód:** `sql/031_plans_v6.sql` + `src/lib/billing/plans.ts`

### Hivatalos ártábla (v6)

| Tétel | Bruttó / hó |
|-------|-------------|
| **Gyors rendelés** (Turinova felirattal) | **7 500 Ft** |
| **Saját márka** (Turinova felirat nélkül) | **9 999 Ft** |
| Felirat-eltávolítás felár | **+2 499 Ft** |
| Éves | 10× havi (2 hónap kedvezmény) |
| Próba | **14 nap**, teljes termék, felirat **bent** |
| Aktív vevő soft cap | 500 (nem pitch) |

Az árak **bruttó** (ÁFÁS).

**Plan ID-k (DB):** `start` = alap · `plus` / `pro` = saját márka (felirat elrejthető a widget beállításokban).

Az alábbi v3/v4/v5 szöveg történeti; ahol ütközik, **a v6 a mérvadó**.

**Teljes aktuális spec:** [`PRICING_V6_CURRENT.md`](./PRICING_V6_CURRENT.md) — trial 14 nap, soft cap 500, fotó minden csomagon, két merchant csomag.

> ⚠️ **Archív figyelmeztetés:** A dokumentum alábbi v3 szekciói (30 napos próba, 6 900/12 900/24 900, top 15/40/120, fotó=Pro) **nem tükrözik a jelenlegi kódot**. Implementációhoz csak a fenti v6 blokk + `PRICING_V6_CURRENT.md`.

---

# (Archív — v5)

# Turinova B2B — árazás (**v5**)

**Dátum:** 2026-08-26 · **v5** — egy alapár + opcionális Turinova-felirat eltávolítás  
**Kód:** `sql/028_plans_v5.sql` + `src/lib/billing/plans.ts`

### Hivatalos ártábla (v5)

| Tétel | Nettó / hó |
|-------|------------|
| **Gyors rendelés** (teljes termék) | **9 900 Ft** |
| **Turinova felirat eltávolítása** (opcionális) | **+4 900 Ft** |
| Összesen saját márkával | **14 800 Ft** |
| Éves | 10× havi (2 hónap kedvezmény) |
| Próba | **14 nap**, teljes termék, felirat **bent** |
| Aktív vevő soft cap | 500 (nem pitch) |

**Plan ID-k (DB):** `start` = alap · `plus` / `pro` = saját márka (felirat elrejthető).

Az alábbi v3/v4 szöveg történeti; ahol ütközik, **a v5 a mérvadó**.

---

# (Archív)

# Turinova B2B — árazás, próba, FOMO (v3)

**Scope:** `b2b.turinova.hu` gyors rendelés (widget + merchant portál + platform admin)  
**Státusz:** Az árazás, a próba, az ICP és a merchant/admin csomag-UX **source of truth**.  
**Dátum:** 2026-08-18 · **v3.1** (ICP + kannibalizáció + `erp_qualified`; az árak v3-mal azonosak)  
**Előző létra (v2, hatályon kívül):** Start 14 900 / Grow 34 900 / Pro 69 900 / Scale 139 900.  
**Kód:** `sql/019_plans_v3.sql` a kézi migráció. Ez a dokumentum a cél; a kód nem térhet el hallgatólagosan.

Kapcsolódó:

| Dokumentum | Szerep |
|------------|--------|
| [`PLATFORM_AND_ADMIN_IMPLEMENTATION.md`](./PLATFORM_AND_ADMIN_IMPLEMENTATION.md) | Motor, sync, admin health, D-döntések. Árazás: **ez a fájl**. |
| [`SAAS_ARCHITECTURE.md`](./SAAS_ARCHITECTURE.md) | Tenancy, invite-only |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | Olvasó / high_contrast, radius 0 |
| [`DATABASE.md`](./DATABASE.md) | Manuális SQL |

---

## Tartalom

1. [Mi ez a termék, és mi nem](#1-mi-ez-a-termék-és-mi-nem)
2. [Kutatás: Shopify és Shoper.pl](#2-kutatás-shopify-és-shoperpl)
3. [Pszichológia: mit veszünk át, mit utasítunk el](#3-pszichológia-mit-veszünk-át-mit-utasítunk-el)
4. [Hivatalos ártábla](#4-hivatalos-ártábla)
5. [Miért ezek a számok](#5-miért-ezek-a-számok)
6. [Miért három csomag](#6-miért-három-csomag)
7. [Aktív vevő mint meter](#7-aktív-vevő-mint-meter)
8. [Feature-kapuk](#8-feature-kapuk)
9. [SKU soft cap (háttér)](#9-sku-soft-cap-háttér)
10. [Próba (30 nap Pro, logó kivétel)](#10-próba-30-nap-pro-logó-kivétel)
11. [Lejárat: a widget nem hal meg](#11-lejárat-a-widget-nem-hal-meg)
12. [Éves fizetés](#12-éves-fizetés)
13. [ERP viszony és `erp_qualified`](#13-erp-viszony)
14. [Merchant UX és FOMO-idővonal](#14-merchant-ux-és-fomo-idővonal)
15. [Copy-szabályok](#15-copy-szabályok)
16. [Admin UX](#16-admin-ux)
17. [E-mail (Shoper pro forma)](#17-e-mail-shoper-pro-forma)
18. [Amit szándékosan nem csinálunk](#18-amit-szándékosan-nem-csinálunk)
19. [Adatmodell és plan ID](#19-adatmodell-és-plan-id)
20. [Implementációs sorrend](#20-implementációs-sorrend)
21. [Lezárt vs nyitott](#21-lezárt-vs-nyitott)
22. [V2 → v3 változásnapló](#22-v2--v3-változásnapló)

---

## 1. Mi ez a termék, és mi nem

### 1.1 Döntés

A gyors rendelés **Shoprenter-plugin**. Nem ERP, nem „második rendszer”, nem gomb (a gomb = a lebegő gomb a boltban; a funkció neve mindig **gyors rendelés**).

A vevő: Shoprenter-es B2B/nagyker webshop, akit **mi hívunk meg**. Nincs nyilvános signup, nincs Free csomag a launchnál.

### 1.2 Miért

A Shoprenter-bolt már fizet a Shoprenternek. Mellé **még egy app** fér a fejében (pár ezer Ft). Egy **15–70 ezres szoftver** második rendszer — más beszerzési kör, más döntéshozó, hosszabb ciklus.

A 2 500 Ft-os „olcsó gomb” vevő **nem** az ERP ICP. A 70 ezres Pro a launchon **üres bolt**. A plugin-ár + próba + méret szerinti drágulás hozza a volument; az ERP külön conversatio, 4–6 hónap widget-forgalom után.

### 1.3 Két számla, két termék

| Termék | Ár jellege | Mikor |
|--------|------------|-------|
| Gyors rendelés | havi plugin | most |
| Turinova ERP | bevezetés + havi | később, ha a rendelés a cég motorja |

A widget **sosem jár ingyen** az ERP-hez. Az ERP **nincs** a plugin ártábláján — egy mondat a `/csomag` alján.

### 1.4 Kit hívunk meg (ICP) — v3.1

Az **ár nem szűr ICP-t.** Invite-only: aki bekerül, azt mi választjuk. A 6 900 nem húz be 80 random Shoprenter-shopot.

| | Vadászmező | Ha bejön magától |
|--|------------|------------------|
| **Kik** | Nagyker / B2B, ~40+ rendelő partner, 5+ fő, van ember a rendelésfeldolgozáson | 15 partneres kis bolt |
| **Csomag** | Plus vagy Pro (post-trial) | Start — bevétel, nem funnel |
| **Sales-idő** | Igen | Nem. Nem keressük. |

A 15 partneres bolt **három év múlva is 15 partneres** marad. Ő nem vesz 490 ezres ERP-t. Supportot enni rajta, aztán upsell-t várni: rossz tölcsér.

**Belső sikermetrika:** hány `erp_qualified` tenant, nem hány fizető. A plugin ROI-ja a kvalifikált lista.

**Hírös-Ablak:** az ERP első referencia **párhuzamosan**, 3–4 hónap. Nélküle a tölcsér vége üres — ez nem árazási kérdés.

---

## 2. Kutatás: Shopify és Shoper.pl

A v3 létrát nem „érzésből” raktuk 14 900 alá. A CEE és a Shopify plugin-piac konkrét árai:

### 2.1 Shopify — a mi analogunk

**WSH Order Form & ReOrder** (tömeges / gyors rendelés, 4.9★):

| Csomag | USD / hó | ~Ft / hó | Trial |
|--------|----------|----------|-------|
| Basic | 15,99 | ~5 800 | 8 nap |
| Professional | 19,99 | ~7 200 | 8 nap |
| Enterprise | 24,99 | ~9 000 | 8 nap |

Éves −10 / −15 / −20% **ugyanazon a kártyán**. A három csomag **majdnem ugyanaz a termék**; a különbség 1–2 extra (min/max qty, újrarendelés). Nincs 4. oszlop. Nincs ERP a listingen.

**Wholesale Pricing Discount B2B** (árazás, nettó, csoportok — nálunk ezt a Shoprenter adja, nem mi): 24,99–64,99 USD (~9–23 000 Ft). Ez **más job**. A gyors rendelés önmagában a 16–25 USD zóna.

**Klaviyo:** „Free to install” + usage (*Upgrade as you grow*). A meter a **dashboardon** van, nem a Beállítások alján.

**Shopify Billing API default trial:** 7 nap. 14 nap, ha kell integráció. 30 nap ritka — **kivéve** sales/upsell app, ahol forgalom kell az ROI-hoz. A mi catalog-szinkronunk + B2B rendelési ritmus = 30 nap **indokolt**, 7 nap nem.

### 2.2 Shoper.pl App Store (Shoprenter-unokatestvér)

| Típus | Ár | ~Ft |
|-------|-----|-----|
| Tipikus widget (popup, kosár) | 30–50 zł | ~2 800–4 600 |
| Erősebb integráció (Apilo 3 nagyker) | 99 zł | ~9 000 |
| Hivatalos minta Silver / Gold / Platinum | 30 / 60 / 90 zł | ~2 800 / 5 500 / 8 300 |

Időszakos csomag: *80 zł zamiast 90 zł* (áthúzott ár, 3/6/12 hónap). A platform 14 napos próbája **kártya nélkül**; **1. napon pro forma** megy ki, hogy ne legyen meglepetés. Fizetés elmaradása a **Shoper-shopot** kapcsolja ki — ez a platform, nem a plugin viselkedése.

ShopGadget promo-sáv: lejárt `00:00:00` countdown. **Ne másoljuk.**

### 2.3 Következtetés a belépőárra

| Ár | Mit jelent a bolt fejében |
|----|---------------------------|
| 2 500 Ft | szemétapp / gomb; support megeszi; ERP-pipeline halott |
| 4 900 Ft | Shoper popup zóna — a mi termékünk nem popup |
| **6 900 Ft** | Shopify $19 order-form zóna, CEE-ben „még egy app” |
| 14 900 Ft | a **harmadik** Shopify-csomag ára, nem a belépő; „második szoftver” |
| 34–70 ezer | ERP-beszélgetés, nem plugin-install |

**6 900 a padló.** 5 900 a végső kompromisszum, ha a 6 900 a Shoprenter-piactéren még mindig fal. 2 500 nincs a táblán.

---

## 3. Pszichológia: mit veszünk át, mit utasítunk el

### 3.1 Átvesszük

| Elv | Honnan | Nálunk |
|-----|--------|--------|
| Plugin, nem szoftver | Shopify listing, Shoper 30–99 zł | 6 900 belépő |
| 3 csomag, Good / Better / Best | WSH, Shoper Silver–Platinum | Start / Plus / Pro |
| Ugyanaz a termék, más **méret** | WSH $16/$20/$25 | vevőlimit a fő különbség |
| Charm price | mindkét piac | 6 900, 12 900, 24 900 — soha 7 000 / 15 000 |
| „From …” a kártyán | Shopify App Store | 6 900-tól |
| Középső = Ajánlott | SaaS Most Popular | **Plus**, nem Pro |
| Usage meter a home-on | Klaviyo, „4 of 5 pages” | aktív vevő sáv |
| Upgrade a **saját számmal** | TSC Shopify conversion | „Tartsd a 23 vevőt” |
| Zárolt funkció: kattintás → unlock | in-app paywall | logó, fotó |
| Trial-ending: dátum + ár + veszteség + kilépő út | Apple / Shopify billing honesty | `Maradok Starten` látszik |
| Ár az **1. napon** | Shoper pro forma, Shopify sticker-shock | meghívó + idővonal |
| Éves −~2 hónap | WSH 10–20%, Shoper *zamiast* | 11× havi, mailto |
| FOMO siker után, nem naptárból | ethical urgency, első 72 óra | 16. vevő, első rendelés, ≤7 nap |
| Chip mindig, banner ritkán | dashboard countdown +28%, ne overexpose | héj-chip; home banner max ~3/hét |

### 3.2 Elutasítjuk

| Minta | Miért nem |
|-------|-----------|
| Piros timer, „csak ma”, „utolsó 3 hely” | Dark pattern; 1-star; ShopGadget 00:00:00 |
| Shoper „fizess most 34% olcsóbban” a próba alatt | Hamis launch-kedvezmény |
| Widget ölése lejáratkor | Shoprenter-demó (M6 tiltva); a bolt bevételét nem büntetjük |
| 8 cellás feature-mátrix | Plugin-érzés elvész |
| 4. nyilvános csomag (Scale) | Döntési fáradtság; Egyedi = email |
| Disabled checkbox FOMO nélkül | Gyengébb, mint a kattintásos unlock |
| FOMO a 0. naptól a home tetején | Nincs még „aha”; idegesít, nem konvertál |
| A Start elrejtése a döntő képernyőn | Apple/Shopify: a kilépő út tiszta. Start = fizetős minimum, nem Free zuhanás |

### 3.3 A három FOMO-motor, amire építünk

1. **Endowment** — 30 napig Pro-t *használ*. Utána a 15-ös keret veszteség, nem „nem kapott extra feature-t”.
2. **Loss aversion a saját számmal** — „23-an rendeltek, Starten 15-öt látnál.” Az ő adatuk az eladó.
3. **Decoy** — a próba Pro (24 900). A menekülőút Plus (12 900), nem a Start. A célkonverzió trial után **Plus**.

---

## 4. Hivatalos ártábla

Nettó Ft / hó. Áfa a számlán (v1: manuális számla, nincs Stripe).

| | **Start** | **Plus** ★ | **Pro** |
|---|---|---|---|
| **Havi** | 6 900 Ft | 12 900 Ft | 24 900 Ft |
| **Éves (10× = 2 hónap ajándék)** | 69 000 Ft | 129 000 Ft | 249 000 Ft |
| Aktív vevő / naptári hó | 15 | 40 | 120 |
| Ft / vevő (havi, teli keret) | 460 | 323 | 208 |
| Widget, typeahead, Excel, listák | igen | igen | igen |
| Alap vevők + alap riport | igen | igen | igen |
| Fotó → lista | — | — | igen (próba alatt is) |
| Turinova a panel alján | marad | marad | levehető (**nem** próba alatt) |
| Árrés / NRR / alvó vevő | — | — | **nincs a pluginban** (ERP-horog) |
| Soft SKU (nem a pitch) | 15 000 | 40 000 | 80 000 |

**Egyedi (120+ vevő):** nincs kártya. `hello@turinova.hu`. Admin: `partner_limit_override`. Floor: Pro listaára.

**Ajánlott chip:** Plus.  
**Próba alatt a Pro sor:** `Most ezt használod` — tény, nem dicsekvés.

---

## 5. Miért ezek a számok

### 5.1 Start 6 900 / 15 vevő

| Kérdés | Válasz |
|--------|--------|
| Miért nem 2 500? | Support + „olcsó gomb” vevő. Shopify: &lt;$15 = commodity churn. Nem ERP ICP. |
| Miért nem 4 900? | Shoper popup. A gyors rendelés WSH-analog, nem popup. |
| Miért nem 14 900? | CEE plugin-elvárás 3–9 ezer. 15 ezer = második szoftver. A v2 Start a WSH **felső** csomagja volt. |
| Miért 6 900, nem 7 000? | Charm price. |
| Miért 15 vevő? | v2 D2: a 10→30 cliff a 11–18 partneres tömegnek fáj. 15 marad. Elég a kis B2B-nek; a 16. vevő Plus-ra tol. |
| 460 Ft/vevő nem sok? | Nem a pitch. A pitch: „még egy app a Shoprenter mellé.” |

### 5.2 Plus 12 900 / 40 vevő — a pénzcsomag

A trial utáni **cél**. 16–40 rendelő vevő = a tipikus ébredő nagyker.

Miért 40, nem 30 (v2 Grow)? A 30-as cap a 31. vevőnél azonnal Pro-ra kényszerített (v2-ben 69 900). 40 + 12 900 = van levegő, mielőtt a 24 900 kell.

Miért 12 900, nem 9 900? Elég távol a Starttől, hogy a 15→40 ugrás **ne** legyen „majdnem ingyen 3× keret”, de Plus &lt; 2× Start. A bolt a 6 900-at hasonlítja a Shoprenter-díjához; a 12 900 a „ne essek 15-re” ára.

**Ajánlott = Plus, nem Pro.** v2-ben a Pro volt a horgony (69 900), a Grow decoy. Plugin-áron a horgony a **belépő**; a decoy a **közép**, ahogy a WSH $20-a a $16 és $25 között. A 24 900-as Pro a „fotó + logó + árrés” a keveseknek.

### 5.3 Pro 24 900 / 120 vevő

Nem 69 900. A v2 Pro ERP-ár volt plugin-burokban. 24 900 ≈ Shopify Wholesale Helper felső sáv CEE-ben, 120 vevővel **volume discount** (208 Ft/vevő).

120, nem 80: a próba Pro-kerete legyen **érezhetően nagyobb**, mint a Plus (40). 80 (v2) túl közel volt a 40-hez ahhoz, hogy a Plus maradjon a default upgrade.

### 5.4 Miért nincsenek 34 900 / 69 900 / 139 900

Az a létra **szoftver-létra**. Négy rúd, nagy ugrások, Scale a listán. A Shopify top order-form **nem** így néz ki. A volumen 50×6 900-ból jön, nem 8×70 000-ből. Aki 200 vevőt lát, az Egyedi / ERP, nem egy negyedik kártya.

---

## 6. Miért három csomag

**Döntés:** merchanten három kártya. Nincs Grow, nincs Scale a UI-on.

**Miért:**

- Három = Good / Better / Best. Négy = „melyiket?” + Scale, amit úgysem választanak kártyáról.
- A termék **ugyanaz** (gyors rendelés). A méret (vevő) a meter; fotó / logó / árrés a Pro-extra — WSH mintára kevés extra, nem 8 soros mátrix.
- Multi-shop a v2 Scale feature volt. v3: egy bolt / org a launchon; második bolt = Egyedi / később. Nem kártya-feature.

**Admin:** Start / Plus / Pro radio + partner override = Egyedi. A 4. „csomag” egy mező, nem egy plan ID a merchantnek.

---

## 7. Aktív vevő mint meter

### 7.1 Definíció (változatlan v2 D3)

**Aktív vevő** = Shoprenter `customerInnerId`, aki a **naptári hónapban** ≥1 rendelést indított a widgeten (`b2b_orders.source = 'widget'`, `status in ('recorded','linked')`). Org szinten unique, shopokon át.

**Widget-open soha nem billing.** Kíváncsiság → hamis Scale-számla → churn. Az open marad analitika: „X nyitotta, Y rendelt.”

### 7.2 Miért vevő, nem SKU, nem rendelésszám, nem GMV

| Alternatíva | Miért nem a pitch |
|-------------|-------------------|
| SKU | A nagy katalógusú ICP (építőanyag, alkatrész) büntetve lenne. SKU = infra, háttér. |
| Rendelés darab | A napi lista-fotós nagyker 200 rendeléssel Pro-ra kényszerül, miközben 12 vevője van. |
| GMV % | Shopify subscription-app minta; nálunk a Shoprenter a checkout. Nem kérünk részesedést a bolt forgalmából. |
| Open | Nem érték; pánik. |

A merchant **értékként** fogadja: „hányan rendeltek a gyors rendeléssel ebben a hónapban.”

### 7.3 Érvényesítés = portál top-N (v2 D6, CTA cseréje)

A **storefront widget mindig megy**, ha a shop `widget_enabled` és az org nem `suspended`. Partner-cap **nem** öli a boltot.

A merchant portálon limit felett csak a **legaktívabb N** vevő sora tiszta; a többi elmosva. CTA: **`Tartsd a {n} vevőt · Plus …`**, nem „Emeld a csomagot”.

80% warn a **fizetős** limitre. Próba alatt a fizetős referencia a **jövőbeli plan** (általában Start 15), nem a Pro 120.

### 7.4 Hónapváltás

A számláló `date_trunc('month', now())`. Minden 1-jén 0-ról indul. A blur feloldódhat, ha a hónap elején kevesen rendeltek. Ezt a merchantnek egy mondatban megmondjuk a vevő-sávon: *„A számláló a naptári hónapra vonatkozik.”*

---

## 8. Feature-kapuk

A v2 D4 (Grow = 360, Scale = multi-shop) **egyszerűsítve**. Shopify: kevés kapu, a többi méret.

| Képesség | Start | Plus | Pro | Próba |
|----------|-------|------|-----|-------|
| Gyors rendelés a boltban | ✓ | ✓ | ✓ | ✓ |
| Typeahead, Excel, listák | ✓ | ✓ | ✓ | ✓ |
| Vevők + alap riport (ki / mit / mennyiért) | top 15 | top 40 | top 120 | top 120 |
| Fotó → lista | — | — | ✓ | ✓ |
| Árrés / NRR / alvó vevő | — | — | — | — (ERP) |
| Turinova a panel alján elrejthető | — | — | ✓ | **soha** |
| Priority sync / multi-shop | — | — | — | — (Egyedi / később) |

### 8.1 Miért a fotó csak Pro (+ próba)

A fotó Sonnet vision. COGS: tipikus kép ~15–45 Ft; napi lista-fotó **Start-bevételt** megehet. Excel és typeahead ≈ 0. A fotó a próba **endowmentja**: használja, Starten elveszíti, Plusra **nem** kapja vissza — Plus a vevőkeret, Pro a fotó. Így a fotós nagyker nem ülhet Pluson ingyen AI-on.

Widget: Start/Plus-on a fotó **modul kiesik** a vevő elől (nincs „fizess Pro-t” a boltban). API: 403. A merchant a `/csomag`-on látja, hogy a fotó Pro.

### 8.2 Miért a logó próba alatt mindig kint van

Brand + FOMO. A fehér címke a fizetett Pro **egyetlen** vizuális jutalma, amit a próba nem ad oda. Ha a próba alatt elrejthetné, a 24 900-nak nincs tapintható különbsége a 30. napon.

A portál (login, sidebar) **minden** csomagon Turinova. Csak a **storefront panel alja** rejthető.

A gomb (FAB) tetejére **soha** nem kerül logó.

### 8.3 Miért az árrés és a mély riport nincs a pluginban (v3.1)

Kannibalizáció: a v3 Pro 24 900-ért odaadta volna az „ezen keresek”-et. Az ERP indoka ugyanaz + készlet + NAV — a 89 ezret nehezebb eladni.

**Plugin = amit a vevő csinál a boltban** (felvétel).  
**ERP = ami a rendelés után történik** (készlet, számla, árrés, NRR).

A plugin riport: ki rendelt, mit, mennyiért. Az árrés / NRR / alvó vevő = ERP-horog. A Pro így is 24 900: 120 vevő + fotó + logó. Nem 39 900 — az már szoftver-számla.

A D16 (árrés = nettó − cost) az **ERP termékre** marad, nem a plugin Pro-ra.

### 8.4 Unlock, ne disabled

Logó és fotó **kattintható**. Modal: mi kell hozzá, ár, `Pro-t kérem` / `Bezár`. A szürke pipa nem FOMO.

---

## 9. SKU soft cap (háttér)

**Döntés:** marad a sync-védő limit. **Nem** megy a `/csomag` kártyára és a pitchbe.

| Plan | Soft SKU | 80% | 100% |
|------|----------|-----|------|
| Start | 15 000 | warn | sync stop, widget él |
| Plus | 40 000 | warn | sync stop, widget él |
| Pro | 80 000 | warn | sync stop, widget él |
| Próba | Pro 80 000 | ugyanaz | ugyanaz |

**Miért van:** a sync Shoprenter-oldalt és DB-t eszik. A partner-meter ezt nem védi.

**Miért nem pitch:** a 15 ezres katalógusú építőanyag-bolt ijedelme hamis objection. Admin override, ha kell.

---

## 10. Próba (30 nap Pro, logó kivétel)

### 10.1 Szabály egy mondatban

Invite → `status=trial`, `trial_ends_at = now()+30 nap` (platform default, 1–90, admin felülírja create-kor), `plan=start` (**ez a lejárat utáni csomag**). Amíg a próba él, a motor **Pro limitet és Pro feature-t** ad, **kivéve** a logó elrejtését.

### 10.2 Miért 30 nap, nem 7 / 14

| Hossz | Hol él | Nálunk |
|-------|--------|--------|
| 7 nap | Shopify default, gyors TTFV app | Catalog sync + első B2B rendelés gyakran nem fér bele |
| 14 nap | Shoper shop trial; Shopify ha kell integráció | Még szűk a „havi vevő” meterhez (naptári hónap!) |
| 30 nap | Sales/upsell app, ahol forgalom kell | **Igen.** Egy teljes rendelési ritmus. Endowment. |

A 30 nap **kockázata** (Shopify): zombi trialisták. Ellenszer nem a 7 nap, hanem: **első 72 óra = aktiválás**, FOMO csak siker vagy ≤7 nap után; 0. napi árközlés, hogy ne felejtsék el, mi jön.

### 10.3 Miért Pro a próba, nem Plus

Endowment a **felső** keretre. Ha Plusot próbálna (40), a Start (15) zuhanás kisebb; a Plus upgrade gyengébb. Pro (120) után a Plus (40) **menekülőút**, a Start **veszteség**. Ez a decoy.

Logó nélkül: lásd 8.2.

### 10.4 `plan=start` próba alatt

A `organizations.plan` a **post-trial** csomag, nem az effektív. Az effektív limit SQL: trial aktív → `plan_defaults.pro`. Így az admin látja: „Start · próba 12 nap”. Aktiváláskor Plus/Pro-ra állítjuk, ha azt választották.

### 10.5 Nincs kártya

Shoper/CEE: próba kártya nélkül. v1 Stripe nincs. A konverzió **mailto** + admin Aktiválás (kézi számla).

---

## 11. Lejárat: a widget nem hal meg

### 11.1 Döntés (v2 D6 / D1 részleges felülírás)

Lejáratkor:

- `status` marad `trial`, amíg az admin **Aktivál** (`active` + választott plan).
- Effektív keret = a tárolt plan (alapból Start 15).
- Fotó és árrés **ki**.
- Logó **kint** (Start/Plus).
- Portál: top-N blur + döntő képernyő.
- **Widget él.** Nincs M6 (trial unpaid → widget off) a Shoprenter-demó előtt.

### 11.2 Miért nem öljük a widgetet

A Shoper a **saját shopját** kapcsolja ki, ha a platform díja nincs kifizetve. Mi plugin vagyunk: a bolt Shoprenter-előfizetése él. A widget ölése = a **végfelhasználó** (nagyker vevő) büntetése a merchant latereléséért → uninstall + 1-star + demó-kockázat.

A portál-blur a Shopify paywall: a merchant nem látja a 16. vevőt → ír. A shop bevétel megy.

### 11.3 Lejárt, nem aktivált = admin crit

Tenant lista: `Lejárt próba · Start keret`. Ez a mi behajtásunk, nem a bolt megölése.

### 11.4 Suspended

`suspended` = widget off. Ez **nem** a trial lejárat. Ez kézi / szerződésszegés.

---

## 12. Éves fizetés

**Döntés:** a `/csomag` kártyán másodlagos sor:

*Évesen 2 hónap ajándék · 10 hónapot fizetsz, 12-t kapsz.*

| Plan | Éves (10 × havi) | vs 12 × havi | Kedvezmény |
|------|-------------------|--------------|------------|
| Start | 69 000 Ft | 82 800 Ft | ~16,7% |
| Plus | 129 000 Ft | 154 800 Ft | ~16,7% |
| Pro | 249 000 Ft | 298 800 Ft | ~16,7% |

v1: mailto, subject `Plus éves — {bolt}`. Nincs Stripe, nincs `billing_interval` a DB-ben. Az admin Plus/Pro-ra állítja + belső megjegyzés (éves, dátum).

**Miért van a kártyán most, motor nélkül:** a WSH minden planon mutat éves árat; a Shoper *zamiast* áthúzást használ; az éves Shopify-appoknál ~40% kevesebb churn. Display FOMO. A számla kézi.

**Miért 10× (2 hónap), nem 11× (1 hónap) és nem −15%:** a „2 hónap ajándék” mondat számolás nélkül érthető. 10/12 = 16,7%, ami a v2 D12 −15–20% sávjában van, és a WSH 10–20%-os éves kedvezményével egyezik. 11× csak ~8% — gyenge Shoper *zamiast*-hoz képest.

**Amit nem csinálunk a kártyán:** áthúzott „was 154 800” villogó pirossal; countdown a kedvezményre. A 10× elég.

---

## 13. ERP viszony

**Döntés:** két termék, két számla. A plugin ártábláján az ERP **egy mondat**:

*Ha a rendelés már a céged motorja, az ERP külön. Írj.*

Nincs ERP-kártya, nincs „Pro-ban benne az ERP”, nincs ingyen widget ERP-mellé.

**Út:** invite → 30 nap Pro próba → Start vagy Plus → 4–6 hónap, ha van widget-rendelés → ERP-beszélgetés.

**Miért nem 2 500 Ft a widget, hogy ERP-t upsell-eljünk:** a 2 500-as vevő nem ír 89 ezres ERP-csekkre. A 12 900-at fizető Plus-bolt, akinek 30 vevője a gyors rendelésből él, az az ICP.

**Tájékoztató ERP-sáv (nem a plugin kártyája, nem szerződés):** bevezetés ~490e / 1,2M / egyedi; havi ~89e / 179e / 279e+. A pontos ERP-ár külön dokumentum, amikor az ERP termék él.

### 13.1 `erp_qualified` — a plugin igazi ROI-ja

Minden tenantnél jeleket számolunk. Ha **legalább 3** teljesül a mérhetőkből → `erp_qualified`.

| Jel | Küszöb | Forrás |
|-----|--------|--------|
| Aktív rendelő vevő / hó | > 40 | widget-meter |
| Widget-rendelés / hó | > 150 | `b2b_orders` |
| Katalógus SKU | > 8 000 | `product_catalog` |
| Widget rendelésérték / hó | > 8M Ft | `b2b_orders.gross_total` |

Cost-kitöltöttség és „hány fő a rendelésen” később (Shoprenter cost drága a fleet-listán; staff = onboard mező). Addig 4 jelből 3 elég.

Az admin lista tetején: **`erp_qualified` darabszám**. Ez a sales lista, hideghívás nélkül. A merchant ezt **nem** látja.

---

## 14. Merchant UX és FOMO-idővonal

Design: [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — Olvasó, radius 0, egy primary CTA, nincs dekoratív pánik.

### 14.1 Héj (minden merchant oldal)

Próba alatt a fejlécben, a cím mellett:

`Pro próba · 12 nap` → kattintás: `/csomag`.

≤7 nap: warn szegély (`Pro próba · 7 nap`).  
3 nap: `3 nap múlva lejár`.  
1 nap / 0: `Ma lejár` / a dátum.

Lejárat után, amíg nincs aktiválva: `Próba lejárt · Start keret` → `/csomag`.

**Miért mindig a héjban:** Shopify dashboard countdown, nem elásott Beállítások. Csendes. Nem banner.

### 14.2 Idővonal — mikor szabad FOMO-zni

A v2-es reflex („már a 30. naptól 120 vs 15 a home tetején”) **tiltott**. A Shopify retention playbook: 72 óra = aha; korai eladás idegesít.

| Idő | Mit lát | FOMO? |
|-----|---------|-------|
| 0. nap (első belépés) | Egyszeri idővonal: *30 nap Pro. Utána Start 6 900 Ft. A gyors rendelés a boltban marad.* Utána a meglévő „Következő lépés” (bolt, sync, widget) | Átlátszóság, **nem** csomag-eladás |
| 1–7. nap | Héj-chip + vevő-sáv lábjegyzet | **Nincs** upgrade-banner a home-on |
| Első widget-rendelés | *Az első rendelés bement. Próbában még {n} nap.* | Siker |
| 16. vevő **vagy** fotó használva | *Starten ezt a vevőt már nem látnád.* / fotó endowment | Saját szám |
| ≤7 / 3 / 1 nap | Döntő képernyő (§14.5) | Igen |
| Lejárat | Ugyanaz a képernyő; Start már a keret | Igen |

Home banner: **bezárható**, kivéve az utolsó 3 napot. Max ~3 erősebb üzenet / hét.

### 14.3 Vevő-sáv (home)

```
Ebben a hónapban 23 vevő rendelt
Próbában 120 fér el · Starten 15 lenne
[sáv a 23 / 120-hoz, 15-nél jelölés ha used > 15]
A számláló a naptári hónapra vonatkozik.
```

Fizetős, nem próba:

```
Ebben a hónapban 23 vevő rendelt
A Plus 40-et bír.
```

**Miért két szám próba alatt:** Klaviyo / „4 of 5” — a merchant a **fizetős plafont** lássa, ne a Pro 120-at, amit úgysem ér el. A 15-ös vonal a sávon a Start-küszöb.

80% / cap banner próba alatt **ne** a 120-ra menjen. Ha `used > 15`: warn a 15 miatt.

### 14.4 `/csomag` — WSH kártya, nem mátrix

Új oldal, nav: nem kell ötödik ikon, ha a héj-chip és a home CTA ide visz. Opcionális: Beállítások alján link, **nem** oda temetve a három kártya.

Három vízszintes sor:

```
START          6 900 Ft/hó     15 vevő
               Évesen 69 000 Ft · 2 hónap ajándék

PLUS  ★       12 900 Ft/hó     40 vevő     Ajánlott
               Évesen 129 000 Ft · 2 hónap ajándék

PRO           24 900 Ft/hó    120 vevő     fotó · logó le · árrés
               Most a próbáján vagy
               Évesen 249 000 Ft · 2 hónap ajándék
```

Alul: *Bármikor válthatsz. A gyors rendelés a boltban nem áll le.*  
ERP-mondat. Nincs 8 soros pipa-tábla.

Ha `used > 15` és `used ≤ 40`: Start halvány — *15 vevő kevés ehhez a hónaphoz.* Plus kiemelve.  
Ha `used > 40`: Start+Plus halvány, Pro CTA.

CTA minden soron: `Ezt kérem` → mailto, subjectben csomag + boltnév. Nincs Stripe v1.

### 14.5 Döntő képernyő (≤7 nap vagy lejárat) — Shopify trial-ending

Nem pánik. Honesty converts.

Cím: `A próba {ÉÉÉÉ. HH. NN.}-án lejár` (konkrét dátum).

Három következmény az **ő** számaikkal:

- Most: **{n} vevő** látszik, fotó megy  
- Start 6 900: **15 vevő**, fotó ki  
- Plus 12 900: **40 vevő** — ha 16–40 között vannak, ez a primary: **`Tartsd a {n} vevőt`**  
- Pro 24 900: fotó + logó le + árrés  

Másodlagos, ugyanolyan olvasható: **`Maradok Starten · 6 900 Ft`**.

**Miért látszik a Start:** Apple/Shopify — a kilépő út nem rejtett. Nálunk a Start fizetős, nem Free zuhanás. Aki 8 vevővel zár, annak a 6 900 az igazságos, nem a 12 900-as zsarolás.

### 14.6 Vevők lista

Próba + `used > 15`: a 16. sortól **előrejelző** sáv (még nem blur, mert Pro keret van): *Próba után ezek a vevők eltűnnek a Starten. Pluson 40 fér el.*

Lejárat / fizetős cap: meglévő blur + `Tartsd a {n} vevőt · Plus`.

### 14.7 Gyors rendelés beállítások

Logó és fotó: kattintás → unlock modal (§8.4).  
Copy próba: *Pro-n elrejtheted. Próba alatt és Starten / Pluson a Turinova a panel alján marad.*

### 14.8 Áttekintés „Következő lépés”

1–7. nap: marad a termék-lépés (bolt, sync, widget). **Nem** csomag.  
≤7 nap **és** a termék kész: a döntő képernyő **felülírhatja** a „Kész a beállítás / bolt megnyitása” lépést.  
Lejárat: a következő lépés **a döntő képernyő**, ne a bolt.

---

## 15. Copy-szabályok

| Tiltott | Helyette |
|---------|----------|
| Emeld a csomagot | Tartsd a {n} vevőt |
| Írj a Turinovának (első CTA) | Tartsd a {n} vevőt · Plus 12 900 Ft — a mailto a gomb *mögött* van |
| Gomb (a funkcióra) | Gyors rendelés |
| Partner (merchant UI) | Vevő, aki a gyors rendelésből rendelt |
| Ingyenes / Free | Nincs. Próba, aztán Start |
| Watermark / Készítette a | A panel alján a wordmark; semmi „készítette” |
| Holnap lejár (dátum nélkül) | A próba {dátum}-án lejár |
| Pro-t veszítesz | 23 vevőből 15-öt látnál a Starten |

Mailto: `hello@turinova.hu`, subject `Plus kellene — {shoprenterShopName}` (vagy Start/Pro/éves).

---

## 16. Admin UX

Az admin **nem** marketing. Ő aktivál, hosszabbít, Egyedit ad.

### 16.1 Tenant lista (`/admin`)

Csomag oszlop:

- élő próba: `Start · próba 12 nap` (a Start a jövőbeli plan)  
- ≤7 nap: warn  
- lejárt, nem aktivált: `Lejárt próba · Start keret` (crit)  
- fizetős: `Plus` / `Pro`

Szűrő: meglévő `Próba ≤7 nap` + `Lejárt, nem aktivált`.

### 16.2 Szervezet (`/admin/orgs/[id]`)

Mondat: `próba, 12 nap · utána Start · 23 vevő / 120 fér el`.

Egy döntés-blokk:

1. **Aktiválás** — Start / Plus / Pro + `Aktiválás` → `status=active`, `trial_ends_at` lezárva, a választott `plan`.  
2. **Próba +7 / +14 nap** — Shoprenter-demó; a plan nem változik.  
3. Partner override — Egyedi (120+). Listaár floor = Pro.

Aktiváláskor a UI megmutatja, **mit lát utána a merchant** (15 / 40 / 120). Ne maradjon lejárt trial homályos plan-nel.

### 16.3 Create org

*30 nap Pro próba. Lejárat után ez a csomag:* default **Start**. Trial napok a `platform_settings.trial_days` (30), felülírható.

A meghívó e-mailbe bele a 0. napi ártábla (§17).

### 16.4 Platform beállítások (`/admin/settings`)

Három sor: Start / Plus / Pro. Oszlopok: vevőlimit, listaár Ft, soft SKU (SKU csak itt, nem a merchant kártyán).  
Próba napok: 1–90, default 30.  
Portál top-N gate kapcsoló marad.

A `grow` / `scale` sorok kimennek.

---

## 17. E-mail (Shoper pro forma)

Shopify billing transparency: **in-app + e-mail**. Shoper: pro forma az **1. napon**. Nálunk a meghívó már megy — ez a csatorna.

| Mikor | Tartalom | v1 |
|-------|----------|----|
| Invite / 0. nap | Idővonal: 30 nap Pro → utána Start 6 900. Három ár. *Nincs kártya. A gyors rendelés nem áll le.* Invite-link | **Kötelező** a meghívóba |
| −7 / −3 / −1 nap | `{n} vevő ebben a hónapban. Próba {dátum}. Tartsd Pluson 12 900-ért.` | v1 cron, ha van mailer; addig admin kézi |
| Lejárat | A boltban megy. Itt 15 vevő. Plus: 40. | ugyanaz |

**Miért a 0. nap kötelező a többi előtt:** sticker shock a top uninstall ok Shopify-n. A 30. napon először látott 6 900 = harag, nem FOMO.

A −7/−3/−1 a portál nélkül is gyengébb, de a döntő képernyő (§14.5) viszi a konverziót. A cron **nem** blokkolja a 1–3. implementációs lépést.

---

## 18. Amit szándékosan nem csinálunk

| Nem | Miért |
|-----|-------|
| Free tier launch | Invite-only + Free ellentmondás (D18). App Store-nál újra. |
| 2 500 Ft Start | Commodity; support; rossz ICP |
| 14 900 Ft Start | Szoftver-ár plugin helyett |
| 4. nyilvános csomag (Scale / Grow néven) | Döntési fáradtság |
| Feature-mátrix a `/csomag`-on | Plugin-érzés |
| Stripe / kártya v1 | Meter az igazság; kézi számla |
| Widget kill lejáratkor (M6) | Demó + végfelhasználó |
| Logó a FAB-on | Nem watermark |
| Portál-logó elrejtése bármely planon | Turinova a saját felületén |
| Fake countdown / „csak ma” / 34% most | Dark pattern |
| FOMO home-banner 1–7. nap | Nincs aha |
| Review-kérés onboardingkor | Shopify: siker után, ~15 nap; launchban kihagyható |
| Éves motor a DB-ben v1 | Display + mailto elég |
| GMV / open alapú számla | D3 |
| Árrésben szállítás / utánvét | D16 |
| Nyilvános signup | D18 |

---

## 19. Adatmodell és plan ID

### 19.1 Belső ID

| Merchant név | `organizations.plan` | Régi v2 ID |
|--------------|----------------------|------------|
| Start | `start` | `start` |
| Plus | `plus` | `grow` (átnevezés) |
| Pro | `pro` | `pro` |
| — | nincs | `scale` kivezetve |

`parsePlanId`: `grow` → `plus` (kompatibilitás), `scale` → `pro` + ha van 200-as limit, az override-ra megy a migrációban.

Check constraint: `plan in ('start', 'plus', 'pro')`.

### 19.2 Effektív limit

Meglévő `effective_partner_limit` / `effective_sku_limit` (`sql/016`):

```
override
  ?? (trial aktív → plan_defaults.pro)
  ?? plan_defaults[organizations.plan]
```

Pro `partner_limit` v3-ban **120** (v2: 80).

### 19.3 `plan_defaults` célértékek

| plan | partner_limit | sku_limit | list_price_huf |
|------|---------------|-----------|----------------|
| start | 15 | 15 000 | 6 900 |
| plus | 40 | 40 000 | 12 900 |
| pro | 120 | 80 000 | 24 900 |

Kézi SQL (új fájl, pl. `019_plans_v3.sql`) — a projekt szabálya: **SQL manuális**, nincs auto-migrate.

### 19.4 Feature-kapuk a kódban

| Kapu | Igaz, ha |
|------|----------|
| `canHideTurinovaMark` | `!isTrial && plan === 'pro'` |
| Fotó API | `isTrial \|\| plan === 'pro'` |
| Árrés / NRR a riportban | **soha** (ERP) |
| Partner blur N | `effective_partner_limit` |

`scale` kikerül a `canHideTurinovaMark`-ból.

### 19.5 Új merchant route

`/csomag` — a §14.4. Nincs külön billing-tábla v1-ben.

---

## 20. Implementációs sorrend

Kód csak ennek a dokumentumnak megfelelően. SQL kézzel, deploy előtt.

1. **Motor:** `plans.ts`, `parsePlanId`, `canHideTurinovaMark`, `canParseImage`; SQL `019`; fotó API kapu.  
2. **Meter + unlock + héj:** két szám a sávon; 15-ös vonal; logó modal; MerchantShell chip.  
3. **`/csomag` + döntő képernyő** ≤7 nap / lejárat; vevők előrejelző sáv; copy „Tartsd”.  
4. **Riport:** árrés/NRR/alvó kivezetés. Meghívó 0. napi ártábla (invite oldal + create-org).  
5. **Admin:** 3 plan; aktiválás / +7 / +14; `erp_qualified` a listán.

A 4. mail-cron **nem** blokkolja az 1–3. és 5. lépést.

---

## 21. Lezárt vs nyitott

### 21.1 Lezárt (implementáció közben nem újratárgyalandó)

- 3 csomag: 6 900 / 12 900 / 24 900  
- 15 / 40 / 120 aktív vevő  
- Plus = Ajánlott; trial utáni célkonverzió = Plus  
- 30 nap próba = Pro entitlements, **logó nem**  
- Widget nem áll le partner-capen és lejárt próbán (M6 később, külön döntés)  
- Aktív vevő = widget-rendelés / naptári hó  
- Fotó + **nem** árrés = Pro + próba. Árrés = ERP.  
- Nincs Free; invite-only; **ICP = 40+ partneres nagyker** (Start csak inbound)  
- Belső KPI: `erp_qualified`  
- Funkció neve: gyors rendelés  
- Olvasó, radius 0  
- v1 fizetés: mailto + admin aktiválás  
- SQL manuális  

### 21.2 Nyitott (nem blokkol)

| Téma | Default, amíg nincs új döntés |
|------|-------------------------------|
| 5 900 vs 6 900, ha a piactér fal | Marad 6 900 |
| Stripe | Nincs v1 |
| Éves a DB-ben | Csak kártya-copy + mailto |
| M6 widget-kill | Ki, amíg a demó le nem fut |
| Review-prompt a portálon | Ki launchban |
| Multi-shop | Egyedi / később |
| ERP pontos ár | Külön doksi, amikor az ERP él |
| Reminder-mail cron | 0. nap a meghívóban; a többi 2. hullám |

---

## 22. V2 → v3 változásnapló

| v2 (`PLATFORM` §6, D11–D12) | v3 (ez a fájl) | Miért |
|-----------------------------|----------------|-------|
| Start 14 900 / 15 | **6 900 / 15** | Plugin-ár; Shopify $19; 15 ezer szoftver-érzés |
| Grow 34 900 / 30 | **Plus 12 900 / 40** | Közép = menekülőút; 40 vevő levegő |
| Pro 69 900 / 80 Ajánlott | **Pro 24 900 / 120**, nem Ajánlott | Pro extra (fotó, logó, árrés), nem horgony |
| Scale 139 900 / 200 kártyán | **Egyedi**, override | 3 kártya |
| Ajánlott = Pro | **Ajánlott = Plus** | Plugin decoy |
| Trial 30 nap teljes Pro | Ugyanaz, **logó kivétel** (már kódban) | Brand |
| Lejárat unpaid → widget off (D1/D6/M6) | **Widget él**, Start keret | Demó; végfelhasználó |
| Feature ladder Grow 360 / Scale multi-shop | **Ugyanaz a widget**; kapu = méret + Pro extra | WSH minta |
| Éves −15–20% említve | **10× havi a kártyán** | WSH/Shoper display |
| „Emeld a csomagot” | **Tartsd a {n} vevőt** | Saját szám |
| FOMO általános | **Siker után + ≤7 nap**; 0. napi átlátszóság | Shopify 72h + Shoper pro forma |

A `PLATFORM_AND_ADMIN_IMPLEMENTATION.md` D2, D4, D5, D6 (widget-kill része), D11, D12 és §6 **erre a fájlra** hivatkozik. A motor, a sync és a D3/D7–D10/D13–D19 ott marad.

---

## Függelék — Gyors referencia

Start **6 900** ≤15 · Plus **12 900** ≤40 ★ · Pro **24 900** ≤120 · Egyedi 120+ · Éves **10×** · Próba **30 nap Pro, logó kint** · Árrés = ERP · ICP = 40+ partner · KPI = `erp_qualified` · Widget lejáratkor él · CTA: *Tartsd a {n} vevőt*.
