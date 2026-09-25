# 39 — Webshop add-on (B2C online bolt)

**Státusz:** P0 + PDP preview (fázis B); Stripe/checkout P1  
**Key:** `webshop`  
**Ár:** **12 900 Ft** nettó/hó  
**Migráció:** `20260536_webshop_addon.sql` (+ mezők: `20260535_accessory_webshop.sql`; taxonomy: `20260537`; no-default-attrs: `20260538`; auto-enrich: `20260539`)  
**Kapcsolat:** [33](33-packages-and-addons.md), [38](38-agent-commerce.md)

---

## 0. Egy mondat

> Az Alap plan = ERP termék + POS. A **Webshop add-on** = B2C csatorna (kategória/attr törzs, shop-ready, később PDP + Stripe). Platform kapcsolja.

---

## 1. Mit nyit

| Route | Job |
|---|---|
| `/webshop` | Áttekintés — shop-ready számok |
| `/webshop/katalogus` | Bolt katalógus (sellable_web / hiányos) |
| `/webshop/kategoriak` | Bolt kategória-fa |
| `/webshop/tulajdonsagok` | Műszaki adatok (szín, nyílásszög… egyenrangú) |
| `/webshop/ertekelesek` | Értékelés moderálás (függő / jóváhagyott / elutasított, eladói válasz), 25/oldal |
| `/webshop/beallitasok` | Bolt beállítások: szállítási díj, ingyenes küszöb, átfutás, átvétel, visszaküldés, garancia, alacsony készlet küszöb, eladott db / értékelések kapcsoló |

Mindkét új route a `/webshop` page_access kulcs alá esik (leghosszabb egyezés) — nincs külön jog migráció.

**Termék form** (`/torzsadatok/.../termekek`): Webshop accordion **csak ha entitled**.

**Nem** P0: Stripe checkout, domain CNAME, feed export UI, variáns család.

**Publikus PDP (fázis B):** `/p/[slug]` — anon, service-role olvasás. Dev tenant: `STOREFRONT_DEMO_TENANT_SLUG` (default `demo`) vagy `STOREFRONT_DEMO_TENANT_ID`. Mentett `web_slug` + `sellable_web` + `active` kell.

---

## 2. Entitlement

Features: `webshop`, `/webshop`, `/webshop/katalogus`, `/webshop/kategoriak`, `/webshop/tulajdonsagok`.

Enable → `grantWebshopPageAccess` + `seed_webshop_defaults_for_tenant`.  
Disable → `sellable_web = false` minden alive terméken (adat megmarad); nav eltűnik.

---

## 3. Táblák

| Tábla | Szerep |
|---|---|
| `web_categories` | Bolt kategória-fa |
| `product_attributes` | Globális jellemző (`code`: color/size/material → Google feed) |
| `attribute_values` | Controlled értéklista |
| `accessory_web` | Termék bolt adatai (1:1, PK = `accessory_id`), benne `web_category_id` — lásd §4 |
| `accessory_attribute_values` | Termék ↔ érték M2M |
| `image_url` + `web_gallery` | Fő + galéria — termék **Képek** szekció (nem web accordion) |

**Google taxonomy:** kurált HU név → ID (`lib/webshop/google-taxonomy.ts`). Seed + mentés auto-kitölti; UI kereshető picker. Migráció: `20260537_webshop_category_taxonomy.sql`.

**Műszaki adatok:** üres alap — a tenant maga veszi fel. Nincs seedelt Szín/Méret/Anyag. Opcionális `color`/`size`/`material` kód → Google feed denorm.  

**Bolt szerkesztő:** `/webshop/katalogus/[id]` — lásd §4.  

**PDP trust (migráció `20260540_storefront_pdp_trust.sql`):** `tenant_webshop_settings` + szállítás/átvétel/visszaküldés/garancia/`low_stock_threshold`/`show_sold_count`/`reviews_enabled`; `accessories.web_box_contents`, `web_dimension_image_url`, `web_price_tiers` (`[{min_qty, price_net}]`); `product_reviews` (moderált, RLS); RPC `storefront_sold_quantity`, `storefront_bought_together` (service_role). Termék űrlap „Még több” → „Termékoldal: méretek, passzol-e, csomag, mennyiségi ár”.

**Kulcsadatok — „Passzol-e?” (migráció `20260541_webshop_key_specs.sql`):**

