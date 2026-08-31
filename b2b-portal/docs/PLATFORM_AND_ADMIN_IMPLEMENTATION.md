# Turinova B2B Platform + SaaS Admin — komplett implementációs dokumentáció

**Scope:** `b2b-portal` (merchant portál + storefront widget + platform admin)  
**Státusz:** Source of truth a commerce sync, SKU-meteres billing, admin health és multi-platform adapter tervhez  
**Utolsó frissítés:** 2026-08-18 (árazás **v3** → [`PRICING.md`](./PRICING.md); motor/sync itt)  
**Implementáció:** Motor, sync, admin health: ez a fájl. **Árak, próba-UX, FOMO, plan ID-k:** [`PRICING.md`](./PRICING.md). Kódírás csak explicit következő lépés után.

Kapcsolódó dokumentumok:

| Dokumentum | Szerep |
|------------|--------|
| [`PRICING.md`](./PRICING.md) | Árazás történet + v6 fejléc |
| [`PRICING_V6_CURRENT.md`](./PRICING_V6_CURRENT.md) | **Aktuális** billing / próba / feature gate |
| [`B2B_PRICING_STRATEGIES.md`](./B2B_PRICING_STRATEGIES.md) | **Partnerár-stratégiák** — `/arak`, SR precedencia, fázisok P0–P4 |
| [`SAAS_ARCHITECTURE.md`](./SAAS_ARCHITECTURE.md) | Tenancy, auth, shop creds, widget multi-tenant alap |
| [`DATABASE.md`](./DATABASE.md) | Manuális SQL futtatás, meglévő séma |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | UI nyelv (Olvasó / high_contrast, radius 0) |
| [`../sql/`](../sql/) | Létező migrációk (manuális) |
| Repo: `ARCHITECTURE_STRATEGY.md` | Jövőbeli full ERP (külön DB, platform adapter minta) |

---

## v6 addendum (2026-08-28) — billing doc szinkron

**Aktuális árazás / próba / feature gate:** [`PRICING_V6_CURRENT.md`](./PRICING_V6_CURRENT.md) — **nem** a lenti D1/D4/D11 v3 számok.

| Téma | v3 doc (archív) | v6 kód |
|------|-----------------|--------|
| Próba | 30 nap Pro | **14 nap**, teljes termék |
| Árak | 6 900 / 12 900 / 24 900 | **7 500 / 9 999** bruttó |
| Vevő limit pitch | 15 / 40 / 120 | **Soft 500** (infra) |
| Fotó modul | Csak Pro | **Minden csomag + próba** |
| White-label | Pro | **plus/pro** fizetős, soha trialban |
| Merchant UI csomag | 3 kártya | **1 kártya + saját márka checkbox** |

Az alábbi D-döntések **történeti indoklás**; implementáció előtt mindig ellenőrizd a kódot és a `PRICING_V6_CURRENT.md`-t.

---

## Tartalomjegyzék

