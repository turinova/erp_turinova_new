# Turinova B2B Platform + SaaS Admin — komplett implementációs dokumentáció

**Scope:** `b2b-portal` (merchant portál + storefront widget + platform admin)  
**Státusz:** Source of truth a commerce sync, SKU-meteres billing, admin health és multi-platform adapter tervhez  
**Utolsó frissítés:** 2026-08-18 (Active Partner **v2**: rendelés-meter, portál-gate, nincs Free launch, 30 nap trial, Start ≤15)  
**Implementáció:** Ez a dokumentum a terv. Kódírás csak explicit következő lépés után.

Kapcsolódó dokumentumok:

| Dokumentum | Szerep |
|------------|--------|
| [`SAAS_ARCHITECTURE.md`](./SAAS_ARCHITECTURE.md) | Tenancy, auth, shop creds, widget multi-tenant alap |
| [`DATABASE.md`](./DATABASE.md) | Manuális SQL futtatás, meglévő séma |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | UI nyelv (Olvasó / high_contrast, radius 0) |
| [`../sql/`](../sql/) | Létező migrációk `001`–`012` (manuális) |
| Repo: `ARCHITECTURE_STRATEGY.md` | Jövőbeli full ERP (külön DB, platform adapter minta) |

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
4. **Aktív partner / hó** (widget-**rendelés**) alapján eladható és érvényesíthető; SKU csak soft infra-cap; érvényesítés = **merchant portál** top-N gate.
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
**v2 korrekció (stresszteszt):** D3 csak rendelés; D6 portál-gate; **nincs Free launch**; trial **30 nap**; Start **≤15**.

### D1 — Trial: 30 nap teljes Pro → fizetős Start minimum

| | |
|--|--|
| **Döntés** | Org create → `status=trial`, `trial_ends_at = now()+30 days`. Trial = **teljes Pro**. Lejárat után **kötelező** fizetős plan (`start` minimum); nincs örök Free. |
| **Miért** | 14 nap B2B-nél gyakran rövid. 30 nap Pro = endowment (árrés, szokás). Free launch + invite-only ellentmondás volt; Free-t később App Store-nál lehet visszahozni. Trial→Start kényszer = konverzió. |

### D2 — Fő meter: aktív partner / hó (Active Partner)

| | |
|--|--|
| **Döntés** | Látható árazás = hány **aktív partner** / naptári hónap. Plan: **Start ≤15 · Grow ≤30 · Pro ≤80 · Scale ≤200 · Enterprise 200+**. (Nincs Free tier a launchnál.) |
| **Miért** | Partner = merchant-nyelv; nagy katalógus ICP nem büntetett. Start ≤15 elkerüli a 10→30 cliff-et (11–18 partneres tömeg). Csökkenő Ft/partner = volume discount. |

### D3 — Aktív = ≥1 widget-rendelés / hó (nem open)

| | |
|--|--|
| **Döntés** | Aktív partner = Shoprenter `customerInnerId`, aki a hónapban **≥1 rendelést indított/lezárt a widgeten**. Org = unique a shopokon. **Widget-open = csak analitika** („X nézte, Y rendelt”) — **soha nem billing**. |
| **Miért** | Open kontrollálhatatlan (kíváncsiság → Scale számla) → churn. A meter legyen az, amit a merchant **értékként** elfogad: rendelő partner. Open külön insight a portálon. |

### D4 — Feature ladder

| | |
|--|--|
| **Döntés** | Start = widget + typeahead + alap vevők/riport. Grow = teljesebb 360. **Árrés + deep riport + priority sync = Pro+**. Multi-shop = Scale+. |
| **Miért** | Trial után Start is ad értéket; Pro money salience (árrés) = upsell. Nincs Free feature-üres zuhanás trial végén. |

### D5 — SKU soft cap (infra, háttér)

| | |
|--|--|
| **Döntés** | Soft SKU: Start 15k · Grow 40k · Pro 80k · Scale 150k+. 80% warn; 100% sync-stop; widget él. Nem a fő pitch. |
| **Miért** | Sync költség SKU-val nő; partner-meter önmagában nem védi az infrát. |

### D6 — Widget soha nem áll le; érvényesítés = merchant portál top-N

| | |
|--|--|
| **Döntés** | Partner/SKU limitnél a **storefront widget mindig megy** (partner rendelhet). Érvényesítés: a **merchant portálon** partner-limit felett csak a **legaktívabb N partner** adatai látszanak (N = plan limit); a többi sor elmosva + CTA „Emeld a csomagot”. SKU 100%: sync-stop. Widget kill csak: suspended / lejárt trial unpaid / `widget_enabled=false`. |
| **Miért** | Loss aversion a végfelhasználónál. Portál-gate = Shopify-szerű paywall: merchant nem lát adatot → fizet; shop bevétel nem sérül. Banner önmagában (régi B9) **nem** kényszerít. |

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
| **Döntés** | Pro chip „Ajánlott”; Grow decoy; Start belépő. |
| **Miért** | Anchoring. Árindoklás **ne** Logzi-hoz: hanem **bérköltség / elveszett admin idő** (pl. 80 partner × pár perc rögzítés ≈ munkaerő Ft). Logzi csak objection handlingben. |

### D12 — Ársáv Ft (launch)