| Elem | Szabály |
|---|---|
| `product_attributes.value_type` | `list` / `number` / `range` / `boolean`; `unit` rögzített (mm, kg, °…), nincs átváltás; `measure_hint` = „Hogyan mérd le?”; `allow_multiple` listánál. Típus csak addig váltható, amíg nincs terméken érték. |
| `accessory_attribute_inputs` | Nem listás érték (szám, tartomány min–max, igen/nem). Lista marad `accessory_attribute_values`. |
| `web_category_attributes` | Kategória sablon: `key` (max 4 → PDP kártya; az első = fő adat) / `spec` (ajánlott). Üres = legközelebbi ős sablonja (öröklés, ciklusvédett). |
| `web_categories.measure_image_url` | Kategória mérési ábra; termék `web_dimension_image_url` felülírja. |
| Törlés | Kategória alkategóriával nem törölhető; jellemző törlése a sablonból és a termékekről is kiveszi. Szülő nem lehet saját leszármazott. |

Admin: **Bolt kategóriák → Kulcsadatok** (sorrend, szerep, mérési ábra, sablonjavaslat: Fogantyú / Zsanér / Fiókcsúszó / Polc / Bútorláb — nem seed, csak kattintásra; meglévő kódot újrahasznál). **Jellemzők** (korábban „Műszaki adatok”): típus, egység, tipp, szerkesztés. **Termék űrlap**: kategória után a kulcsadat-mezők (x/y kitöltve), ajánlott adatok, többi a „További jellemzők” alatt. Névből javaslat csak ha pontosan egy azonos egységű szám van — „Átveszem” gombbal, nem csendben.

PDP „Műszaki adatok” = strukturált adatok + szabad `web_specs` + termék nettó méret (ha kézzel megadva), név szerint duplikáció-szűrve, kulcsadat nélkül. JSON-LD `additionalProperty` + `unitCode`.

**Auto-enrich tiltások:** a termék nettó mérete **nem** töltődik a csomag alapértékből; a szövegből nincs általános „Méret” / „Teherbírás” kiolvasás (a 20260541 migráció nullázza a korábban így másolt termékméreteket).

**Jogi minimum (migráció `20260542_storefront_legal.sql`):**

| Elem | Szabály |
|---|---|
| `tenant_webshop_settings` | `hosting_provider_name/address/email`, `terms_url`, `privacy_url`, `complaint_info` — Bolt beállítások → „Jogi adatok (lábléc)”. Cégadat (székhely, adószám, cégjegyzékszám, e-mail, telefon) a Cégadatokból. |
| `manufacturers` | GPSR: `legal_name`, `postal_address`, `email`, `website`, `eu_rep_name/address/email`. Gyártók lista jelzi, ha hiányzik cím vagy elérhetőség. |
| `accessories.web_safety_info` | Figyelmeztetés magyarul (≤2000) — termék űrlap „Még több”. |
| `accessory_price_history` | Trigger `price_net` változásra; kiinduló sor = mai ár (nincs visszamenőleges akció). `storefront_reference_price` = az aktuális ár előtti 30 napban érvényes árak minimuma. |
| Takarítás | Törli a régi auto „Méret” / „Teherbírás” `web_specs` kulcsot, ha az érték szó szerint a névből / leírásból jött. |

**Auto-enrich (mentéskor, üres mezőkre):** kereső alias (név+kategória), specs parse a leírásból, kategória FAQ sablon, use-case, MPN←SKU, csomag default (`tenant_webshop_settings`). Migráció: `20260539_webshop_auto_enrich.sql`.

---

## 4. Elválasztás az Alaptól (zárolt, migráció `20260548_accessory_web_split.sql`)

A webshop ki-be kapcsolható modul: az alap termék nem tud róla, csak egy kártyát mutat.

| Alap (Törzsadatok → Termékek) | Webshop modul |
|---|---|
| `accessories`: név, gyártó, SKU, vonalkód, ár, adó, egység, aktív, `sellable_pos`, `image_url`, `web_gallery` (Képek kártya — a név történeti) | `accessory_web` (1:1): `sellable_web`, `web_slug`, kategória, leírások, kulcsadatok, méretek, kiszerelés, összetétel, videó, képleírások (`web_image_alts`), változatcsoport |
| Űrlap: Azonosítás · Árazás · Képek · Készlet · **Online bolt kártya** (csak ha a modul be van kapcsolva) | `/webshop/katalogus` munkalista + `/webshop/katalogus/[id]` szerkesztő |
| Mentés csak alap mezőket ír | Saját mentés (`saveShopProduct`), kiegészítés + attribútumok itt |
| — | `accessory_attribute_values/inputs`, `accessory_related`, `accessory_documents` szerkesztése |

