# 38 — Agent-ready B2C commerce (lean storefront)

**Státusz:** fázis **A · Adat** ✅ + **B · PDP** (publikus `/p/[slug]` + JSON-LD); C–F később  
**Migráció:** `supabase/migrations/20260535_accessory_webshop.sql`, `20260536_webshop_addon.sql` (+ taxonomy/enrich: `20260537`–`39`)  
**UI:** `/webshop/*` (add-on) + termék űrlap **Webshop** + lista badge · storefront `/p/[slug]`  
**Kapcsolat:** [17](17-saas-architecture.md), [28](28-ertekesites-workflow.md), [36](36-szamlazas-workflow.md), [39](39-webshop-addon.md)  
**Nem ez:** Shoprenter csatolás · B2B nettó lista · lapszabászat / Opti ajánlat webshop

---

## 0. Egy mondat

> Az ERP (`accessories`) a termékigazság; a bolt lean **PDP + checkout** (mobil/tablet first), saját tenant domainen, **Stripe wallet + kártya**; ugyanaz a rekord táplálja a **keresőket (SEO / Merchant)** és az **LLM / agent feedeket (ACP / MCP)**.

---

## 1. Zárolt döntések

| # | Döntés | Érték |
|---|---|---|
| 1 | Célközönség (P0) | **Csak B2C** |
| 2 | Katalógus | **Csak `accessories`** (kész SKU) |
| 3 | Lapszabászat / Opti | **Kívül** (külön quote flow) |
| 4 | Shoprenter / legacy B2B widget | **Nem** ez a channel |
| 5 | UI scope | **PDP + checkout** (+ vékony kosár ha kell) |
| 6 | Domain | **Saját domain** (CNAME); devhez opcionális platform subdomain |
| 7 | Tenancy | Tenant = saját bolt (saját branding, seller, Stripe Connect) |
| 8 | Ország / pénznem | **HU-only**, **HUF** |
| 9 | Fizetés (P0) | **Csak wallet + kártya** (Apple Pay, Google Pay, card) — **nincs** átutalás P0-ban |
| 10 | Fizetés provider | **Stripe Connect** + **Express Checkout Element** |
| 11 | Készlet megjelenés (P0) | **Bináris:** Raktáron / Elfogyott; feed: `in_stock` / `out_of_stock` (`on_hand > 0`) |
| 12 | Szállítás (P0) | Egyszerű (pl. flat díj és/vagy üzleti átvétel) — **később** több courier |
| 13 | Adatelv | **Egy truth → több kimenet** (PDP, JSON-LD, ACP feed, Google feed, MCP) |

---

## 2. Miért (stratégia)

### 2.1 Probléma a klasszikus webshop-csatolással

- Két igazság (ERP ↔ Shoprenter) → sync hell
- Theme / app / widget komplexitás
- AI feed utólagos toldalék

### 2.2 Célállapot

Az online vásárlás egyre inkább **agent / LLM discovery** + **emberi (vagy wallet) checkout**.  
A merchant felület: **megbízható termékoldal + gyors fizetés**, nem 40 oldalas katalógus-labirintus.

### 2.3 Iparági illeszkedés

| Forrás | Tanulság |
|---|---|
| Odoo | Egy backend truth (product → SO); checkout egyszerűsödik; headless = frontend ≠ ERP theme |
| OpenAI ACP | Product feed + checkout API; tényszerű mezők, stable ID, eligibility |
| Google Merchant / schema.org | Ugyanaz a mag: title, description, price, availability, brand, GTIN, Offer |
| Shopify WebMCP / storefront-MCP demók | Agent toolok: search / get_product / cart / checkout — lean surface |

---

## 3. Architektúra

