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

- **Első képernyő (390×844):** ár + fő gomb látszik görgetés nélkül. Sorrend: fejléc (52, lefelé görgetve elbújik) → galéria (lebegő „‹ szülő” pill, lásd 3e), pöttyök (bélyegkép csak `lg`) → márka · H1 20px/600 (max 4 sor) · csillag csak valós értékelésnél → ár → max 3 kulcs-chip (→ `#kulcsadatok`) → variáns gombok → **egy** elérhetőségi sor (készlet · kiszállítás · szállítási díj) → mennyiség + fő gomb (48px) → egysoros kockázat-sor (elállás → `#szallitas`, jótállás, „Kérdezz tőlünk”).
- **Egy tény, egy hely:** szín csak a variánsválasztóban, cikkszám csak „Gyártó és biztonság / Termékazonosítók” alatt, szállítás röviden a gomb fölött, részletesen a szekcióban.
- **Szekciók:** minden fő tartalom `PdpSection` (`<details>`, tartalom a DOM-ban), darabszámmal: Leírás (nyitva, 3 soros előnézet + „Tovább olvasom”) · Műszaki adatok (n) · Csomag tartalma · Szállítás és visszaküldés · Értékelések (n) · Gyakori kérdések (n) · Gyártó. Kivétel: „Kulcsadatok” és a termék-sínek.
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

## 3d. Mobil kategória oldal (zárolt)

Forrás: Baymard PLP / mobile filtering, NN/g „Filters vs. facets”, Shopify Dawn + Odoo eCommerce listák.

- **Első képernyő (390×844):** fejléc (52) → egy sor: `‹` (szülő, 44px) + H1 20px + „N termék” → **egyetlen** vízszintes chip-sor (40px, 16px oldalsó margó, jobb szélen elhalványítás): `Szűrés n` · `Rendezés ▾` (natív `<select>` a chip alatt) · aktív szűrők (sötét, ✓ + ✕, koppintásra levesz) · `Raktáron` · az első kulcsadat 4 értéke · alkategóriák. Az első termék ~170px-nél.
- **Kártya:** 2 oszlop, ≤300px magas. Kép (négyzet) · max. 1 igaz címke („Új”: ≤30 nap, csak ha a kategória legfeljebb harmada új) · cím 2 sor · kulcsadat-sor (13px, 1–2 érték, ami a csoport minden tagjára igaz) + „N szín / N változat” · csillag csak valós értékelésnél · ár 16px/600 · **egy** elérhetőségi sor ikonnal (szállítási idő / „Utolsó N db” ≤5 / „Nincs készleten”). `prefetch={false}`; az első kép `fetchpriority="high"`, az első 2 eager.
- **Variánscsoport = egy kártya** (`web_group_id`): a képviselő a szűrőknek megfelelő, raktáron lévő, legolcsóbb tag; a szűrő akkor talál, ha bármely tag megfelel. A darabszámok csoportot számolnak.
- **Rendezés** (`rendezes`): Ajánlott (raktáron elöl, majd név) · Legolcsóbb · Legdrágább · Legújabb · Legjobbra értékelt (csak ha van értékelés). **Szűrők:** kulcsadatok (sablon, max. 6, értékenként 1), `raktaron=1`, `ar-tol` / `ar-ig` (bruttó Ft). Szűrt URL `noindex, follow`, a canonical a tiszta kategória.
- **Szűrő panel (mobil):** alsó sheet 92svh; nyitáskor history-bejegyzés → Android „vissza” bezárja. Rendezés rádiók → Csak raktáron kapcsoló → kulcsadat chipek darabszámmal (0 = halvány, tiltott) → ár (16px, `inputMode=numeric`). Rögzített lábléc: `Törlés` + fő gomb „N termék mutatása” élő darabszámmal (`/api/storefront/category-count`, 250 ms debounce, `aria-live`); 0 találatnál tiltott.
- **Lebegő „Szűrés és rendezés” pill:** csak mobilon, ha a chip-sor kigördült **és** a lista vége / lábléc nem látszik; safe-area fölött. Soha nincs egyszerre két ragadós vezérlő.
- **Lapozás:** „Továbbiak betöltése” (48px) + „24 / 132 termék” sáv; kumulatív `?page=N` (az első N×24, max. 20), görgetés nem ugrik, vissza gombbal ugyanott folytatódik. JS nélkül sima link (`rel=next`). **Nincs végtelen görgetés.**
- **Oldalméret 24** (az admin listák 25-ös alapértéke helyett): 2/3/4 oszlopban mindig teli sor.
- **Üres állapot:** az a szűrő, amelynek elhagyása a legtöbb terméket hozza, fő gombként („„X” elhagyása”) + „Összes …”.
- **Segítő kártya:** a 8. termék után (ha >12 és van telefon/e-mail): „Nem biztos, melyik kell?” → hívás / levél.
- **Desktop (`lg`):** morzsamenü, H1 + rendezés jobbra; 240px oldalsáv azonnali (link) szűrőkkel, darabszámmal; ár űrlap GET-tel; 3–4 oszlop; nincs pill.

