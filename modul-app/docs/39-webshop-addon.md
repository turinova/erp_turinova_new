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
| `accessories.web_category_id` | FK kategóriára |
| `accessory_attribute_values` | Termék ↔ érték M2M |
| `image_url` + `web_gallery` | Fő + galéria — termék **Képek** szekció (nem web accordion) |

**Google taxonomy:** kurált HU név → ID (`lib/webshop/google-taxonomy.ts`). Seed + mentés auto-kitölti; UI kereshető picker. Migráció: `20260537_webshop_category_taxonomy.sql`.

**Műszaki adatok:** üres alap — a tenant maga veszi fel. Nincs seedelt Szín/Méret/Anyag. Opcionális `color`/`size`/`material` kód → Google feed denorm.  

**Webshop űrlap (lean):** kapcsoló → kategória → egy leírás → (műszaki ha van) → „Még több”.  

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

## 4. Elválasztás az Alaptól

| Alap | Webshop add-on |
|---|---|
| Termékek, ár, stock, POS | Bolt menü + publish mezők UI |
| `sellable_pos` | `sellable_web` + shop-ready |
| — | Kategória / attr törzs |

Egy termékigazság: **nincs** második termék-CRUD.

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