```
Discovery (nem / nem csak ti UI)
  ACP feed · Google Merchant · SEO crawler · MCP tools
                    │
                    ▼ product id / slug / url
Tenant saját domain (shop.ceg.hu)
  /p/[slug]     PDP (mobil/tablet first)
  /cart         opcionális, vékony
  /checkout     Express Checkout (Apple/Google/card)
                    │
                    ▼ PaymentIntent success + webhook
modul-app (truth)
  accessories · stock · sales · (később számla)
                    │
                    ▼
Stripe Connect (connected account = tenant)
```

**Emberi út:** link / QR / agent „nyisd meg” → PDP → wallet/card → köszönő oldal.  
**Agent út (később):** feed/MCP → checkout session → ember confirm / delegated pay → ERP sale.

---

## 4. Termékadat — LLM & kereső tudásbázis

### 4.1 Egy mondat

> Az LLM és a kereső **stabil ID-jú, tényszerű, strukturált rekordot** indexel; ha ár / stock / leírás hazudik vagy hiányzik, **nem ajánl** (vagy rosszul ajánl).

### 4.2 DB mezőtábla (`accessories` — fázis A)

| DB oszlop | UI | ACP | Google | Anthropic | Megjegyzés |
|---|---|---|---|---|---|
| `id` | — | id | id | product_id | Stabil UUID |
| `sellable_web` | Elérhető a webshopon | eligibility | — | — | Független a `sellable_pos`-tól |
| `web_slug` | URL slug | url path | link | — | Unique / tenant (alive) |
| `web_title` | Bolt címe | title | title | title | Üres → `name` |
| `web_description_short` | Rövid leírás | — | snippet | short_description | Search / list |
| `web_description_long` | Részletes | description | description | long_description | Plain ≤5k |
| `web_brand` | Márka | brand | brand | brand | Üres → manufacturer |
| `web_gtin` | GTIN | gtin | gtin | — | Üres → `barcode` |
| `web_mpn` | MPN | mpn | mpn | — | brand+mpn fallback |
| `web_product_type` | Terméktípus | product_category | product_type | category | `A > B > C` |
| `web_google_category` | Google kat. | — | google_product_category | — | Path vagy ID |
| `web_tags` | Címkék | — | — | tags | text[] |
| `web_search_aliases` | Szinonimák | — | — | — | Agent vocabulary |
| `web_color` / `size` / `material` | Feed denorm | color/size/material | ugyanaz | attributes | UI: műszaki attr `code`; nem külön űrlap |
| `web_attributes` | Legacy szabad párok | — | — | attributes | jsonb; UI-n nem szerkesztett |
| `web_specs` | Egyéb műszaki (szabad) | — | — | specs | jsonb |
| `image_url` | Fő kép | image | image_link | image_url | Termék **Képek** szekció |
| `web_gallery` | Galéria | media[] | additional_image | — | Ugyanott; fő nélkül |
| `web_faq` | FAQ | — | — | — | `[{q,a}]` |
| `web_use_cases` / `web_compatibility` | Használat | — | — | — | text[] |
| `web_compare_at_price` | Áthúzott bruttó | list_price | sale vs price | — | integer Ft |
| `shipping_*` / `product_*` | Csomag / termék dim | shipping | shipping_weight / dims | — | numeric |
| `web_group_id` | Termékcsoport | item_group_id | item_group_id | — | Variáns P1 |
| `price_net` + ÁFA | Bruttó preview | price | price | price | Számított bruttó feedben |
| stock `on_hand` | — | availability | availability | in_stock | Bináris szabály |

Helper: `src/lib/accessories/web-shop.ts` → `evaluateShopReady`.

### 4.3 Shop ready szintek (emberi UI)

| Szint | Badge (UI) | Feltétel (röviden) |
|---|---|---|
| `off` | Nincs a boltban | `sellable_web = false` |
| `blocked` | Majdnem kész | Nincs slug / cím / kép / ár / aktív, vagy short&lt;80 / long&lt;200 / brand / product_type |
| `indexable` | Alapból kész | Mag OK, soft hiányok |
| `competitive` | Kész a boltra | + GTIN\|brand+mpn, ≥3 galéria, ≥4 attr/spec, google cat, shipping weight |
| `agent_excellent` | Szuper kitöltés | + FAQ\|use_cases + search aliases |