| | |
|--|--|
| **Döntés** | Start **14 900** (≤15) · Grow **34 900** (≤30) · Pro **69 900** (≤80) · Scale **139 900** (≤200) · Enterprise egyedi (floor Scale, ≤~700 Ft/partner). Éves −15–20%. |
| **Miért** | HU Ft. Start belépő &gt; számla-app, &lt; full ERP bevezetés. Start≤15 simítja a cliffet. ROI story: admin idő megtakarítás, nem „drágább mint Logzi”. |

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
| **1 Habit** | Partnereim rendelnek | Gyors rendelés | Partner limit → Grow/Pro |
| **2 Insight** | Látom a pénzt | 360, árrés | **Pro** (portál-gate + feature) |
| **3 Lock-in** | Ebből élek | Multi-shop, facts | Scale |
| **4 ERP** | Egész cég | Fulfillment | Külön termék |

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

## 6. Planek, trial, Active Partner árazás (v2)

### 6.0 Modell

**Active Partner (rendelés)** + feature ladder + SKU soft cap + **portál top-N gate**.  
**Launch:** nincs Free. Invite → 30 nap Pro trial → Start minimum.

### 6.1 Hivatalos ártábla (nettó Ft / hó)

| Csomag | Aktív partner / hó | Ár / hó | Ft / partner | Soft SKU | Szerep |
|--------|--------------------|---------|--------------|----------|--------|
| **Trial** | Pro keret (80) | 0 · **30 nap** | — | Pro | Teljes Pro |
| **Start** | ≤ **15** | **14 900** | 993 | 15 000 | Minimum fizetős |
| **Grow** | ≤ 30 | **34 900** | 1 163 | 40 000 | Decoy / közép |
| **Pro** ★ | ≤ 80 | **69 900** | 874 | 80 000 | Ajánlott + árrés |
| **Scale** | ≤ 200 | **139 900** | 700 | 150 000+ | Multi-shop |
| **Enterprise** | 200+ | egyedi (floor Scale, ≤~700 Ft/p) | csökken | egyedi | Sales |

**Éves:** −15–20%.  
**ROI indoklás (pitch):** pl. 80 partner × ~6 perc manuális rögzítés ≈ 8 óra/hó → bérköltség-összevetés; **ne** „Pro drágább mint Logzi”.  
**Start ≤15:** elkerüli a 10→30 tier-cliffet.

### 6.2 Feature mátrix

| Képesség | Start | Grow | Pro | Scale |
|----------|-------|------|-----|-------|
| Widget + typeahead | ✓ | ✓ | ✓ | ✓ |
| Alap vevők + alap riport | ✓ | ✓ | ✓ | ✓ |
| Teljes vevő 360 | korlátozott | ✓ | ✓ | ✓ |
| Árrés + cost coverage | — | — | ✓ | ✓ |
| Deep riport (NRR, sleeping, group) | — | részben | ✓ | ✓ |
| Priority sync | — | — | ✓ | ✓ |
| Multi-shop | — | — | — | ✓ |
| Portál: partner sorok | top **15** | top **30** | top **80** | top **200** |

Limit felett: elmosott sorok + upgrade CTA. Widget érintetlen.

### 6.3 Trial

1. Create → trial +30 nap, Pro entitlements.  
2. Lejárat + nincs fizetős plan → widget policy off + portal read-only + admin crit **amíg** Start+ nincs választva.  
3. Nincs Free esés (rossz szájíz elkerülése).

### 6.4 Meter

```
active_partners_month = COUNT DISTINCT customer_inner_id
  WHERE widget_order in calendar_month AND shop in org

partner_limit = override ?? plan_defaults[plan].partner_limit
  ?? (trial → 80)

sku_count / sku_limit = soft infra (sync-stop at 100%)
widget_opens = analytics only (NOT billing)
```

| Állapot | Widget | Merchant portál | Sync |
|---------|--------|-----------------|------|
| Partner ≤ limit | OK | Teljes lista (≤N) | OK |
| Partner &gt; limit | **OK** | Top-N + blur + CTA | OK |
| SKU ≥ 100% | OK (meglévő) | Infra üzenet | **Stop** |
| Trial lejárt unpaid | Off policy | Read-only | — |

### 6.5 Stripe

v1: manuális / admin plan váltás; meter DB-ben. Self-serve + App Store = később (D18).

### 6.6 90 nap metrics

| Metric | Cél |
|--------|-----|
| Trial→Start+ | ≥ 25% |
| Start→Grow/Pro | partner limit / árrés miatt |
| Churn | alacsony; panasz ≠ „open miatt számláztak” |
| Upgrade oka | partner/feature ≫ SKU |

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

- Default **partner** limits: start 15 / grow 30 / pro 80 / scale 200
- Default **SKU** soft limits: 15k / 40k / 80k / 150k+
- Default plan list prices (Ft): 14900 / 34900 / 69900 / 139900
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

- Minden termékdöntés-változás: frissítsd a **2. fejezet** tábláját és a dátumot a fejlécben.
- Új SQL fájl: frissítsd a **9.1** táblát és a [`DATABASE.md`](./DATABASE.md) futtatási listát.
- Fázis kész: pipáld az **18.** fejezet Done when sorát (vagy külön checklist issue).
- Ez a fájl az implementáció **előtti** igazság; a kód nem térhet el hallgatólagosan.

---

## Függelék A — Gyors referencia (v2)

Trial **30 nap** Pro → Start minimum · Active Partner = **widget-rendelés** · Start≤15 / Grow≤30 / Pro≤80 / Scale≤200 · Ár 14 900 / 34 900 / 69 900 / 139 900 · Portál top-N gate · Widget soha nem áll le partner-cap miatt · Open = analitika · SKU soft infra · Árrés=Pro+ · Invite-only launch (nincs Free) · Co-opetitor Billingo/Logzi · ROI = admin idő · Order attribution = M1 · App Store később.

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
