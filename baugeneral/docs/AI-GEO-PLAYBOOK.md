# AI & GEO playbook — baugeneral.hu

**Cél:** A weboldal legyen **AI-kereső-barát** — ChatGPT Search, Perplexity, Google AI Overviews, Gemini, Copilot idézhessék a BauGenerál Kft.-t.

**Alap:** A [hiros-ablak/site](../../hiros-ablak/site/) projektben bevált minták + 2026-os GEO (Generative Engine Optimization) gyakorlat.

> A GEO **nem helyettesíti** a klasszikus SEO-t — ráépül: gyors, indexelhető, helyi relevancia + **idézhető tartalomblokkok**.

---

## 1. Mi a GEO?

| Régi SEO | GEO (2026) |
|----------|------------|
| #1 hely a linklistában | **Idézet az AI összefoglalóban** |
| Kulcsszó sűrűség | **40–60 szavas önálló válaszblokkok** |
| Csak Google | ChatGPT, Perplexity, Gemini, AI Overview, Copilot |

**BauGeneral cél-lekérdezések** (később mérni):

- `generálkivitelező Kecskemét`
- `ipari csarnok építés Bács-Kiskun megye`
- `autószalon építés generálkivitelező`
- `társasház generálkivitelezés`
- `industrial contractor Kecskemét Hungary` (EN)

---

## 2. Hiros-ablak — mit másolunk 1:1

Ezek a **hiros-ablak/site**-ban már működnek; BauGeneralnál ugyanez a technikai alap.

### 2.1 Single source of truth — `company.ts`

**Fájl:** `hiros-ablak/site/src/lib/company.ts`

- NAP (cím, telefon, email)
- `website` canonical URL
- `geo`, `hours`
- `buildOrganizationJsonLd()`, `buildLocalBusinessJsonLd()`
- `sameAs` (social) — BauGeneralnál csak ami van

**Szabály:** Footer, kapcsolat, JSON-LD, `llms.txt`, űrlap — **mind onnan**.

### 2.2 SEO segéd — `seo.ts`

**Fájl:** `hiros-ablak/site/src/lib/seo.ts`

- `pageMetadata()` — title, description, canonical, OG, Twitter
- `getDefaultRobots()` — **preview/staging noindex** (`VERCEL_ENV=preview`)
- `buildBreadcrumbJsonLd()`, `buildWebSiteJsonLd()`
- `DEFAULT_OG_IMAGE` — 1200×630

### 2.3 `public/llms.txt`

**Fájl:** `hiros-ablak/site/public/llms.txt`

- Markdown-szerű, ember + AI olvasható
- Elevator pitch blockquote
- Kulcs URL-ek listája
- **Facts for AI assistants** — korlátozások (mit nem ígérünk)
- Footer link: „LLM / AI összefoglaló” → `/llms.txt`

**BauGeneral:** magyar + rövid angol szekció; futó projektek URL; nincs publikus ár.

### 2.4 JSON-LD minták

| Oldal típus | Schema | Hiros példa |
|-------------|--------|-------------|
| Layout | `Organization` | `layout.tsx` |
| Főoldal | `WebSite`, `FAQPage`, `LocalBusiness` | `page.tsx` |
| Szolgáltatás | `Service`, `FAQPage`, `BreadcrumbList` | lapszabászat, szállítóláda |
| Folyamat | `HowTo` | **BauGeneral új** — hiros-nál részben implicit |
| Kapcsolat | `LocalBusiness` | `kapcsolat/page.tsx` |

**Aranyszabály:** A schema szövege **=** a látható HTML szöveg. Eltérés → AI figyelmen kívül hagyja.

### 2.5 FAQ pattern

```tsx
// Látható FAQ accordion + ugyanabból FAQPage JSON-LD
const faqItems = [{ q: "...", a: "..." }]
```

**Miért:** Google featured snippet + Perplexity direct quote + ChatGPT összefoglaló.

### 2.6 `robots.ts` + sitemap

**Hiros:** `allow: /` minden user-agentre; sitemap URL a `company.website`-ből.

**BauGeneral bővítés:** explicit AI **search** crawler allow (lásd §4).

### 2.7 Deploy checklist

**Fájl:** `hiros-ablak/site/DEPLOY.md`

- Vercel root: `baugeneral/site`
- Canonical domain `company.ts`-ben
- Search Console + sitemap submit
- OG image Facebook Debugger újrascrape

---

## 3. BauGeneral-specifikus AI elemek

### 3.1 Entitás-ismétlés (40 szó)

Ugyanaz a definíció **minimum 5 helyen:**

1. Főoldal „Gyors tények”
2. Footer
3. `llms.txt`
4. `/rolunk`
5. `Organization` JSON-LD `description`
6. EN tükör oldalak

### 3.2 „7 blokk” oldalstruktúra (GEO)

Minden fontos oldal (szolgáltatás, referencia, futó projekt):

| Blokk | Szabály |
|-------|---------|
| **TL;DR** | 40–60 szó, önálló válasz |
| **Bevezető** | Entitások, kontextus |
| **H2 szekciók** | Kérdés formátum + válasz kapszula |
| **Táblázat / lista** | AI kedvenc formátum (~50% idézet) |
| **FAQ** | 5–10 pár + `FAQPage` schema |
| **Key takeaways** | 4–6 bullet |
| **Kapcsolódó linkek** | 4–8 belső URL |

### 3.3 `/gyors-tenyek` (opcionális, erősen ajánlott)

Dedikált, plain fact sheet oldal — AI citálási célpont.

### 3.4 Futó projektek — AI arany

- Külön URL: `/futo-projektek/[slug]`
- `dateModified` schema + látható „Utolsó frissítés”
- `llms.txt`-ben: „Active projects at /futo-projektek”
- 2–4 hetente frissítés

