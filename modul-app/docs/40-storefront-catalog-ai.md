# 40 — Storefront katalógus + AI-olvashatóság (F1–F3)

Cél: a vásárló (és az AI ügynök) **egy lépésben** eljusson a pontos alkatrészhez,
és a gép **ugyanazt** lássa, amit az ember. Migráció: `20260543_storefront_catalog.sql`.

## 1. Információs architektúra (minimál)

| Útvonal | Mi | Index |
|---|---|---|
| `/bolt` | H1 = cégnév, kereső, felső kategóriák listája (db-szám, alkategória-sor) | igen |
| `/bolt/k/[slug]` | morzsamenü (utolsó elem → testvér-kategória panel), alkategória chipek, kulcsadat-szűrők linkként, 25/oldal lapozás | igen; szűrve `noindex,follow`, canonical szűrő nélkül |
| `/bolt/kereses?q=` | ékezet- és tokenfüggetlen keresés (név, SKU, EAN, MPN, márka, szín, méret, alias, kategória, kulcsadat érték+egység) | `noindex` |
| `/p/[slug]` | PDP — közös fejléc/lábléc, kattintható morzsamenü, „Kell hozzá”, „Hasonló termékek” | igen |

- Nincs nyitóoldal-hero, banner, végtelen scroll. A fejléc: logó → `/bolt`, kereső ikon (overlay, 8 javaslat, Enter → teljes lista), telefon, e-mail.
- Kategória slug: DB `slug` vagy `slugifyHu(name)`; ütközéskor szülő-előtag, majd id-suffix (`lib/storefront/shell.ts`).
- Szűrők: a kategória **kulcsadat-sablonja** (number/list, max 6). Egy szűrő darabszáma a többi aktív szűrővel számol (saját magát kihagyja).
- Hasonló: azonos kategória, a fő kulcsadathoz legközelebbi érték elöl, variánstestvérek nélkül.

## 2. Gépi réteg (F1)

- JSON-LD `@graph` (`lib/storefront/pdp-jsonld.ts`): `OnlineStore` (`#org`, visszaküldési szabály, kapcsolat),
  `ProductGroup` + `hasVariant` + `variesBy` (minden variánsoldalon ugyanaz), `Product` `itemCondition`,
  `UnitPriceSpecification` (áthúzott ár **csak** az Omnibus 30 napos referenciából, `StrikethroughPrice`;
  mennyiségi árak `eligibleQuantity`-vel), méretek (`depth/width/height/weight`), `category`,
  kép `caption` (alt), `isRelatedTo` (Kell hozzá), `isSimilarTo`, `BreadcrumbList`, `FAQPage`.
- `/bolt`: `WebSite` + `SearchAction`; kategória: `CollectionPage` + `ItemList`.
- `robots.txt`: minden kereső/ajánló bot mehet; **tanító** botok (GPTBot, Google-Extended, CCBot, ClaudeBot, …) tiltva,
  amíg a Webshop beállításokban az „AI modellek taníthatnak” kapcsoló ki van kapcsolva. `/api/`, `/bolt/kereses` tiltva.
- `sitemap.xml` (marketing + bolt + kategóriák + termékek `lastmod`), `llms.txt` (kategóriafa, feedek, kapcsolat).
- ISR: `revalidate = 60` (PDP, `/bolt`); termék mentés → `revalidatePath('/p/<slug>')` + `/bolt` layout.

## 3. Feedek + minőségkapu (F3)

- `/feeds/google.xml` (Merchant RSS, `g:`) és `/feeds/openai.jsonl` (ChatGPT) **közös forrásból** (`lib/storefront/feed.ts`).
- OpenAI mezők: kötelező 9 + `group_id`, `listing_has_variations`, `variant_dict`, `gtin`, `mpn`, `condition`,
  `product_category`, `dimensions`, `weight`, `shipping_price`, `accepts_returns`, `return_deadline_in_days`,
  `return_policy`, `seller_tos`, `seller_privacy_policy`, `review_count`/`star_rating` (csak valós adat).
- MPN **soha nem** SKU-ból generált. Sablon GYIK / „Mire jó” generálás megszűnt (a migráció törli a régieket).
- `sale_price` nincs a feedben — Omnibus referenciaár nélkül nem állítunk kedvezményt.

### AI-készség (`lib/webshop/ai-readiness.ts`)

Ugyanaz a függvény fut a termék űrlapon (panel) és a feedben (kapu).

| Ellenőrzés | Súly |
|---|---|
| fő kép, márka, azonosító (EAN/MPN **vagy** „nincs azonosító” jelölés), kategória, összes kulcsadat | kötelező — hiányában kimarad a feedből |
| név/leírás ↔ fő kulcsadat ütközés (mm/cm/m), ≥2 kép, minden kép leírása, leírás ≥200 kar., mérési ábra, termék méretei | ajánlott |

Admin: termék űrlap → Képek (képenként „Mit mutat a kép?”), Webshop → „Nincs vonalkódja és gyártói cikkszáma”,
„AI-készség” panel, szerkesztéskor „Kell hozzá” szekció (`accessory_related`, max 8, tenant-ellenőrzött).

## 3b. Mobil PDP szerkezet (zárolt)