**UX (űrlap):** Webshop = kapcsoló + kategória + **egy leírás** (short auto) + műszaki (ha van lista). Opcionális egy sáv: akcióár, csomag, MPN, FAQ. Mentéskor auto-enrich: alias, specs-parse, FAQ sablon, shipping default — [39](39-webshop-addon.md).

### 4.4 Offer / trust (tenant — UI: `/webshop/beallitasok`)

| Mező | Szerep |
|---|---|
| `condition` = new | Feed konstans |
| Szállítás: ország, díj, SLA | Tenant setting |
| Return / privacy / ÁSZF URL | Tenant (`terms_url`, `privacy_url`) |
| Tárhely-szolgáltató, panaszkezelés / békéltető | Tenant (`hosting_provider_*`, `complaint_info`) — lábléc (Ekertv. 4. §) |
| `seller_name`, `seller_url` | = tenant cég |

### 4.5 Amit büntet / kerülni

- Keyword-töltött cím
- Üres / másolt leírás
- Ár feed ≠ PDP ≠ checkout
- „Raktáron” feedben, checkout fail
- Változó product id
- Csak kép, nulla szöveg

### 4.6 Egy truth → több kimenet

```
accessories + web_*
  → PDP HTML + JSON-LD (schema.org Product + Offer)
  → feed ACP / ChatGPT
  → feed Google Merchant
  → MCP get_product / search
```

Nincs külön „SEO szöveg” és „AI szöveg”.

### 4.7 Készlet szabály (P0)

| Réteg | Viselkedés |
|---|---|
| PDP | „Raktáron” / „Nincs készleten”; pontos db csak `on_hand ≤ low_stock_threshold` (valós szűkösség) |
| Feed | `in_stock` ha `on_hand > 0`, else `out_of_stock` |
| Checkout | Foglalás / újraellenőrzés fizetés előtt; ha nincs → hiba, ne charge |

Később: tenant flag „mutasd a darabszámot”.

---

## 5. Storefront UX (certainty-first)

### 5.1 Kell (P0)

