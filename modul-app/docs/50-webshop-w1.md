# 50 — Webshop W1 (plug-and-play + Agent Top)

**Állapot:** 2026-11-05 aktiválás · **2026-11-06 továbbfejlesztés jegelve** — handoff: [51-webshop-dev-pause.md](51-webshop-dev-pause.md)  
**Kapcsolat:** [38](38-agent-commerce.md), [39](39-webshop-addon.md), [40](40-storefront-catalog-ai.md), [51](51-webshop-dev-pause.md)  
**Nem W1:** kereső v2 (`archive/webshop` / `20260552`), ACP Instant Checkout API, UCP native checkout, saját domain kötelező

---

## 0. Egy mondat

> Square-szerű **Live** bolt (subdomain + kép/ár kapcsoló + később Stripe) + külön **Agent Top** feed (OpenAI 9 mező), hogy a termékek LLM-keresőben ajánlhatók legyenek — minimális szakértelemmel.

---

## 1. Zárolt döntések

| # | Döntés | Érték |
|---|---|---|
| 1 | Katalógus | Csak `accessories` |
| 2 | Opti / egyedi bútor | **Kívül** a bolton és a feed checkout eligibility-n |
| 3 | Két kapu | **Live** ≠ **Agent Top** (feed) |
| 4 | Domain W1 | `{slug}.<STOREFRONT_ROOT_DOMAIN>`; saját domain = W2 |
| 5 | Kereső v2 | **Nem** merge |
| 6 | Fizetés | Stripe Connect = W1.5 (előtte mailto kosár OK); ACP session API = W3 |
| 7 | HU / OpenAI market | Discovery feed + saját checkout; Instant Checkout ne legyen pitch, amíg partner onboarding nincs |
| 8 | Ár | Add-on 12 900 · Bolt+Online ~52 900 · Pro bundel csak élő bolttal |

---

## 2. Live vs Agent Top

### Live (emberi bolt / `sellable_web`)

Kötelező a bekapcsoláshoz (`shopRequirementIssues`):

- termék **aktív**
- **ár** > 0
- **fő kép**
- **cím** (web cím vagy alap név)

**Nem** kötelező Live-hoz: kategória-fa, 200 karakteres leírás, GTIN, kulcsadat-sablon, AI score.

Slug hiány esetén mentéskor egyedi slug generálódik (meglévő viselkedés).

### Agent Top (feed / LLM discovery)

OpenAI ACP discovery **9 kötelező** mező → nálunk `evaluateAiReadiness` + feed:

| OpenAI | Forrás |
|---|---|
| `item_id` | `accessories.id` |
| `title` | `web_title` \| `name` |
| `description` | long \| short, **≥ 80** karakter (tény) |
| `url` | kanonikus PDP |
| `brand` | `web_brand` \| gyártó |
| `seller_name` | tenant cég |
| `image_url` | fő kép (nyilvános URL) |
| `availability` | `on_hand > 0` → in_stock / out_of_stock |
| `price` | bruttó HUF a truth árból |

**Feed blocker** továbbá: title/leírás ↔ fő kulcsadat **mm ütközés** (LLM bunti).

**Nem** feed-blocker W1-ben: hiányzó GTIN/MPN (warn), hiányzó kategória (warn), hiányos kulcsadat-sablon (warn), galéria/alt (warn).

`is_eligible_search` ≈ `feedEligible`.  
`is_eligible_checkout` = false, amíg Stripe + TOS/privacy URL + külön ACP/UCP onboarding nincs.

---

## 3. Shop-ready szintek (értelmezés W1)

| Szint | Jelentés |
|---|---|
| `off` | Nincs a boltban |
| `blocked` | Live hiány (kép/ár/aktív/cím/slug) — **nem** tehető ki |
| `indexable` | Live OK; Agent Top még hiányos **vagy** soft hiányok |
| `competitive` / `agent_excellent` | Agent Top + extra minőség |

Lista szűrő (csak **bolt-tagok** = van `accessory_web` sor):
- `live` (default) = `sellable_web` — amit a vevő lát
- `draft` = bolt-tag, de nincs Live
- `incomplete` = Live + **nincs** Agent Top (márka + ≥80 karakter leírás)
- `agent_ok` = Live + Agent Top OK  
Legacy URL: `in_shop`→`live`, `not_in_shop`→`draft`.

**Nem** listázza az egész ERP-t (30k+). Hozzáadás: „Termék hozzáadása” dialógus —
- **Egy termék:** kereső (`search_accessories_page` + `ensureShopProduct`) → szerkesztő.
- **Gyártó szerint:** előnézet (`webshop_add_preview`) + set-based tagság (`webshop_add_by_manufacturer`, Live ki, chunk ≤2000, ~40 s budget + Folytatom). Migráció: `20260923_webshop_add_by_manufacturer.sql`. Siker után lista → **Készül**.

---

## 4. Admin UX W1