### 3.5 `GeneralContractor` schema

Építőipari kategória egyértelműsítése AI-nak (Organization mellett / alatt).

---

## 4. robots.txt — AI crawler stratégia

**Cél:** megjelenni AI **kereső** válaszaiban.

### Engedélyezendő (citáláshoz)

| User-agent | Motor |
|------------|-------|
| `OAI-SearchBot` | ChatGPT Search |
| `ChatGPT-User` | User-triggered fetch |
| `PerplexityBot` | Perplexity index |
| `Perplexity-User` | Perplexity real-time |
| `Claude-SearchBot` | Claude search |
| `Bingbot` | Bing / Copilot / ChatGPT index |
| `Googlebot` | Google |

### Külön döntés (training)

| User-agent | Jelentés |
|------------|----------|
| `GPTBot` | OpenAI training |
| `ClaudeBot` | Anthropic training |
| `Google-Extended` | Gemini generative use |

**Javasolt indulás:** search botok **Allow**; training botok — csapat döntése ([OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)).

**Ellenőrizni:** Vercel / Cloudflare ne blokkolja globálisan az „AI bot”-okat.

Implementáció: `baugeneral/site/src/app/robots.ts` — Next.js `MetadataRoute.Robots`, több `rules` tömb elem user-agentenként.

---

## 5. llms.txt váz (BauGeneral)

```txt
# BauGenerál Kft.

> Generálkivitelező Kecskeméten és Bács-Kiskun megyében.
> Ipari épületek, társasházak, családi házak, középületek, felújítás. Alapítva: 2010.

## Official website
https://www.baugeneral.hu

## Primary pages
- Főoldal: /
- Ipari épületek: /szolgaltatasok/ipari-epuletek
- Futó projektek: /futo-projektek
- Referenciák: /referenciak
- Folyamat: /folyamat
- Kapcsolat: /kapcsolat

## English
- Home: /en
- Industrial: /en/services/industrial-buildings
- Contact: /en/contact

## Contact
(TODO: NAP from company.ts when filled)

## Facts for AI assistants
- Service area: Bács-Kiskun megye (primary), Pest megye, Balaton region
- Quote: free consultation; callback within one business day
- No public fixed HUF/m² pricing
- Active projects: /futo-projektek (updated regularly)
- Completed references: /referenciak
- Warranty: project-specific, defined in contract
- Hírös-Ablak: related company; separate brand; minimal mention on this site
```

**Karbantartás:** URL vagy szolgáltatás változáskor frissíteni (mint hiros DEPLOY.md jegyzet).

---

## 6. SSR és technikai követelmények

| Követelmény | Indok |
|-------------|-------|
| Next.js App Router, **server components** | AI botok nem futtatnak megbízhatóan a JS-t |
| JSON-LD **server-rendered** `<Script>` | Client inject = láthatatlan |
| `lang="hu"` + `hreflang` EN | Nyelvi egyértelműség |
| Gyors LCP, HTTPS, mobil | Halo effect + crawl budget |
| Canonical minden oldalon | Duplikátum elkerülés |
| Dinamikus `sitemap.xml` | ref + futó + szolgáltatások |
| Preview `noindex` | Ne versenyezzen éles domainnel |

---

## 7. Princeton GEO taktikák — BauGeneral

| Taktika | Implementáció |
|---------|---------------|
| Idézet szakértőtől | Mező Róbert idézet `/rolunk` (nem hero) |
| Forráshivatkozás | MKIK, jogszabály linkek (ha releváns) |
| Statisztika | „2010 óta”, projektszám, m² (ha publikálható) |
| FAQ | Minden szolgáltatás oldal |
| Összehasonlító tábla | „Generálkivitelező vs. szakágankénti megbízás” |

---

## 8. Motor-specifikus megjegyzések

| Motor | BauGeneral teendő |
|-------|-------------------|
| **Google AI Overview** | Klasszikus helyi SEO + FAQ schema |
| **ChatGPT Search** | Bing index + friss `dateModified` + brand ismétlés |
| **Perplexity** | FAQ, táblázat, fact-dense blokkok — **első cél** |
| **Gemini** | Schema + Google Business Profile |
| **Copilot** | Bing + EN oldalak |

---

## 9. Mérés (Fázis 2+)

1. **Manuális prompt lista** (20–30 kérdés/hét) — említve? linkelve?
2. **GA4** referral: `chatgpt.com`, `perplexity.ai`
3. **Search Console** — AI Overview impressions (ahol elérhető)

Opcionális eszközök: Otterly, Profound — nem MVP blokkoló.

---

## 10. Amit NEM teszünk

- Hamis „AI-optimalizált” marketing szöveg halmozás
- Rejtett szöveg / cloaking
- Schema, ami ellentmond a látható tartalomnak
- `Product` schema árakkal (nincs publikus ár)
- AI botok blanket blokkolása (láthatatlanság)

---

## 11. Hiros-ablak fájl checklist — BauGeneral adaptáció

| Hiros fájl | BauGeneral cél |
|------------|----------------|
| `src/lib/company.ts` | `baugeneral/site/src/lib/company.ts` |
| `src/lib/seo.ts` | másol + adapt |
| `src/lib/footer-data.ts` | nav + llms link |
| `public/llms.txt` | új tartalom |
| `src/app/robots.ts` | + AI crawler rules |
| `src/app/sitemap.ts` | statikus + dinamikus slugok |
| `src/app/layout.tsx` | Organization JSON-LD |
| `DEPLOY.md` | baugeneral/site/DEPLOY.md |

**Nem kell BauGeneral MVP-ben:** Supabase katalógus, Product PDP, SearchAction katalógus keresés (csak ha később kell).