## 3e. Általános PDP váz + shell (zárolt)

Kategóriafüggetlen: kutyatáptól a samponig ugyanaz a váz; ami üres, az nem jelenik meg (nincs „nincs adat” sor). A 3b ezt pontosítja.

- **Sorrend (390×844):** galéria `min(80vw,40svh)` (álló képnél `min(100vw,46svh)`), bal felső sarkában lebegő „‹ szülő kategória” pill (nincs külön vissza-sor) → márka · H1 · csillag csak valós értékelésnél → ár 24px + nettó tartalom · egységár → „Az ár tartalmazza a X% áfát” (vagy `show_net_price`: „nettó … + X% áfa”) → max. 3 kulcs-chip (→ `#kulcsadatok`) → variánsok → **egy** elérhetőségi sor (készlet · kiszállítás · szállítási díj · átvétel; hiányzó elem kimarad) → várható érkezés (csak elfogyott + nyitott beszerzés `expected_date`) → mennyiség + fő gomb → elfogyottnál alternatíva-kártya (raktáron lévő kézi alternatíva, testvér, különben hasonló) → kockázat-sor → „Forgalmazza: név · város · telefon”.
- **Egységár** (`web_net_quantity` + `web_net_unit`: g, kg, ml, l, db, m, m²): „3 725 Ft/l” (g/ml → kg/l bázis); PDP, kártya, sín, kereső, variáns-gomb; Google feed `unit_pricing_measure` / `_base_measure`. 1 db-nál nincs.
- **Kiszerelés tengely** (`__pack`, „Kiszerelés”): ha a csoport tagjainak nettó tartalma eltér. Variáns-gomb: címke + (eltérő) ár + egységár; elfogyott = szaggatott keret + „Elfogyott” felirat (nincs áthúzás); színminta alatt név.
- **Képarány** boltonként: `image_aspect` `square` | `portrait` (4:5) — galéria és kártyák.
- **Szekciók:** Leírás · Összetevők · Használat · Jellemzők · Csomag tartalma · Dokumentumok · Videó (kattintásra töltődő YouTube) · Szállítás és visszaküldés · Értékelések (csak ha van) · GYIK · Gyártó és biztonság (Figyelmeztetés). 0 értékelés = egy sor a lap alján („Írd meg a véleményed”).
- **Kosár (F4 előtt):** `localStorage` (`bolt-kosar-v1`), „Kosárba · összeg” → toast jobb alul „Kosár” akcióval; fejlécben kosár ikon darabszámmal; `/bolt/kosar` (noindex): sorok, mennyiség, sávos ár, részösszeg, szállítás, „még X Ft az ingyenes szállításig”, fő gomb „Rendelés elküldése e-mailben” (tételes levél), telefonos tartalék, ürítés megerősítéssel (fókusz: Mégse).
- **Shell:** mobil kategóriamenü (teljes képernyős, lefúrható, darabszámmal); kereső üres állapot: legutóbbi 6 keresés + népszerű főkategóriák; „Nemrég megnézted” sín (PDP, üres kosár; ≥2 elemtől).
- **Admin „Termékoldal-minőség”** az AI-készség mellett: ≥3 kép, leírás, fő előnyök, kulcsadatok, GYIK; fogyasztási cikknél (Google 412/469/1/630 vagy kategórianév) nettó tartalom, használat, figyelmeztetés; élelmiszer / kozmetikum / eledel: összetevők.
- **Később:** rendszeres szállítás (előfizetés), online fizetés.