- **PDP:** mobil-first, blokksorrend (`components/storefront/pdp-view.tsx`):
  1. Galéria 1:1 swipe + mobil thumb-sor + fullscreen lightbox (tap-zoom, Esc/nyilak)
  2. Morzsamenü (bolt · webkategória útvonal, szöveg) · márka · cím · attribútum-sor (méret · szín · anyag) · ⭐ összesítő → `#ertekelesek`
  3. Ár bruttó · „ÁFA benne van” · áthúzott ár **csak** az előző 30 nap legalacsonyabb ára (`storefront_reference_price`, árelőzmény triggerből), ha magasabb a mostaninál (Omnibus). A kézi `web_compare_at_price` nem jelenik meg áthúzva.
  4. Variáns (`web_group_id`): tengely = amiben a család tagjai eltérnek (max 3; szín → képes gomb, többi → rács, számnál numerikus sorrend); fallback `web_color` / `web_size`; elfogyott áthúzva; „Passzol-e?” link → `#passzol`
  5. Készlet (ikon+szöveg; darabszám csak `on_hand ≤ low_stock_threshold`) · átvétel · szállítás idő+díj · „30 napban X db kelt el” (csak ≥5, valós rendelés)
  6. Buy box: mennyiségi ár chipek (`web_price_tiers`), mennyiség, **1 primary CTA** — checkoutig: „Megrendelem e-mailben · összeg” (előre kitöltött mailto: termék, cikkszám, db, ár) / készlethiánynál „Szólj, ha újra van” / e-mail nélkül telefon; ha egyik sincs, disabled, ingyenes szállításig hiányzó összeg; mobil sticky sáv csak ha az inline CTA nem látszik
  7. Kockázatcsökkentés a CTA alatt: elállás (mindig, legalább 14 nap — `return_days < 14` nem menthető), jótállás, telefon
  8. „Passzol-e?” — a kategória **kulcsadatai** (max 4; az első kiemelt kártya) + „Hogyan mérd le?” sor, mérési ábra (termék saját → kategória), „Mihez illik”, segítség-sor (hívj / küldj fotót). Nincs kulcsadat → a blokk rejtve. Általános H×Sz×M×súly **nem** kerül ide ([39](39-webshop-addon.md) Kulcsadatok).
  9. „Mire jó?” (use cases) · accordion: Leírás (nyitva), Műszaki adatok, Csomag tartalma, Szállítás és visszaküldés (törvényes elállás + kellék-/termékszavatosság szöveg mindig, tenant szöveg kiegészítés), Gyártó és biztonság (GPSR: gyártó / EU felelős neve, címe, elérhetősége, termékazonosító, `web_safety_info` figyelmeztetés), GYIK
  10. Értékelések (moderált, eloszlás, eladói válasz, beküldő űrlap honeypot-tal, adatkezelési mondat + `privacy_url` link; „nem ellenőrizzük, hogy megvásárolta-e” közlés — Fttv. / Omnibus) · „Ugyanebből a sorozatból” · „Gyakran együtt vásárolt” (valós co-purchase RPC)
  11. Lábléc: eladó impresszum a Cégadatokból (név, székhely, cégjegyzékszám, adószám, e-mail, telefon), ÁSZF / adatkezelés link, panaszkezelés, tárhely-szolgáltató. ODR link nem kell (platform megszűnt 2025-07-20).
- **SEO:** `<title>` = „termék · bolt neve” (nem platformnév), canonical + `og:url`; JSON-LD `Offer.shippingDetails` (ha van díj), `hasMerchantReturnPolicy` (napok), `gtin` csak 8–14 számjegy, `manufacturer`. BreadcrumbList majd kategória-oldalakkal (URL kell).
- **Etika (zárolt):** nincs visszaszámláló, kitalált „X nézi most”, hamis ár-horgony; social proof csak valós adatból. JSON-LD `aggregateRating` csak ha van jóváhagyott értékelés.
- **Checkout:** Express Checkout (Apple / Google / card), email, szállítási cím
- **Thank you:** order szám + összefoglaló
- Mobil / tablet first, nagy touch CTA

### 5.2 Nem kell (P0)

- Mega menü, blog, wishlist, összehasonlító, 12 lépéses checkout
- Teljes kategória-labirintus (elég kereső + kevés collection később)
- Átutalásos fizetés
- B2B login / nettó ár

### 5.3 Kosár

Opcionális vékony oldal; Express Pay PDP-ről is mehet (1 tétel), több tételnél kosár → checkout.

---

## 6. Fizetés (P0)

| Elem | Döntés |
|---|---|
| Provider | **Stripe** |
| Modell | **Connect** — tenant = connected account |
| UI | **Express Checkout Element** (Apple Pay, Google Pay, card, Link ha elérhető) |
| Engedélyezett | **Csak wallet + kártya** |
| Tiltott P0 | Átutalás, utánvét (későbbi döntés) |
| Domain | Minden **saját domain** regisztrálva wallethez (Apple Pay domain verify) |
| Után | Webhook → idempotens ERP `sale` + stock out + (opcionális) számla később |

Sikeres fizetés nélkül **nincs** ERP eladás.

---

## 7. Domain & multi-tenant

| Elem | P0 |
|---|---|
| Prod | Tenant **saját domain** (CNAME → platform edge) |
| Dev / demo | Opcionális `{slug}.…` platform subdomain, amíg DNS nincs |
| SSL | Automata (platform) |
| Branding | Logo, megjelenő név, (minimal) szín — seller = cégadatok |
| Feed seller_* | Tenant cégnév + bolt URL |