- **Olvasás a boltban:** `storefront_products` nézet (`security_invoker`) = `accessories` alap oszlopai + `accessory_web` (inner join, csak akinek van bolt sora). A storefront, feed, sitemap, kereső és „Passzol-e?” mind ezt olvassa. Az `accessories.web_*` oszlopok elavultak (még nem törölve — takarító migráció később).
- **Online bolt kártya:** kapcsoló (azonnal ment, `setShopAvailability`), szöveges állapot, „Bolt adatok szerkesztése” link. Új terméknél: „Mentés után kapcsolható be.” Ha hiányzik valami, a kártya felsorolja és a szerkesztőbe visz.
- **Bekapcsolás feltétele** (`shopRequirementIssues`): fő kép, ár > 0, aktív, kategória, leírás ≥ 200 karakter (az eleje ≥ 80 → rövid szöveg). Hiányzó webcím automatikusan, egyedien képződik (`nev`, `nev-2`…).
- **Szerkesztő:** fent alap összefoglaló (csak olvasható, link az alapadatokhoz) + kapcsoló + **Teendők** (max. 5, kötelező előbb; kattintásra lenyitja és odagörget; kép/ár/aktív → alapadatok). Pontszámok a „Részletek” alatt. 10 lenyíló csoport, mindegyik egysoros összefoglalóval és szöveges állapottal (Kész / n teendő / Nem kötelező / Azonnal mentődik): Alapok · Kulcsadatok és jellemzők · Amit a vásárló kérdez · Kiszerelés és mennyiségi ár · Méretek és szállítás · Összetétel, eredet, biztonság · Képleírás, videó, dokumentumok · Kapcsolódó termékek · Változatok · Haladó. Mélylink: `#csoport-<id>`. Mentés: egyetlen elsődleges gomb a ragadós alsó sávban (Elvetés csak változáskor), kilépéskor figyelmeztet.
- **Beviteli elemek:** listák soronként (Enter = új sor, vessző az elem része marad), mennyiségi ár darabtól + ár párokban, méretrajz a médiatárból, változatcsoport testvér termék kereséssel. Szövegmezők legfeljebb 2 oszlopban.
- **Munkalista:** URL szűrők `?filter=` `in_shop` · `incomplete` (kint van, de nem „Kész a boltra”) · `not_in_shop` · `no_category` · `no_description` · `no_image`, `?q=`, `?page=` (25/oldal), darabszám szűrőnként, soronként „Következő lépés” mélylinkkel, tömeges „Kiteszem a boltba” / „Leveszem a boltból” (max. 100; ami nem tehető ki, listázva). Az állapotot szerveroldalon számoljuk minden termékre (max. 20 000), a kliens csak az oldalt kapja.
- **Kategória darabszám** a boltban: RPC `storefront_category_counts` (nem sorokból).

Egy termékigazság: **nincs** második termék-CRUD.

### 4a. Bolt import / export (Bolt katalógus, migráció `20260549_webshop_bulk_import.sql`)

Két külön munkafüzet: a **Termékek** oldalé (név, ár, raktár, kép — változatlan) és a **Bolt katalógusé**. A bolt fájl **nem hoz létre terméket**, csak SKU alapján meglévőt egészít ki — kategóriát, jellemzőt, értéket, változatcsoportot viszont igen (döntés után). Kód: `src/lib/webshop/excel/*`, API: `/api/webshop/catalog/export` + `/api/webshop/catalog/import/{upload-url,preview,start,step,cancel,report,backup,runs,undo,problems}`. Terheléses teszt (DB nélkül): `npx tsx scripts/bench-shop-import.ts 10000`.