## 3f. Termékszintű AI-adatok (zárolt)

Minden kategóriában használható mezők — kategóriaspecifikus adat a kulcsadat-sablonba megy, nem ide. Migráció: `20260547_product_origin_bundle_docs.sql`.

- **Mezők:** `web_country_of_origin` (ISO alpha-2), `web_multipack` (2–10000; nettó tartalom nélkül ez az egységár alapja: „6 db-os csomag · 450 Ft/db”), `web_is_bundle` (szöveges „Csomagajánlat” címke, a „Csomag tartalma” nyitva). Videó: **csak YouTube link**, nem tárolunk videót (DB check).
- **Kapcsolatok** (`accessory_related.kind`, termékenként típusonként max. 8, egy pár csak egy típusban): `required` „Kell hozzá” (gomb alatti sín) · `accessory` „Tartozékok” (alsó sín) · `alternative` „Helyette ezt is ajánljuk” — **kölcsönös** (a visszairány automatikus), elfogyáskor az alternatíva-kártya elsőként ezt ajánlja · `larger_pack` „Nagyobb kiszerelés” — csak kézi, egyirányú; a vevőgomb fölött sor ár + egységárral. A „Hasonló” sín a kézi kapcsolatokat kihagyja.
- **Dokumentumok** (`accessory_documents` → `media_files`): PDF a közös médiatárban (10 MB, képek 2 MB), típus (útmutató, biztonsági adatlap, megfelelőségi nyilatkozat, műszaki adatlap, jótállás, tanúsítvány, egyéb), cím, nyelv, sorrend; termékenként max. 20. PDP: „Dokumentumok (n)” szekció. Médiatár: Összes / Képek / Dokumentumok szűrő (`?tipus=`), legutóbbi 200; a képválasztó csak képet, a Kep_fajlnev és az összekapcsolás csak képet lát.
- **JSON-LD:** `referenceQuantity` (egységár) · elfogyott + várható érkezés → `BackOrder` + `availabilityStarts` · `countryOfOrigin` · `additionalProperty`: nettó tartalom, kiszerelés, csomagajánlat, összetevők, használat, figyelmeztetés · `subjectOf`: méretrajz („méretek”), `VideoObject` (YouTube embed + thumbnail, `uploadDate` nélkül), `DigitalDocument` (PDF, `inLanguage`) · `isRelatedTo` (kell hozzá + tartozék + nagyobb kiszerelés), `isAccessoryOrSparePartFor` (fordított irány), `isSimilarTo` (alternatíva elöl, majd hasonló) · variáns-testvérek: `sku`, `gtin`, tengelyérték (color/size/material/pattern); ProductGroup: `url`, `description`.
- **Google feed:** `backorder` + `availability_date`, `shipping_length/width/height`, `multipack`, `is_bundle`, `product_highlight` (fő előnyök, ≤10 × 150 kar.), `product_detail` (strukturált jellemzők + szabad specifikáció + nettó tartalom, ≤30).
- **OpenAI feed:** `is_eligible_search` / `is_eligible_checkout`, `backorder` + `availability_date`, `dimensions` / `weight` string értékkel, `star_rating` 2 tizedes. Kapcsolódó termék, videó, figyelmeztetés a spec szerint nem küldhető.
- **Skálázás:** a feed és a médiakeresések 1000 soronként lapoznak (PostgREST `max_rows`), a várható érkezés tömegesen, darabolt `.in()`-nel töltődik; a médiaválasztó szerveroldalon keres (max. 200).

## 3g. Modul-elválasztás (zárolt)

A bolt adatai az `accessory_web` táblában, a storefront a `storefront_products` nézetet olvassa (részletek: [39 §4](39-webshop-addon.md)). Az alap termékoldalon csak az „Online bolt” kártya marad; minden itt leírt mező a `/webshop/katalogus/[id]` szerkesztőben van. Import/export: külön munkafüzet a Termékek oldalon (alap) és a Bolt katalógusban (bolt adatok) — [39 §4a](39-webshop-addon.md).

## 4. Nyitott (F4)

Checkout / online fizetés / ACP-UCP, `next/image` a Supabase képekre, `sale_price` referenciaárral, Merchant Center regisztráció.