---

## 8. Szállítás

### 8.1 P0

- Egyszerű modell: pl. **flat szállítási díj (HUF)** és/vagy **üzleti átvétel**
- Checkoutban 1–2 opció, nem courier marketplace

### 8.2 P1+ (zárolt irány, nem P0 scope)

- Több **shipment courier** felvétele (GLS, Foxpost, MPL, …)
- Courier adapter interfész: quote + label + tracking
- Termék súly / méret kötelezőbbé válik a pontos díjhoz

---

## 9. ERP illesztés

| Lépés | Viselkedés |
|---|---|
| Katalógus | `accessories` ahol `sellable_web` + `active` (+ shop-ready nem blocked) |
| Ár | B2C bruttó a PDP/feedben; ERP továbbra is nettó + ÁFA |
| Order | Sikeres Stripe charge → `sales` (channel: `webshop`) |
| Készlet | Ugyanaz a stock outbound mint eladásnál |
| Számla | P1: meglévő Számlázz flow sale-re |

**Nem** keverendő: lapszabászat `quotes` / Opti.

---

## 10. MVP fázisok

| Fázis | Szállítás | Kész ha |
|---|---|---|
| **A · Adat** ✅ | `20260535`+ Webshop FormSection + lista badge + `evaluateShopReady` + auto-enrich | Staff kitölthet shop-ready SKU-t |
| **B · PDP** ✅ | Publikus `/p/[slug]` (demo tenant env), JSON-LD, mobile-first gallery + sticky CTA + desktop split; bináris stock; CTA disabled → C | Ember megnyitja, érti, CTA látszik |
| **C · Checkout** | Stripe Connect + Express Checkout → webhook → sale + stock | Apple/Google/card happy path HU-n |
| **D · Feed** | HU/HUF export ugyanabból a view-ból (fájl vagy API) | Validálható ACP/Google-szerű sorok |
| **E · Agent (később)** | MCP tools / ACP partner onboarding | search + get_product (+ checkout session) |
| **F · Couriers (később)** | Több szállító | Quote a checkoutban |

---

## 11. Nem-célok (explicit)

- Shoprenter / Shopify mint master katalógus
- B2B nettó / vevőcsoport ár P0
- Lapszabászat web konfigurátor a storefronton
- Átutalás P0
- Teljes CMS / blog / marketing site a bolt appban
- Multi-country / multi-currency P0

---

## 12. Nyitott (nem blokkoló P0-t)

| Kérdés | Default ha nincs válasz |
|---|---|
| Üzleti átvétel P0-ban? | Igen, ha van default raktár / cím |
| Flat shipping összeg | Tenant setting (HUF) |
| Platform fee % | Üzleti döntés Connect application fee-nél |
| Számla automatikus web sale-re? | P1; P0 elég sale + email nyugta / Stripe receipt |

---

## 13. Sikermérők (irány)

- Shop-ready SKU arány (`competitive`+ / `sellable_web`)
- Checkout completion (PDP → paid)
- Feed completeness (% kötelező mező kitöltve)
- Stock mismatch incidentek (eladás fail stock miatt) ≈ 0

---

## 14. Hivatkozások (külső)

- [Agentic Commerce Protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [OpenAI Commerce – product feed / best practices](https://developers.openai.com/commerce)
- [Stripe Express Checkout Element](https://docs.stripe.com/elements/express-checkout-element)
- [schema.org Product](https://schema.org/Product) · Google Merchant product data spec
- Demók: [storefront-mcp](https://github.com/Maarmapa/storefront-mcp), [webmcp-shop](https://github.com/qiun/webmcp-shop)

---

**Kapcsolódó belső docok:** `INDEX.md`, `28` (web channel), `21` (ha billing / Stripe platform), `40` (katalógus, feedek, AI-készség — F1–F3 kész).