1. [Cél és nem-célok](#1-cél-és-nem-célok)
2. [Lezárt termékdöntések](#2-lezárt-termékdöntések)
3. [Jelenlegi baseline](#3-jelenlegi-baseline)
4. [Termékpozíció és marketing-pszichológia](#4-termékpozíció-és-marketing-pszichológia)
5. [Értéklétra és upsell](#5-értéklétra-és-upsell)
6. [Planek, trial, Active Partner árazás](#6-planek-trial-active-partner-árazás)
6b. [Verseny: Shoprenter ERP/plugin ökoszisztéma](#6b-verseny-shoprenter-erpplugin-ökoszisztéma)
6c. [Marketing-pszichológia stresszteszt](#6c-marketing-pszichológia-stresszteszt)
7. [Rendszerarchitektúra](#7-rendszerarchitektúra)
8. [Multi-platform adapter szerződés](#8-multi-platform-adapter-szerződés)
9. [Adatmodell](#9-adatmodell)
10. [Sync motor](#10-sync-motor)
11. [API szerződés](#11-api-szerződés)
12. [Widget viselkedés](#12-widget-viselkedés)
13. [Merchant portál](#13-merchant-portál)
14. [Platform admin panel](#14-platform-admin-panel)
15. [Sebesség és kapacitás](#15-sebesség-és-kapacitás)
16. [ERP párhuzam és továbblépés](#16-erp-párhuzam-és-továbblépés)
17. [Edge case katalógus](#17-edge-case-katalógus)
18. [Implementációs fázisok (M0–M12)](#18-implementációs-fázisok-m0m12)
19. [Ellenőrző Definition of Done](#19-ellenőrző-definition-of-done)
20. [Shoprenter plugin / store copy váz](#20-shoprenter-plugin--store-copy-váz)
21. [Nyitott technikai választások (nem termékdöntés)](#21-nyitott-technikai-választások-nem-termékdöntés)
22. [Dokumentum-karbantartás](#22-dokumentum-karbantartás)

---

## 1. Cél és nem-célok

### 1.1 Cél

Olyan B2B SaaS, amely:

1. **Shoprenteren most** kivitelezhető end-to-end.
2. **Eszméletlenül gyors** a widget typeaheadben és a portál / admin listákon (olvasás = saját Postgres).
3. **2–300 tenant** mellett is stabil (rate limit, queue, nincs process-helyi JSON index mint igazság).
4. **Aktív vevő / hó** (widget-**rendelés**) alapján eladható; SKU soft infra-cap; érvényesítés = **merchant portál** top-N. Árak: [`PRICING.md`](./PRICING.md).
5. A **platform adminon** minden tenant egészsége, partner meterje, syncje és widget használata követhető.
6. Később **Unas, Shopify és más platformokra** adapterrel bővíthető, sémaújraírás nélkül.
7. A jövőbeli **full fulfillment ERP** felé upsell-létra, anélkül hogy a B2B widget az ERP-től függene.

### 1.2 Nem-célok (v1 / ezen dokumentum hatálya)

| Nem-cél | Indoklás |
|---------|----------|
| Stripe checkout engine az első sprintben | A meter és plan mező az igazság; fizetési provider később |
| Partial `catalog_ready` incomplete indexszel | Hiányzó SKU = bizalomvesztés |
| Élő Shoprenter typeahead productionben | Lassú, 429, hideg cache, multi-instance törés |
| Egy közös `.cache/*.json` több shopnak | Tenant-keveredés és replica-vesztés |
| DB-per-tenant a B2B SaaS-ban | Ellentétes a shared-schema döntéssel (`SAAS_ARCHITECTURE.md`) |
| Main ERP DB vagy shop-portal tenant DB használata | Izoláció kötelező (`DATABASE.md`) |
| Coaching CRM („teendő / Megcsináltam”) a vevő 360-on | Korábban elvetve; factual adatok maradnak |
| Árrés számítás szállítási / utánvét / fizetési díjjal | Csak termék nettó − cost |
| Public self-serve signup | Invite-only modell |

---

## 2. Lezárt termékdöntések

Ezek **nem újratárgyalandók** implementáció közben, amíg explicit termékdöntés nem módosítja őket.  
Minden döntéshez: **mi** + **miért**.  
**v3 árazás:** [`PRICING.md`](./PRICING.md) felülírja a D2/D4/D5/D11/D12 számokat és a D6 widget-kill részét. D3 (rendelés-meter), D6 portál-gate, nincs Free, trial 30 nap, Start ≤15 — elvben marad.

### D1 — Trial: 30 nap teljes Pro → fizetős Start minimum

| | |
|--|--|
| **Döntés** | Org create → `status=trial`, `trial_ends_at = now()+30 days`. Trial = **Pro** (fotó, árrés, 120 vevő), **logó nem rejthető**. Lejárat után fizetős plan (`start` minimum); a **widget él**. [`PRICING.md`](./PRICING.md) §10–§11. |
| **Miért** | 30 nap = catalog + egy rendelési ritmus. Endowment. Nincs örök Free. Widget-kill (M6) a demó után külön döntés. |

### D2 — Fő meter: aktív partner / hó (Active Partner)

| | |
|--|--|
| **Döntés** | Látható árazás = hány **aktív vevő** / naptári hónap. Plan v3: **Start ≤15 · Plus ≤40 · Pro ≤120 · Egyedi 120+**. Nincs Free, nincs Grow/Scale kártya. Részlet: [`PRICING.md`](./PRICING.md) §4–§7. |
| **Miért** | Vevő = merchant-nyelv; nagy katalógus nem büntetett. Három plugin-kártya (Shopify/Shoper), nem négy szoftver-rúd. |

### D3 — Aktív = ≥1 widget-rendelés / hó (nem open)

| | |
|--|--|
| **Döntés** | Aktív partner = Shoprenter `customerInnerId`, aki a hónapban **≥1 rendelést indított/lezárt a widgeten**. Org = unique a shopokon. **Widget-open = csak analitika** („X nézte, Y rendelt”) — **soha nem billing**. |
| **Miért** | Open kontrollálhatatlan (kíváncsiság → Scale számla) → churn. A meter legyen az, amit a merchant **értékként** elfogad: rendelő partner. Open külön insight a portálon. |

### D4 — Feature ladder

| | |
|--|--|
| **Döntés** | Ugyanaz a widget mindhárom csomagon. Start/Plus = méret (15/40 vevő). **Fotó + logó elrejtés = Pro** (próba alatt fotó jár, logó nem). **Árrés = ERP**, nem a plugin. Multi-shop = Egyedi / később. [`PRICING.md`](./PRICING.md) §8. |
| **Miért** | Shopify order-form: kevés kapu, a többi usage. Trial után Start is teljes gyors rendelés. |

### D5 — SKU soft cap (infra, háttér)

| | |
|--|--|
| **Döntés** | Soft SKU: Start 15k · Plus 40k · Pro 80k. 80% warn; 100% sync-stop; widget él. Nem a pitch, nem a `/csomag` kártya. [`PRICING.md`](./PRICING.md) §9. |
| **Miért** | Sync költség SKU-val nő; partner-meter önmagában nem védi az infrát. |

### D6 — Widget soha nem áll le; érvényesítés = merchant portál top-N

| | |
|--|--|
| **Döntés** | Partner/SKU limitnél a **storefront widget mindig megy**. Portál: top-N + blur + CTA *Tartsd a {n} vevőt*. SKU 100%: sync-stop. Widget off csak: `suspended` / `widget_enabled=false`. **Lejárt próba nem öli a widgetet** (M6 később, külön döntés). [`PRICING.md`](./PRICING.md) §7.3, §11. |
| **Miért** | A végfelhasználót nem büntetjük a merchant latereléséért. Portál-gate = Shopify paywall. |

### D7 — Catalog ready csak complete

| | |
|--|--|
| **Döntés** | `ready` csak full complete; sync közben progress, ne „Nincs találat”. |
| **Miért** | Hiányzó SKU = bizalomvesztés. |

### D8 — Typeahead csak DB

| | |
|--|--|
| **Döntés** | Search = Postgres `product_catalog`. |
| **Miért** | Sebesség, multi-tenant, nincs hideg index. |

### D9 — Group ár resolve-live

| | |
|--|--|
| **Döntés** | Typeahead listaár OK; pontos group ár = max 1 adapter hívás resolve-kor. |
| **Miért** | Typeahead gyors marad. |

### D10 — Uninstall 30 nap soft retain

| | |
|--|--|
| **Döntés** | Soft retain 30 nap; meter 0; hard purge admin/GDPR. |
| **Miért** | Véletlen uninstall / reaktiváció. |

### D11 — Pro = „Ajánlott”

| | |
|--|--|
| **Döntés** | **Plus** chip „Ajánlott”; Start belépő; Pro = fotó/logó/árrés. [`PRICING.md`](./PRICING.md) §5.2, §6. |
| **Miért** | Plugin decoy: a próba Pro, a menekülőút Plus (12 900), nem a 24 900. |

### D12 — Ársáv Ft (launch)

| | |
|--|--|
| **Döntés** | Start **6 900** (≤15) · Plus **12 900** (≤40) · Pro **24 900** (≤120) · Egyedi 120+. Éves **10× havi** (2 hónap ajándék). Teljes indoklás: [`PRICING.md`](./PRICING.md). |
| **Miért** | Shopify/Shoper plugin-zóna, nem szoftver-létra. 14 900 a bolt fejében második rendszer volt. |

### D13 — ERP külön / co-opetitor

| | |
|--|--|
| **Döntés** | Full ERP később. Pitch: Billingo/Logzi/CloudERP *mellett*. |
| **Miért** | Más job; gyors plugin előny. |

### D14 — Multi-platform adapter

| | |
|--|--|
| **Döntés** | `shops.platform` + CommerceAdapter; Shoprenter első. |
| **Miért** | Későbbi TAM (Shopify stb.) — 300 tenant csak multi-platformmal reális hosszú távon. |

### D15 — Design radius 0

| | |
|--|--|
| **Döntés** | DESIGN_SYSTEM, Olvasó / high_contrast, radius 0. |
| **Miért** | Konzisztencia. |

### D16 — Árrés = nettó − cost

| | |
|--|--|
| **Döntés** | Csak termék nettó − cost; coverage %. |
| **Miért** | Auditálható Pro insight. |

### D17 — Manuális SQL / dedikált B2B DB

| | |
|--|--|
| **Döntés** | Kézi migráció; DB ≠ ERP ≠ shop-portal. |
| **Miért** | Izoláció, kontroll. |

### D18 — Invite-only launch (nincs public Free / App Store self-serve v1)

| | |
|--|--|
| **Döntés** | Nincs nyilvános signup. Platform create + invite. **Nincs Free tier** a launchnál. Shoprenter App Store OAuth + self-serve billing = **későbbi** fázis (akkor újraértékelhető Free). |
| **Miért** | Invite-only + Free ártábla ellentmondás volt. Egy GTM: sales/invite → trial → Start+. Kevesebb loophole és support. |

### D19 — Order-attribúció = billing gerinc (kötelező early)

| | |
|--|--|
| **Döntés** | Minden widget-rendeléshez tárolt: `organization_id`, `shop_id`, `customer_inner_id`, `ordered_at`, érték, forrás=`widget`. Ez hajtja az Active Partner metert. |
| **Miért** | Enélkül nincs számlázás, nincs case study, nincs portál-gate. Kritikus út elején (nem „késői usage counter”). |

---

## 3. Jelenlegi baseline

### 3.1 Ami már létezik

| Terület | Hol | Megjegyzés |
|---------|-----|------------|
| Auth / session | `src/lib/auth/*`, cookie `b2b_session` | Invite + login |
| Platform admin lista | `/admin` | Tenant lista, szűrők, Új szervezet |
| Org detail | `/admin/orgs/[id]` | Alap org + invite resend |
| Admin settings | `/admin/settings` | Minimális |
| Merchant | `/home`, `/settings`, `/widget`, `/vevok`, `/riport` | Vevő 360, riport élő SR-rel is terhelhető |
| Widget | `public/widget.js` + `/api/products/*` | Typeahead: élő Shoprenter + opcionális warm JSON index |
| SQL | `001`–`012` | Org, shop, widget, vevők, b2b_orders, activities |
| Design | `globals.css`, DESIGN_SYSTEM | radius 0 |

### 3.2 Ismert fájdalompont (indok a tervre)

A typeahead ma gyakran **üres találatot** ad gyártói cikkszámra (pl. `F000345`), ha a process-helyi / lemez JSON code-index nincs „meleg”, miközben a Shoprenter `?search=` / `?sku=` részleges model számra gyenge. Resolve közben az index építése **tíz másodperceket** is igénybe vehet. Ez 300 tenant + több Next instance mellett **nem production-képes**.

### 3.3 Hol érhető el az admin ma

| Környezet | URL |
|-----------|-----|
| Local | `http://localhost:3030/admin` |
| Login | `http://localhost:3030/login` |
| Platform user | `users.is_platform_admin = true` (seed: `sql/007_seed_platform_admin.sql`, tipikusan `admin@turinova.hu`) |

Cloudflare quick tunnel URL-je változó; a widget `apiBase` és a `widget.js` src **ugyanarra** a portál-tunnelre / prod domainre mutasson.

---

## 4. Termékpozíció és marketing-pszichológia

### 4.1 Egy mondatos ígéret (merchant felé)

> A B2B vevő a webshopban másodpercek alatt rendel cikkszámra vagy gyártói számra — te pedig a Turinova portálon látod a partnereket, az árrést és a widgetet, a webshopod fölött.

### 4.2 Amit ne kommunikáljunk

- „Százezer sort syncelünk a adatbázisba.”
- Technikai sync részletek az első onboarding képernyőn.
- Consumer hangnem („🔥 LIMITED OFFER”).

### 4.3 Amit igen

- Azonnali cikkszám- / gyártói keresés.
- Partner csoportár a kosárnál.
- Merchant portál: vevők, riport, widget beállítás.
- Install → néhány percen belüli első sikerélmény.

### 4.4 Big-brand plugin minták

| Minta | Alkalmazás nálunk |
|-------|-------------------|
| Trial → fizetés | **30 nap Pro** → Start minimum |
| Usage-based upgrade | **Aktív partner (rendelés)** used/limit |
| Portál paywall | Limit felett top-N partner blur + CTA |
| Loss aversion (végfelhasználó) | Widget **soha** nem áll le limit miatt |
| Anchor | **Pro ajánlott** 69 900 Ft |
| ROI story | Admin idő / bérköltség, **nem** „drágább mint Logzi” |
| Endowment | Sync + Pro trial insight |
| Invite GTM v1 | Nincs Free / App Store self-serve a launchnál |

### 4.5 Hangnem

B2B, nyugodt, számszerű.  
Példa: „12 / 15 aktív partner (rendelt) ebben a hónapban”.  
Analitika külön: „18 megnyitotta, 12 rendelt” — nem a számla alapja.

---

## 5. Értéklétra és upsell

| Szint | Merchant érzés | Termék | Upsell |
|-------|----------------|--------|--------|
| **0 Hook** | Működik? | Widget | — |
| **1 Habit** | Vevőim rendelnek | Gyors rendelés | 15 vevő → Plus |
| **2 Insight** | Látom a pénzt | Árrés | **Pro** |
| **3 Lock-in** | Ebből élek | 40–120 vevő | Plus / Pro / Egyedi |
| **4 ERP** | Egész cég | Fulfillment | Külön termék ([`PRICING.md`](./PRICING.md) §13) |

### 5.1 Upsell triggerök

| Trigger | Üzenet | CTA |
|---------|--------|-----|
| Sync ready | Katalógus kész | Script |
| Partner 80% | X/Y aktív (rendelő) partner | Következő plan |
| Partner &gt; limit | Top-N látszik; többi elmosva | Emeld a csomagot |
| SKU 100% | Új termékek nem jönnek be | Scale / override |
| Árrés tease | Pro-n látszik az árrés | Pro |
| 2. shop | Multi-shop | Scale |
| Trial nap 20 / 27 | Pro próba vége | Válassz Start+ |

---

## 6. Planek, trial, Active Partner árazás

**v3 source of truth:** [`PRICING.md`](./PRICING.md). Itt csak a motor-rövidítés; árak, FOMO, copy ott.

### 6.0 Modell

Aktív vevő (widget-**rendelés** / naptári hó) + kevés Pro-kapu + SKU soft + **portál top-N**. Nincs Free. Invite → 30 nap Pro próba (logó kint) → Start minimum. Widget lejáratkor **él**.

### 6.1 Ártábla (összefoglaló)

| Csomag | Vevő / hó | Ft / hó | Szerep |
|--------|-----------|---------|--------|
| Próba | Pro 120 | 0 · 30 nap | Pro, logó kint |
| Start | 15 | 6 900 | Belépő |
| Plus ★ | 40 | 12 900 | Ajánlott; trial utáni cél |
| Pro | 120 | 24 900 | Fotó, logó le, árrés |
| Egyedi | 120+ | floor Pro | Override, nincs kártya |

Éves: 10× havi (2 hónap ajándék). CTA: *Tartsd a {n} vevőt*.

### 6.2 Feature (összefoglaló)

Ugyanaz a widget. Kapu = vevőszám + Pro extra (fotó, árrés, logó). Mátrix: [`PRICING.md`](./PRICING.md) §8.

### 6.3 Trial

Create → +30 nap, effektív Pro, `plan=start` (post-trial). Lejárat: Start keret, blur, admin crit, **widget OK**, amíg Aktiválás.

### 6.4 Meter

```
active_partners_month = COUNT DISTINCT customer_inner_id
  WHERE widget_order in calendar_month AND shop in org

partner_limit = override
  ?? (trial aktív → plan_defaults.pro)   -- v3: 120
  ?? plan_defaults[organizations.plan]

widget_opens = analitika, NEM billing
```

| Állapot | Widget | Merchant portál | Sync |
|---------|--------|-----------------|------|
| Vevő ≤ limit | OK | Teljes lista (≤N) | OK |
| Vevő &gt; limit | **OK** | Top-N + blur + Tartsd… | OK |
| SKU ≥ 100% | OK | Infra üzenet | **Stop** |
| Próba lejárt, nincs aktiválás | **OK** (Start keret) | Blur + döntő képernyő | OK |
| `suspended` | Off | — | — |

### 6.5 Stripe

v1: mailto + admin Aktiválás. Self-serve = később (D18).

### 6.6 90 nap metrics

| Metric | Cél |
|--------|-----|
| Trial → fizetős (Start vagy Plus) | ≥ 25% |
| Ebből Plus arány | a 16+ vevősökön magas |
| Churn | panasz ≠ „open miatt számláztak” |
| Upgrade oka | vevőkeret ≫ SKU |

---

## 6b. Verseny (Shoprenter ökoszisztéma)

| Szereplő | Költségérzet | Ti |
|----------|--------------|-----|
| Billingo | ~1–2 e Ft | Nem konkurens |
| Logzi | ~42,5 e Ft/hó + oktatás | Más job (ERP); objection only |
| CloudERP | Projekt | Time-to-value: napok vs hónapok |
| **Turinova** | 14,9e → 69,9e | Front gyors rendelés + insight |

**Pitch:** Billingo számláz, Logzi/CloudERP raktár, Turinova → partner leadja a tételt + te látod az árrést.  
**Árindoklás:** admin idő / elmaradt rendelés ROI — **nem** Logzi-ár összehasonlítás a fő slide-on.

### Objection

| Objection | Válasz |
|-----------|--------|
| Van Logzi | Back-office; shopban még kattintanak |
| Drága | Számold a rögzítési órát / elveszett kosarat |
| Majd ERP | 30 nap Pro most |

---

## 6c. Marketing stresszteszt (v2)

| Üzenet | Eredmény |
|--------|----------|
| Aktív = rendelés | **PASS** |
| Open = analitika | **PASS** |
| Portál top-N gate | **PASS** (kényszer) |
| Widget él | **PASS** |
| Nincs Free launch | **PASS** (összhang invite-only) |
| 30 nap Pro | **PASS** |
| Start ≤15 | **PASS** (kevesebb cliff) |
| Open a számlán | **FAIL** — tiltott |
| Csak banner, nincs gate | **FAIL** — tiltott |
| Logzi mint árhorgony | **FAIL** a pitchben |

**Cél skála:** először ~25–40 fizető Shoprenter tenant (ARR), majd 100; **300** csak multi-platform (Shopify stb.) mellett reális hosszú távon — ne legyen launch fantázia.

---

## 7. Rendszerarchitektúra

```
┌────────────────────────────────────────────────────────────┐
│  PLATFORM ADMIN   /admin/*                                 │
│  Tenant health · partner(order) meter · SKU soft · jobs    │
├────────────────────────────────────────────────────────────┤
│  MERCHANT PORTAL  · partner bar · top-N gate · upsell      │
├────────────────────────────────────────────────────────────┤
│  WIDGET APIs · search DB · resolve · order attribution     │
│  (opens = analytics only; orders = billing meter)          │
├────────────────────────────────────────────────────────────┤
│  COMMERCE · product_catalog · widget_orders attribution    │
│  organization_stats · plan limits (start|grow|pro|scale)   │
├────────────────────────────────────────────────────────────┤
│  JOB RUNNER (queue, concurrency, rate limit, resume)       │
├────────────────────────────────────────────────────────────┤
│  ADAPTERS: shoprenter (now) │ unas │ shopify │ …           │
└────────────────────────────────────────────────────────────┘
```

### 7.1 Adatbázis-határok (változatlan)

| DB | Szabad? |
|----|---------|
| Dedikált B2B SaaS Postgres | Igen — ez a rendszer home-ja |
| Main ERP DB | Nem |
| shop-portal tenant DB | Nem |

### 7.2 Sebesség törvények (nem alku)

| Útvonal | Szabály |
|---------|---------|
| `GET /api/products/search` | Csak DB, cél p95 &lt; 100–150 ms |
| `POST /api/products/resolve` | DB lookup + max 1 adapter ár/stock |
| Merchant listák / riport (célállapot) | DB facts; ne full Shoprenter crawl page loadon |
| Admin org lista | `organization_stats` (előaggregált), cél p95 &lt; 200 ms |
| Katalógus építés | Csak worker; soha typeahead requestben full crawl |

---

## 8. Multi-platform adapter szerződés

Minden webshop-platform egy adapter mögött áll. A commerce táblák **platform-agnosztikusak**.

### 8.1 Interface (logikai szerződés)

```text
CommerceAdapter
  ping(): Promise<boolean>
  listProductsPage(cursor): Promise<{
    items: CatalogProductDraft[]
    nextCursor: string | null
    pageCount?: number
  }>
  resolvePriceStock(
    ref: { externalProductId?: string; sku?: string },
    customerGroupId?: number | null
  ): Promise<PriceStockResult>
  rateLimit: { maxRps: number }
```

`CatalogProductDraft` kötelező mezői:

- `externalProductId`
- `sku`
- `modelNumber` (opcionális)
- `gtin` (opcionális)
- `name`
- `active`
- `minQty`, `qtyStep` (opcionális)
- `costNet` (opcionális — economics / árrés)

### 8.2 Shop azonosítás

- `shops.platform` = `'shoprenter' | 'unas' | 'shopify' | …`
- `product_catalog.platform` denormalizált másolat (lekérdezéshez)
- `external_product_id` = platform-specifikus termékazonosító (Shoprenternél a megszokott product id / resource id stratégia az adapteren belül egységesítve)

### 8.3 Bővítési szabály

Új platform = új adapter fájl + creds séma bővítés + `platform` enum érték.  
**Nem** új typeahead API és **nem** új `product_catalog` shape.

### 8.4 Shoprenter specifikum (első adapter)

- Rate: kb. max 2–3 req/s / shop (biztonsági szünet a page syncnél).
- Lista: `full=1`, praktikus page limit (pl. 200).
- Typeahead **nem** hívja a Shoprenter search endpointot production célállapotban.
- Resolve élő ár: meglévő enrich / customer group price logika az adapter `resolvePriceStock` mögött.

---

## 9. Adatmodell

### 9.1 Javasolt új SQL fájlok (manuális sorrend)

| Fájl | Tartalom |
|------|----------|
| `013_commerce_catalog.sql` | `product_catalog` + indexek |
| `014_sync_jobs.sql` | `sync_jobs`, `sync_cursors`, `shops` catalog oszlopok |
| `015_org_stats_and_limits.sql` | `organization_stats`, plan defaults (`start|grow|pro|scale`), partner_limit, sku_limit, list_price_huf |
| `016_partner_meter_and_orders.sql` | Widget order attribution (`customer_inner_id`, ordered_at, source=widget); daily opens **analytics**; Active Partner aggregátum |
| `017_rls_commerce.sql` | RLS + FORCE a commerce táblákon |

**Megjegyzés:** A partner meter **rendelés-attribúció** nélkül nem él — `016` a billing gerinc (D19), nem „késői nice-to-have”.

A számozás a meglévő `012` után folytatódik. Ha időközben más migráció kerül be, a fájlnevek igazítandók, a tartalom nem.

### 9.2 `product_catalog`

| Oszlop | Leírás |
|--------|--------|
| `id` | uuid PK |
| `shop_id` | FK shops |
| `organization_id` | denorm a gyors RLS / meterhez (opcionális, de ajánlott) |
| `platform` | text |
| `external_product_id` | text, platform id |
| `sku` | eredeti |
| `sku_norm` | `upper(trim(sku))` |
| `model_norm` | nullable, upper |
| `gtin_norm` | nullable, upper |
| `name` | rövid név typeahead metahez |
| `active` | boolean |
| `min_qty` | int default 1 |
| `qty_step` | int default 1 |
| `cost_net` | numeric nullable (P8 economics) |
| `list_price_net` | numeric nullable (opcionális typeahead listaár) |
| `synced_at` | timestamptz |
| `created_at` / `updated_at` | |

**Unique:** `(shop_id, sku_norm)`  
**Indexek:**

- `(shop_id, sku_norm)`
- `(shop_id, model_norm)` text_pattern_ops vagy `LIKE 'prefix%'`-barát index
- `(shop_id, gtin_norm)`
- partial `(shop_id) WHERE active`

**Nem tárolunk v1-ben:** HTML leírás, teljes képgaléria, teljes attribute tree, összes customer group price sor.

### 9.3 `shops` bővítések

| Oszlop | Értékek / jelentés |
|--------|---------------------|
| `platform` | default `shoprenter` |
| `catalog_status` | `pending` \| `syncing` \| `ready` \| `degraded` \| `error` \| `blocked_limit` |
| `catalog_product_count` | int ≥ 0 |
| `catalog_ready_at` | timestamptz nullable |
| `catalog_synced_at` | utolsó sikeres page/incremental |
| `catalog_error` | text nullable (rövid, nem secret) |
| `purged_at` | uninstall soft retain |

### 9.4 `sync_jobs`

| Oszlop | Leírás |
|--------|--------|
| `id` | uuid |
| `shop_id` | FK |
| `organization_id` | FK |
| `kind` | `full` \| `incremental` |
| `status` | `queued` \| `running` \| `succeeded` \| `failed` \| `cancelled` \| `blocked_limit` |
| `pages_done` / `pages_total` | progress |
| `products_upserted` | számláló |
| `error_code` / `error_message` | |
| `started_at` / `finished_at` | |
| `created_at` | |

**Invariant:** shoponként legfeljebb **egy** `queued|running` job.

### 9.5 `sync_cursors`

| Oszlop | Leírás |
|--------|--------|
| `shop_id` | PK rész |
| `resource` | pl. `products` |
| `cursor` | text / jsonb |
| `watermark` | pl. last `dateUpdated` |
| `updated_at` | |

### 9.6 `organization_stats`

Admin lista **ezt** olvassa, ne élő nehéz joinokat 300 tenantre.

| Oszlop | Leírás |
|--------|--------|
| `organization_id` | PK |
| `sku_count` | SUM aktív katalógus |
| `sku_limit` | effektív SKU soft limit |
| `active_partners_month` | unique partnerek **≥1 widget-rendeléssel** a hónapban |
| `partner_limit` | effektív partner limit (plan) |
| `widget_opens_month` | analitika only (nem billing) |
| `worst_catalog_status` | prioritás: error &gt; blocked_limit &gt; syncing &gt; … &gt; ready |
| `shops_count` | |
| `widget_enabled_any` | boolean |
| `widget_hits_24h` | |
| `search_count_24h` | |
| `orders_24h` | |
| `last_activity_at` | |
| `health` | `ok` \| `warn` \| `crit` |
| `updated_at` | |

**Health heurisztika (v1):**

- `crit`: suspended, trial lejárt policy, bármely shop `needs_reauth` + widget on, sync `error` stalled, vagy unpaid policy
- `warn`: partner ≥ 80% **(rendelés)**, portal over-cap, SKU ≥ 80%, `blocked_limit`, stalled sync, `degraded`
- `ok`: egyébként

### 9.7 `usage_counters`

Napi bontás org (és opcionálisan shop) szinten: `widget_config_hits`, `product_searches`, `product_resolves`, `widget_orders`.  
Inkrementálás: API oldalon olcsó `INSERT … ON CONFLICT DO UPDATE` vagy bufferelt flush.

### 9.8 RLS

Minden új commerce tábla: RLS + FORCE, session `app.organization_id` / platform admin bypass a meglévő mintára (`006`, `011`).  
Platform admin a meglévő `withPlatformAdmin` úton olvas.

---

## 10. Sync motor

### 10.1 Életciklus shoponként

```text
creds ping OK
  → catalog_status = pending|syncing
  → enqueue full job
  → pages… (resume cursor)
  → complete → catalog_status = ready, catalog_ready_at = now()
  → organization_stats refresh
```

Incremental (későbbi fázis): watermark / `dateUpdated` alapú; hiba esetén `degraded` (typeahead DB-ből megy, banner: ár/készlet frissülhet).

### 10.2 Concurrency és rate

| Szabály | Érték (kiinduló) |
|---------|------------------|
| Aktív job / shop | 1 |
| Globális párhuzamos shop job | ~10 (admin settings) |
| Adapter RPS / shop | adapter.rateLimit (Shoprenter ~2–3) |
| Fairness | Round-robin / ne éheztesse az új tenantet |

### 10.3 Hibák

| Esemény | Viselkedés |
|---------|------------|
| HTTP 429 | Exponential backoff, job nem `failed` azonnal |
| 401 / bad creds | Shop `needs_reauth`, job pause, admin+merchant chip |
| Hálózati blip | Retry N×, aztán `failed` + `catalog_error` |
| Limit | `blocked_limit`, resume upgrade után |
| Uninstall | Soft retain 30 nap; meter 0; worker skip |

### 10.4 Merchant / widget üzenetek sync közben

- `pending` / `syncing`: „Katalógus szinkronizálása… X%” — **ne** „Nincs találat”.
- `ready`: normál typeahead.
- `error`: „Katalógus hiba — nézd a Beállításokat” + resync CTA.
- `blocked_limit`: keresés a meglévőn + upgrade CTA.

---

## 11. API szerződés

### 11.1 Widget / publikus

| Method | Path | Authz | Viselkedés |
|--------|------|-------|------------|
| GET | `/api/products/search?q=&limit=&shopId=` | public_id + origin policy | DB prefix: sku_norm, model_norm, gtin_norm (+ opcionális name ILIKE később) |
| POST | `/api/products/resolve?shopId=` | ugyanaz | Body: lines/skus; DB → external id; ár/stock adapter |
| GET | `/api/widget/config?shopId=` | meglévő | + opcionális `catalogStatus` mező a widget üzenethez |

CORS: prototípusban lehet `*`; **production cél:** `shop_allowed_origins` (lásd SAAS W2).

### 11.2 Merchant (session)

| Method | Path | Viselkedés |
|--------|------|------------|
| GET | `/api/merchant/catalog` | status, %, count, limit, used, error, last job |
| POST | `/api/merchant/catalog/resync` | enqueue full ha nem blocked / nem reauth |
| (meglévő) | shop, widget, customers, reports | fokozatosan DB facts felé |

### 11.3 Platform admin

| Method | Path | Viselkedés |
|--------|------|------------|
| GET | `/api/admin/orgs` | lista `organization_stats`-szal |
| GET | `/api/admin/orgs/[id]` | org + shops + jobs + meter + usage |
| POST | `/api/admin/orgs/[id]/limit` | override sku_limit + audit |
| POST | `/api/admin/orgs/[id]/sync` | force / pause |
| POST | `/api/admin/orgs/[id]/purge-catalog` | hard purge + audit |
| PATCH | `/api/admin/orgs/[id]` | status/plan (meglévő bővítése) |

Minden érzékeny admin action → `audit_events`.

### 11.4 Entitlement helper (szerver)

```text
isTrialActive(org) → status==trial && now < trial_ends_at
effectivePlan(org) → trial active ? 'pro' : org.plan
  // plan ∈ { start, grow, pro, scale }  — no free at launch
partnerLimit(org) → override ?? defaults[effectivePlan].partner_limit
skuLimit(org) → override ?? defaults[effectivePlan].sku_limit
canUseProInsights(org) → effectivePlan in (pro, scale) || isTrialActive
portalVisiblePartnerCap(org) → partnerLimit(org)  // top-N rows; rest blurred
assertWidgetAllowed(org, shop) → !suspended && widget_enabled && (trial active || paid plan)
  // unpaid after trial → widget off until Start+
assertNeverKillWidgetForPartnerCap() → true  // enforcement = portal top-N only
```

---

## 12. Widget viselkedés

### 12.1 Célállapot keresés

1. Input ≥ 2 karakter → debounce (~220 ms) → `GET /api/products/search`.
2. Találat: SKU + meta (név, opcionális listaár, pack).
3. Üres lista ready állapotban: „Nincs találat: {q}” (látható).
4. Nem ready: „Katalógus még szinkronizál — próbáld pár perc múlva.”
5. Hiba: ne nyelje el csendben (`force` nélküli catch ma problémás) — mutasson rövid hibát.

### 12.2 Resolve / kosár

1. Enter vagy javaslat választás → resolve lines.
2. Gyártói szám (`F000345`) a DB-ben model_norm → sku (`GRFNY100`) mappinggel feloldható.
3. Ár: adapter `resolvePriceStock` a bejelentkezett vevő csoportjával.
4. Árrés a widgetben nem kötelező; a merchant riportban cost DB-ből (későbbi fázis).

### 12.3 Embed

```html
<script>
window.SR_B2B_QUICKORDER = {
  apiBase: "https://b2b.turinova.hu",
  shopId: "{shops.public_id}",
  allowedGroupIds: [],
  requireLogin: true,
  buttonLabel: "Gyors rendelés"
};
</script>
<script src="https://b2b.turinova.hu/widget.js"></script>
```

`apiBase` és `widget.js` **azonos origin** (tunnel / prod).

### 12.4 Cutover a régi indexről

1. Feature flag vagy env: `PRODUCT_SEARCH_SOURCE=db|legacy`.
2. DB ready shopokon `db`.
3. Stabil után: `getWarmProductCodeIndex` / `.cache/product-code-index-v6.json` kivezetése.

---

## 13. Merchant portál

Navigáció (meglévő): Home · Vevők · Riport · Widget · Beállítások.  
Design: DESIGN_SYSTEM, radius 0, factual vevőnézet (nincs coaching CRM).

### 13.1 `/home`

- Trial badge: „Pro próba · X nap van hátra” (30 napos trial).
- **Partner usage bar:** aktív (rendelő) partner / limit.
- Egy primary next action:
  1. Shop creds hiányzik → Beállítások
  2. Sync nem ready → „Katalógus készül (X%)”
  3. Ready, widget ki → Script
  4. Partner over-cap → portál blur + upgrade
  5. Trial vége → válassz Start+
  6. Kész → teszteld a shopban

### 13.2 `/settings`

- Meglévő: shop URL, API creds, ping, origins.
- **Új Catalog panel:**
  - `catalog_status` chip
  - progress %
  - product_count + **SKU soft** used/limit (infra)
  - **Partner** used/limit (billing)
  - last error
  - „Újra szinkronizálás”
- 80% / 100% partner → upsell; SKU blocked → infra üzenet

### 13.3 `/widget`

- Snippet generator a helyes `apiBase`-szel.
- Live preview.
- Ha sync nem ready: figyelmeztető sáv (ne ígérj működő typeaheadet).

### 13.4 `/vevok` és `/vevok/[id]`

- Meglévő factual 360 (pénz, termék, rendelés).
- Későbbi ticket: **Vendégek** fül (order-derived, nincs bulk group move).
- Gyorsítás hosszú távon: order facts DB-ből (P szint a fázisokban).

### 13.5 `/riport`

- KPI-k megmaradnak termékdöntés szerint (revenue, AOV, NRR, sleeping, group profitability, top partners/products, cost coverage).
- Cél: ne Shoprenter full order crawl minden page loadon → order/economics facts sync után DB.

---

## 14. Platform admin panel

**Célérzet:** egy pillantás = tenant egészség (big-brand partner dashboard).

Elérés: `/admin` (platform admin session).

### 14.1 Navigáció

| Elem | Útvonal | Szerep |
|------|---------|--------|
| Tenantok | `/admin` | Lista + szűrők + Új szervezet |
| Org detail | `/admin/orgs/[id]` | Meter, shops, jobs, usage, danger |
| Beállítások | `/admin/settings` | Default limitek, concurrency, trial napok |
| Jobs (opcionális M5+) | `/admin/jobs` | Globális futó/failed queue |

### 14.2 Tenant lista — oszlopok

| Oszlop | Forrás |
|--------|--------|
| Név / slug | organizations |
| Status | trial / active / suspended |
| Plan | start \| grow \| pro \| scale (+ trial status) |
| Partner meter | `active_partners_month / partner_limit` + progress |
| SKU meter (infra) | `sku_count / sku_limit` (másodlagos) |
| Shops | shops_count |
| Catalog | worst_catalog_status chip |
| Widget | enabled any |
| Health | ok / warn / crit |
| Last activity | organization_stats |
| Trial | countdown ha relevant |

**Szűrők:** q, status, plan, health, catalog_status.

**Create org drawer:** kötelezően beállítja a **30 napos** trial mezőket + plan path Start+; invite link banner (meglévő UX).

### 14.3 Org detail — blokkok

1. **Overview** — status, plan (`free|start|grow|pro|scale`), trial end, health; Suspend / Activate.
2. **Meter** — **Partner bar (rendelés)** + portál over-cap flag + SKU soft; partner/SKU override (audit).
3. **Shops** — platform, ping/reauth, catalog_status, product_count, last sync, error; Force sync / Pause.
4. **Sync jobs** — történet + futó; Resume.
5. **Widget usage** — opens, orders, active partners 24h/7d/hó.
6. **Members / invites** — meglévő resend.
7. **Danger zone** — purge catalog (confirm), hard delete policy.

### 14.4 Admin settings

- Default **vevő** limits: start 15 / plus 40 / pro 120 — [`PRICING.md`](./PRICING.md)
- Default **SKU** soft: 15k / 40k / 80k
- Default listaár (Ft): 6900 / 12900 / 24900
- Trial length days (default **30**)
- Portal top-N gate enabled
- Global sync concurrency
- (Később) feature flags

### 14.5 Audit

Minden: limit override, suspend, force sync, purge, plan change → `audit_events` (ki, mit, meta JSON, titok nélkül).

---

## 15. Sebesség és kapacitás

### 15.1 Méretbecslés

| Szcenárió | Sorok (kb.) | Megjegyzés |
|-----------|-------------|------------|
| 1 shop × 8 000 SKU | 8k | Triviális |
| 250 shop × 3 000 | ~750k | Normál SaaS Postgres |
| 50 shop × 20 000 | ~1M | Még OK indexekkel |

Vékony sor (~200–500 byte) + index: nem full webshop klón.

### 15.2 Költségdriver

SKU count + sync frekvencia → ezért metered plan.  
Widget request nem crawlez.

### 15.3 Multi-instance

Horizontális Next / worker: **közös DB + queue**. Tilos igazságot process-helyi Map/JSON fájlban tartani.

---

## 16. ERP párhuzam és továbblépés

Összhangban a repo `ARCHITECTURE_STRATEGY.md` elveivel:

| Elv | B2B most | Full ERP később |
|-----|----------|-----------------|
| Platform adapter | CommerceAdapter | Ugyanaz a minta, bővebb domain |
| Connection-specific products | `product_catalog` | ERP saját full product + mapping |
| Global master (VAT, manufacturer) | Elég string a vékony mirrorban | ERP master táblák |
| DB izoláció | B2B shared SaaS DB | ERP tenant/DB modell külön |
| Widget függés | **Soha nem függ ERP-től** | ERP olvashat / bridgeelhet |

Upsell: a merchant már „befektette” a katalógust és a widget szokást (endowment) → ERP natural next step.

---

## 17. Edge case katalógus

### 17.1 Catalog / sync

| # | Case | Elvárt |
|---|------|--------|
| C1 | 50k+ SKU shop | Órákig tartó full; resume cursor; ready csak complete |
| C2 | Adapter 429 | Backoff; ne permanent fail 1 hibára |
| C3 | `needs_reauth` | Job pause; chip merchant + admin |
| C4 | Uninstall | Soft retain 30 nap; meter 0; worker skip |
| C5 | Dupla worker | Unique active job / shop |
| C6 | Több Next replica | Nincs shared disk index igazság |
| C7 | Deploy / hideg process | Search azonnal DB-ből ha ready |
| C8 | SKU vs model (`F000345` → `GRFNY100`) | Mindkét norm mező kereshető; resolve mapping |
| C9 | Parent / `SZULO_` | Prefer child SKU (meglévő prefer logika átvitele) |
| C10 | Over-limit mid-sync | Stop új page; `blocked_limit`; widget él |
| C11 | Üres complete cache | Ne jelölj ready-t 0 termékkel ha az API hibás volt |

### 17.2 Tenancy

| # | Case | Elvárt |
|---|------|--------|
| T1–T5 | SAAS_ARCHITECTURE | Változatlan |
| T6 | shopId A → B adatai | Lehetetlen (shop_id + RLS) |
| T7 | 300 shop sync egyszerre | Queue cap + fairness |

### 17.3 Billing / trial / partner meter

| # | Case | Elvárt | Miért |
|---|------|--------|-------|
| B1 | Partner ≥ 80% (rendelés) | Warn + admin warn | Early upsell |
| B2 | Partner &gt; limit | **Portál top-N + blur + CTA**; widget **él** | Kényszer a merchantnél |
| B3 | SKU ≥ 100% | Sync stop; widget él meglévőn | Infra |
| B4 | Override ↑ | Clear gate / resume sync | Admin |
| B5 | Inactive SKU | Count ↓ | Fair |
| B6 | 2 shop, 1 partner | Unique org | Nincs dupla |
| B7 | Trial 30 nap Pro | Teljes Pro | Konverzió |
| B8 | Trial lejárat unpaid | Widget off + read-only amíg Start+ | Nincs Free loophole |
| B9 | ~~banner only~~ | **TÖRÖLVE** — helyette B2 portál-gate | Régi modell üres volt |
| B10 | Widget open | Csak analitika, **nem** billing | D3 |
| B11 | Widget order | Billing Active Partner + attribution row | D19 |


### 17.4 Widget

| # | Case | Elvárt |
|---|------|--------|
| W1 | public_id leak | Origin allowlist + rate limit (prod) |
| W2 | CORS `*` prod | Tilos célállapot |
| W3 | Cache-elt script + suspend | Server gate minden API-n |
| W4 | Shoprenter rate | Csak worker / ritka resolve |

### 17.5 Admin / ops

| # | Case | Elvárt |
|---|------|--------|
| O1 | Pool tenant bleed | SET LOCAL / transaction scope |
| O2 | Secret a logban | Tilos |
| O3 | Override / purge | Audit kötelező |
| O4 | Stats stale | Sync végén + periodikus refresh |

### 17.6 ERP jövő

| # | Case | Elvárt |
|---|------|--------|
| E1 | ERP bekapcsol | Bridge; widget nem törik |
| E2 | ERP full product | Bővebb séma ERP-ben; B2B vékony marad |
| E3 | Unas/Shopify | Új adapter, azonos catalog shape |
| E4 | Stock truth ERP | Flag: resolve source `adapter` \| `erp` \| `cache` |

---

## 18. Implementációs fázisok (v2 — árazáshoz igazítva)

**Kritikus út:** order-attribúció + meter + portál-gate **előbb**, mint full admin aggregátum / multi-platform.

| ID | Scope | Deliverable | Done when |
|----|-------|-------------|-----------|
| **M0** | Docs | Ez a dokumentum + SAAS/DATABASE plan enum sync | „Mehet” |
| **M1** | SQL + **order attribution** | `013`–`017` (manuális); widget `POST /api/orders`; `GET /api/merchant/billing`; plan `start\|grow\|pro\|scale` | 1 shopon számolható partner/hó |
| **M2** | Worker + Shoprenter adapter | Full sync 1 shop | `ready`; resume |
| **M3** | Widget API DB search/resolve | Typeahead DB | `F000345` / `GRFNY100`; p95 |
| **M4** | Merchant UI | Catalog, **partner bar**, trial 30 nap, **top-N blur gate**, upsell | Gate demo: 16. partner elmosva Starten |
| **M5** | Admin **vékony** | Org lista: plan, partner used/limit, health, trial (egyszerű query OK; teljes `organization_stats` később) | Látszik a meter |
| **M6** | **Billing enforcement** | Trial expiry job; unpaid gate; plan override; partner/SKU limits API | B1–B11 manuális |
| **M7** | Queue multi-shop | Concurrency | 3 shop parallel |
| **M8** | Economics / árrés | Cost sync → Pro riport | Coverage % |
| **M9** | Opens analytics + stats refresh | Widget-open counters (nem billing); opcionális stats materialize | „X nézte / Y rendelt” |
| **M10** | *(halasztva)* App Store OAuth + self-serve | Csak ha GTM vált | — |
| **M11** | *(halasztva)* Unas/Shopify stub | Multi-platform TAM | — |
| **M12** | *(halasztva)* ERP bridge doc | — | — |

**Miért M1 attribution:** enélkül nincs számlázás / case study.  
**Miért App Store nem kritikus most:** invite-only launch (D18).  
**Miért vékony M5:** 0–10 tenantnél előaggregálás luxus.

### 18.1 Admin DoD (M5 vékony)

- [ ] Plan + partner used/limit + trial countdown
- [ ] Force sync / limit override + audit
- [ ] Cross-tenant guard

### 18.2 Merchant + billing DoD (M4–M6)

- [ ] Typeahead DB + sync progress
- [ ] Partner bar rendelés-alapú
- [ ] Top-N portal gate
- [ ] Trial 30 nap → Start+ kötelező
- [ ] Widget nem áll le partner-cap miatt


## 19. Ellenőrző Definition of Done (egész rendszer)

1. Új org → **30 nap** teljes Pro trial.
2. Creds → sync → `ready` → typeahead azonnal (hideg restart után is).
3. **Active Partner = widget-rendelés**; open csak analitika.
4. Merchant: partner bar + **top-N blur** over-capnél; widget él.
5. Trial lejárat unpaid → widget off amíg Start+.
6. Admin: plan, partner meter, health, override, audit.
7. SKU 100%: sync-stop; widget él meglévőn.
8. Search p95 &lt; 150 ms.
9. Nincs `.cache` JSON függés productionben.
10. Dedikált B2B DB.
11. Árrés csak Pro+ (vagy trial).
12. Nincs Free tier a launchnál; plan enum: `start|grow|pro|scale`.


## 20. Shoprenter plugin / store copy váz

**Cím:** B2B Gyors Rendelés — cikkszámra, partnerárra  

**Alcím:** Shoprenter webshopba épülő B2B rendelő + Turinova merchant portál  

**Három bullet:**

1. Azonnali keresés saját cikkszámra, gyártói számra és vonalkódra  
2. Bejelentkezett partner csoportára  
3. Merchant portál: vevők, riport, widget vezérlés  

**Screenshot sorrend:** (1) widget a shopban (2) typeahead találat (3) portál vevő / riport  

**Install promise (invite GTM):** „API után sync — perceken belül tesztelhető. **30 nap Pro próba**, utána Start-tól.”  

**Árazás egy sorban:** „Annyit fizetsz, **ahány partnered tényleg rendel** a gyors rendeléssel — a gomb a limit felett is megy; a portálon a teljes partnerlista a csomagod része.”

Későbbi Shopify / Unas listing: **ugyanaz a value prop**, platformnév cseréjével.

---

## 21. Nyitott technikai választások (nem termékdöntés)

Ezek implementáció előtt / közben eldönthetők anélkül, hogy a 2. fejezet döntéseit bontanák:

| Téma | Opciók | Megjegyzés |
|------|--------|------------|
| Job runner | In-process cron + DB queue vs Trigger.dev / Inngest / külön worker | Productionben külön worker ajánlott |
| Stats refresh | Sync trigger + 5–15 perces cron | Elég v1-nek |
| Name search | Csak kódok vs + `ILIKE` name | Kódok előbb; name terheli az indexet |
| List price a typeaheadben | Null vs list_price_net cache | Resolve marad az igazság group árra |
| Prod CORS | Allowlist szigorítás ütemezése | M3 után, prod előtt kötelező |

---

## 22. Dokumentum-karbantartás

- Árazás / próba / FOMO változás: **[`PRICING.md`](./PRICING.md)** + a **2. fejezet** D-sorai, amelyekre hat. A dátum mindkét fejlécben.
- Új SQL fájl: frissítsd a **9.1** táblát és a [`DATABASE.md`](./DATABASE.md) futtatási listát.
- Fázis kész: pipáld az **18.** fejezet Done when sorát (vagy külön checklist issue).
- Ez a fájl az implementáció **előtti** igazság; a kód nem térhet el hallgatólagosan.

---

## Függelék A — Gyors referencia (v2)

**Árazás v3:** [`PRICING.md`](./PRICING.md) — Start 6 900≤15 · Plus 12 900≤40 · Pro 24 900≤120 · próba 30 nap Pro (logó kint) · widget lejáratkor él. Meter = widget-rendelés · top-N gate · Open = analitika · SKU soft · Invite-only · ERP külön.

## Függelék B — Typeahead jelenlegi vs cél

| | Jelenlegi | Cél |
|--|-----------|-----|
| Forrás | Élő SR + JSON index | `product_catalog` |
| Gyártói | Hideg index = üres | model_norm |
| Billing | — | Order attribution |

## Függelék C — Verseny + ár egy mondatban

Billingo/Logzi/CloudERP mellett · Turinova = storefront rendelés + insight · Fizetés: **rendelő partnerek** · Érvényesítés: **portál**, nem a gomb.

## Függelék D — Döntés → fejezet

| D | Hol |
|---|-----|
| D1 Trial 30 nap | §2, §6.3 |
| D2–D3 Partner rendelés | §2, §6.1, §6.4 |
| D6 Portál gate | §2, §6.2, §6.4, B2 |
| D12 Ft tábla + ROI | §2, §6.1, §6b |
| D18 Invite / no Free | §2, §18 M10 halasztva |
| D19 Attribution M1 | §2, §9.1, §18 |

## Függelék E — Stresszteszt diff (beépítve)

| Korrekció | Státusz |
|-----------|---------|
| D3 = csak rendelés | ✓ |
| B9 törölve → portál gate | ✓ |
| Free launch törölve | ✓ |
| Trial 30 nap | ✓ |
| Start ≤15 | ✓ |
| M1 order attribution | ✓ |
| App Store nem kritikus út | ✓ |
| Plan enum sync SAAS/DATABASE | ✓ (külön fájlok) |
| ROI ≠ Logzi horgony | ✓ |

---

**Dokumentum vége.**  
Implementáció ehhez a tervhez igazodva indul; következő lépést az ember adja meg.