- Flag: `WEBSHOP_ENABLED = true`
- **Nav:** önálló szekció **Webshop** (Értékesítés után) — flat: Áttekintés · Katalógus · **Kategóriák** · **Jellemzők** · Értékelések · Elállások · Beállítások.
  - Kategóriák: fa + kulcsadat-sablon (max 4). Új = név (+ szülő); Google/intro/borító a Szerkeszt-ben.
  - Jellemzők: újrafelhasználható mezők. Új = név + típus (+ egység); kód a névből; listaértékek a kártyán.
- Kötelező onboard = Áttekintő + Katalógus + Beállítások
- **Katalógus:** web-first munkalista; primary **Termék hozzáadása** (egy termék / gyártó szerint tömeges tagság); Live switch; Agent badge; chip: Live / Készül / Agent hiányos / Agent kész. Limit 25. Kereső = Termékek minta: `search_shop_catalog_page` RPC + `/api/webshop/katalogus` + TanStack Query (`history.replaceState`, nem RSC `router.replace`). Migráció: `20260636_search_shop_catalog_page.sql` + `20260923_webshop_add_by_manufacturer.sql`.
- **Szerkesztő** (`/webshop/katalogus/[id]`): **Live** → **Agent Top** (`#agent`) → **Haladó**. ERP ár/kép = alapadatok.
- **ERP Online bolt kártya:** ha nincs web sor → „Hozzáadás a bolthoz”; ha van → Live kapcsoló.

### 4.1 `/webshop/beallitasok` (lean + szegmens tab)

**IA:** horizontális szegmens-tab + Mentés (Általános / Megjelenés / Kereskedelem / Szállítás / Fizetés). URL: `?tab=altalanos|megjelenes|kereskedelem|szallitas|fizetes|domain|jogi`.

| Tab | Tartalom |
|---|---|
| **Általános** | Bolt URL + Live db; eladó (ERP előtöltés + `legal_*` override); ügyfélszolgálat (`service_address`, `support_hours`). |
| **Megjelenés** | Logo (Cégadatok); képarány; nettó ár; eladott db; értékelések; **social URL-ek** (FB/IG/YouTube/TikTok/LinkedIn → storefront footer). |
| **Kereskedelem** | Készletküszöb; elállás/visszaküldés; jótállás; B2C/B2B + mikro/hírlevél/egyedi; AI tanítás. |
| **Szállítás** | Buyer promise: házhoz (díj + átfutás) + személyes átvétel. GLS = belső default carrier (nem checkout brand). Nincs multi-carrier / ingyenes küszöb UI W1-ben. |
| **Fizetés** | 3 buyer opció: bankkártya · átutalás · személyesen (átvételkor). COD nincs. Személyesen csak ha átvétel be van. Átutalás → bankszámla + foglalás. |
| **Domain** | Korábbi Csatornák UI. `/webshop/csatornak` → redirect ide. |
| **Jogi** | Fogyasztó Barát stub (bekötés P1). `/webshop/jogi` → redirect ide. |

Validációs hiba → hibás fül. Mentéskor a többi fül state-je is átmegy (storefront upsert), hogy ne írjuk felül üresre.

---

## 5. Edge (rövid)

| Edge | Viselkedés |
|---|---|
| Live OK, nincs leírás/márka | Boltban látszik; **kimarad** a feedből |
| Kitalált MPN SKU-ból | Tilos |
| Ár/készlet feed ≠ PDP | Tilos; egy truth |
| Opti / custom | Nincs `sellable_web` / feed checkout |
| Add-on off | `sellable_web` freeze |
| Pro auto webshop | Ne, amíg Stripe nincs |
| `20260552` | Ne futtasd |

Teljes edge lista: brainstorm / [38](38-agent-commerce.md) + commerce docs összefoglaló a chatben (OpenAI ACP, Anthropic handoff, Google UCP).

---

## 6. Fázisok

| | Mit | Kész ha |
|---|---|---|
| **W1a** | Flag + Live/Agent kapu (ez a doc) | Soft unlock staging/pilot |
| **W1b** | Stripe Connect + sale webhook | Első fizetett rendelés |
| **W1c** | Hub lean + onboarding wizard | &lt;30 perc első 3 Live termék |
| **W2** | Domain, Merchant, kulcsadat sablon 1 katt | |
| **W3** | ACP sessions / UCP cart-transfer / MCP | |

---

## 7. Visszakapcsolás checklist

1. Olvasd a szünet-handoffot: [51-webshop-dev-pause.md](51-webshop-dev-pause.md)  
2. Migrációk `20260535`–`20260551` (nem `20260552`) + [51](51-webshop-dev-pause.md) §2 (`20260923`, `20260924`, `20260636`)  
3. `WEBSHOP_ENABLED = true`  
4. `STOREFRONT_ROOT_DOMAIN` + demo/pilot tenant  
5. Platform → tenant webshop add-on  
6. Smoke: `/webshop`, `/bolt` footer+social, `/p/…`, Excel scoped import, feedek  
7. Marketing / Pro ígéret csak W1b után  