- **Lapok:** Útmutató · Bolt · Jellemzők (SKU, Jellemző, Érték) · GYIK · Kapcsolatok (SKU, Típus, Kapcsolódó SKU; max. 8 / típus; az Alternatíva kölcsönös) · Dokumentumok (SKU, Fájlnév a Médiából, Típus, Cím, Nyelv; max. 20 / termék) · Változatcsoportok (kód, név, fő termék SKU, választók sorrendben, max. 3, `Kiszerelés` is lehet) · Kategóriák (útvonal, aktív, Google kategória, kulcsadatok) · Tulajdonságok (név, típus, egység, több érték, választó) · Jellemzők súgó · rejtett Listák / Adatok. Letöltéskor a lapok választhatók (Egyszerű / Teljes / üres sablon + jelölőnégyzetek); a letöltés a mostani szűrést követi.
- **Méret:** 10 000 termék / 150 000 jellemzősor / 30 000 GYIK / 60 000 kapcsolat és dokumentum sor, 40 MB. A fájl a böngészőből **közvetlenül Storage-ba** megy (`tenant-imports`, aláírt feltöltési URL) — a Vercel 4,5 MB kéréskorlátja nem számít. Mért (10 000 termék, minden lap): export ~2,5 mp, olvasás ~1 mp, terv ~2 mp.
- **Előnézet:** semmit nem ír. Darabszám szűrőnként (Mind / Változik / Kikerül / Nem kerül ki / Hibás / Változatlan); nagy fájlnál szűrőnként az első tételek látszanak, a teljes lista a „Teljes jelentés” xlsx-ben. Dátummá alakított cella (pl. `1/2`) → hiba: „állítsd a cellát Szöveg formátumra”.
- **Döntések** (nem létező kategória / listaérték / jellemző): soronként választó — Kihagyom (alap) · Javaslat (legközelebbi elírás) · Meglévő választása (max. 8 hasonló) · Létrehozom újként; tömeges gombok. A döntéseket az „Ellenőrzés” újraszámolja, addig a mentés tiltva. Ismeretlen jellemző létrehozásakor a típust az értékekből következtetjük (szám + közös egység, igen/nem, lista; `|` → több érték). A választásokat megjegyezzük (`webshop_import_mappings`) — a következő fájlnál előre kitöltve („Megjegyzett”). **Magától semmit nem hozunk létre.**
- **Mentés:** „N termék mentése” (egy elsődleges gomb). Előtte a rendszer elmenti a fájlban szereplő termékek mostani állapotát (visszaállító fájl), és felvesz egy futást (`webshop_import_runs`; egyszerre egy futhat, 10 perc tétlenség után feloldódik). Utána lépésekben ír (lépésenként ≤ 3000 termék / 200 mp, RPC `webshop_import_apply` 100-as csomagokban, hibánál soronként) — folyamatjelző, újrapróbálás hálózati hibánál, bezárás elleni figyelmeztetés. Megszakadt futás a következő megnyitáskor folytatható („Folytatom” / „Lezárom így”); a már megírt termékek változatlanként jönnek ki, nincs dupla írás.
- **Visszavonás:** az eredmény nézetben és a „Korábbi mentések” listában (utolsó 8). A mentés előtti állapotot pontos módban (`Mód = pillanatkep`) tölti vissza: üres cella = törlés, a lapokon nem szereplő jellemző / GYIK / kapcsolat / dokumentum törlődik. A közben létrehozott kategóriák, jellemzők, értékek **megmaradnak** (máshol is használhatók); a visszavont futás „Visszavonva” lesz.
- **Szabályok:** üres cella = nem változik; `-` = törlés; hiányzó oszlop = nem változik; lista `|` vagy cellán belüli sortörés; igen/nem/i/n/x. `Elérhető a boltban`: igen = kitesszük, ha `shopRequirementIssues` üres (különben az adat mentődik, a termék nem kerül ki), nem = levesszük, üres = marad. Mennyiségi ár **bruttóban**, listaár bruttó. Szám mértékegységgel akkor jó, ha az egység egyezik; nincs csendes átváltás.
- **Hivatkozások:** kategória útvonallal (`Konyha > Zsanérok`) vagy egyedi névvel, ékezet/kisbetű nem számít; hiányzó szülők is létrejönnek (szintenként). Kapcsolt termék és dokumentum SKU / médiafájlnév alapján; ismeretlen → hiba az adott sorra.
- **Változatok:** a Változatcsoport kód köti össze a termékeket; a Változatcsoportok lapon név, fő termék (tagnak kell lennie) és a választók sorrendje adható meg. A bolt ezt használja: a termékoldal választói ebben a sorrendben (ha nincs megadva: automatikus), a kategórialistán a csoport kártyája a fő termék, ha raktáron van. Figyelmeztetés: egyedül van, eltérő kategória, nem különböztethető meg, hiányzó választó érték — nem blokkol.
- **Egyéb edge:** duplikált SKU a fájlban → mindkét sor kimarad; ismeretlen / törölt SKU → kimarad; a letöltés óta más módosította → figyelmeztetés; foglalt webcím → `-2` utótag; kint lévő termék webcím-váltása → „régi link megszűnik”; kint lévő termék, amit a változás hiányossá tenne → lekerül. Ugyanaz a termékpár csak egy kapcsolattípusban lehet (másik típusba átkerül, jelezzük). Régi `.xls` → „mentsd .xlsx-ként”; az alap Termékek fájlt felismeri és visszairányít. „Hibás sorok letöltése” = minden lap hibás sorai + „Mi a baj?” oszlop, visszatölthető.
- **Nem része:** beszállítói feed (XML/CSV URL) import — külön funkció lesz.

---

## 5. Edge (rövid)

- Addon off + URL → nincs hozzáférés  
- Addon disable → publish freeze (`sellable_web=false`)  
- Kategória törlés ha van termék → soft-delete / tiltás UI  
- Ár/kép/vonalkód az alaptermékből — nem duplikált input  

Részletes edge lista: chat spec / [38](38-agent-commerce.md).

---

## 6. P1+

Stripe Connect checkout, domain, variáns template — [38](38-agent-commerce.md) fázis C–F. PDP B kész (`/p/[slug]`).
Katalógus (`/bolt`), kereső, feedek, AI-készség kapu: [40](40-storefront-catalog-ai.md).