Forrás: Baymard 2026 PDP benchmark + „Vertically Collapsed Sections”, sticky ATC A/B (GrowthRock, UnfoldCRO).

- **Első képernyő (390×844):** ár + fő gomb látszik görgetés nélkül. Sorrend: fejléc (52, lefelé görgetve elbújik) → „‹ szülő kategória” → galéria `min(88vw,48svh)`, pöttyök (bélyegkép csak `lg`) → márka · H1 20px/600 (max 4 sor) · csillag csak valós értékelésnél → ár → max 3 kulcs-chip (→ `#passzol`) → variáns gombok → **egy** elérhetőségi sor (készlet · kiszállítás · szállítási díj) → mennyiség + fő gomb (48px) → egysoros kockázat-sor (elállás → `#szallitas`, jótállás, „Kérdezz tőlünk”).
- **Egy tény, egy hely:** szín csak a variánsválasztóban, cikkszám csak „Gyártó és biztonság / Termékazonosítók” alatt, szállítás röviden a gomb fölött, részletesen a szekcióban.
- **Szekciók:** minden fő tartalom `PdpSection` (`<details>`, tartalom a DOM-ban), darabszámmal: Leírás (nyitva, 3 soros előnézet + „Tovább olvasom”) · Műszaki adatok (n) · Csomag tartalma · Szállítás és visszaküldés · Értékelések (n) · Gyakori kérdések (n) · Gyártó. Kivétel: „Passzol-e?” és a termék-sínek.
- **Tipográfia:** storefront törzs 15px / 400; egyetlen H2 méret (`SECTION_TITLE`, 17px/600); szekciócím 16px/600; ár 24px/700 `tabular-nums`.
- **Ragadós sáv:** csak ha a fő gomb nincs a képen **és** a lábléc sem; kép + ár + ugyanaz a művelet. Soha két azonos gomb egyszerre.
- **Elfogyott termék:** egy elsődleges „Szólj, ha megérkezik” (`storefront_stock_notify_requests`, admin: Webshop áttekintő lista, „Értesítettem” lezárás); raktáron lévő testvér-variánsra link.
- **Lábléc (mobil):** „Segítünk választani” kapcsolatblokk → összecsukható Kategóriák / Vásárlói információk / Cégadatok → jogi sor. Desktopon 3 oszlop, nyitva.
- **Képek:** fehér hátterű fotó `mix-blend-multiply` a `stone-100` felületen.

## 3c. Címek és csatornák (zárolt)

- **Útvonal:** a middleware (`src/lib/storefront/middleware.ts`) minden boltkérést belső `/s/<tenant slug>/…` útra ír át → az ISR cache boltonként külön kulcsot kap. A `/s/*` kívülről 404. Server action / API: `x-storefront-site` fejléc (a middleware mindig felülírja).
- **Hostok:** `<slug>.<STOREFRONT_ROOT_DOMAIN>` azonnal él (nincs tárolt sor); saját domain a `tenant_domains` táblából (`status=active`). Feloldás: `storefront_resolve_host` RPC (anon), 60 s edge cache. Nem fő hostról 301 a fő címre (a `www.` alias is).
- **Path-mód:** az app hoston `/bolt`, `/p/…`, `/feeds/…`, `/llms.txt` a `STOREFRONT_DEMO_TENANT_SLUG` boltját mutatja; a gyökér robots ezeket tiltja, ha van `STOREFRONT_ROOT_DOMAIN`.
- **Abszolút URL:** mindig `siteUrl(tenant.base, path)` — aktív elsődleges saját domain → aldomain → app URL. Sitemap, robots `Sitemap:`, feedek, JSON-LD, llms.txt, canonical ugyanezt használja. Saját hoston a kezdőlap `/`.
- **IndexNow:** kulcs = HMAC(tenant id), `/indexnow.txt`; termékmentés után `after()`-ben ping (`revalidateStorefrontTenant`), domain-élesítéskor a kezdőlap. Localhoston nem pingel.
- **Saját domain varázsló** (Webshop → Csatornák): 1) domain (normalizálás: protokoll, `www.`, út, port, IDN) → 2) szolgáltató (NS-ből felismerve, választható) + „Így találod meg” → 3) rekordkártyák másolás gombbal, soronkénti állapot, 20 mp-es élő ellenőrzés. Felismert hibák: régi A rekord, CNAME helyett A, Cloudflare proxy, AAAA, „teljes domain a Név mezőben”, CAA tiltás, nem létező domain. Vercel: `addProjectDomain` (apex + `www` 308 redirect), `verify`, `config` ajánlott értékek; HTTPS elérhető → `active` + elsődleges (ha nincs más).
- **Háttér:** `GET /api/cron/storefront-domains` (Bearer `CRON_SECRET`), 10 domain / futás, 4 percnél régebbi ellenőrzés, 7 napig.
- **Nyitott:** e-mail értesítés élesedéskor (nincs levélküldő), Domain Connect (szolgáltatói regisztráció kell), több saját domain / tenant.

## 4. Nyitott (F4)

Kosár / checkout / ACP-UCP, `next/image` a Supabase képekre, `sale_price` referenciaárral, Merchant Center regisztráció.
