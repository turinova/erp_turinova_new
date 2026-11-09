# 51 — Webshop fejlesztés szünet (handoff)

**Jegelés:** 2026-11-06  
**Cél:** ideiglenesen megállítjuk a webshop továbbfejlesztését; ez a doc a visszaugráshoz kell.  
**Kapcsolat:** [39](39-webshop-addon.md) · [40](40-storefront-catalog-ai.md) · [41](41-webshop-legal.md) · [50](50-webshop-w1.md)

> **Új webshop UI / Excel / footer / migráció előtt olvasd ezt + a 50-et.** Konfliktusnál a zárolt döntések a 50-ben és a modul-app docsban nyernek.

---

## 0. Hol tartunk (egy mondat)

W1a közel: admin katalógus + Excel import nagy tenantre is, lean kategória/jellemző, storefront lábléc + social beállítás, Hírös-Ablak Hranipex adatfeltöltés Excel-csatornán. **Nincs** Stripe checkout (W1b), nincs kép/PDF tömeges Média feltöltés a feedből.

---

## 1. Mit csináltunk (2026-11 időszak)

### 1.1 Admin — katalógus és törzs

| Tétel | Hol | Megjegyzés |
|---|---|---|
| Gyártó szerinti boltba adás | Dialógus tab + RPC | `webshop_add_preview` / `webshop_add_by_manufacturer`; migráció **`20260923`** |
| Kategóriák / Jellemzők a navban | `/webshop/kategoriak`, `/tulajdonsagok` | Lean create: kategória = név(+szülő); jellemző = név+típus, kód a névből |
| Katalógus kereső RPC | lista + export | **`20260636_search_shop_catalog_page.sql`** |
| Katalógus page `maxDuration` | `katalogus/page.tsx` | 60 s (gyártó chunk loop) |

### 1.2 Shop Excel import / export (kritikus)

| Tétel | Hol | Megjegyzés |
|---|---|---|
| **Scoped context** | `lib/webshop/excel/context.ts` | Nagy tenant (30k+) statement timeout ellen: import/export csak érintett SKU/id + related/group cover; globális `slugOwners`, `categoryCounts` |
| `shopWorkbookScope` | ugyanott | SKU-k a Bolt/Jellemzők/Kapcsolatok/… lapokról; **Tulajdonságok lap** → teljes load (típusváltás `usage`) |
| Callerek | `apply.ts`, `catalog/export/route.ts` | Import: workbook scope; export: `listShopCatalogIds` után `{ ids }` |
| Limit | columns | Spec max 150k; related 60k; termék 10k |

**Ne bontsd vissza** a scoped loadot „mindig minden termék”-re.

### 1.3 Storefront chrome

| Tétel | Hol | Megjegyzés |
|---|---|---|
| Lean → tágas footer | `storefront-chrome.tsx` | Eladó (név, székhely, email, tel) · Vásárlás (szállítás, elállás, panasz) · Social · Fizetés jelek · alsó jogi sáv |
| Social URL-ek | Beállítások → Megjelenés | Migráció **`20260924_webshop_social_urls.sql`**: `social_facebook` … `linkedin` |
| Fizetés jelek | footer | Visa/MC/Apple Pay/Google Pay ha `card`; + átutalás / személyes |

### 1.4 Storefront PDP (korábbi W1 sáv)

Sticky buy bar, variánsok, pack, reviews, telefon eltávolítás a PDP-ról (láblécben / eladónál marad). Lásd [40](40-storefront-catalog-ai.md).

### 1.5 Hírös-Ablak / Hranipex — operatív adat (nem kód)

Tenant: `45dd7c02-28e9-4f4a-b74c-704f63437927` (`hiros-ablak-kft`).

Források (lokális Downloads, nem a repóban):

| Fájl | Szerep |
|---|---|
| `feed.xlsx` | Hranipex feed (leírás, méret, kép/PDF URL) |
| `vasalatmester-xlsx-export-….xlsx` | Shoprenter szöveg / SEO (óvatosan — hibás méretek előfordultak) |
| `termekek_talalat_2026-11-06.xlsx` | ERP termék export (SKU illesztés) |
| `hranipex_bolt_import.xlsx` | Kategória + Live |
| `hranipex_jellemzok_kapcsolatok_import.xlsx` | Jellemzők + Kapcsolatok |
| `hranipex_kategoria_szurok_import.xlsx` | Fő/további jellemzők a kategóriákon (2. lépés) |
| `hranipex_valtozatcsoportok_import.xlsx` | Bolt `Változatcsoport` + csoportok lap |
| `hranipex_tartalom_import.xlsx` | Leírás, márka, MPN, csomag méret/súly, keresőszavak… |

Generátor szkriptek (ephemeral): `/tmp/hranipex_cat/build*.py` — **nincs a gitben**; újrafuttatáshoz a logika a chatből / újraírás.

**Szándékosan kimaradt:** feed képek + PDF tömeges feltöltés a Média könyvtárba (felhasználói „most ne”). ~223 termék kép nélkül → Készül / nem Live.

---

## 2. Migrációk — futtatás állapota

| Migráció | Mit | Éles / remote |
|---|---|---|
| `20260636_search_shop_catalog_page.sql` | Katalógus kereső RPC | Ellenőrizd — lista ha működik, valószínű lefutott |
| `20260923_webshop_add_by_manufacturer.sql` | Gyártó preview/add RPC + index | **Kézzel** SQL Editor, ha a tab hibázik |
| `20260924_webshop_social_urls.sql` | Footer social oszlopok | **Kézzel** — különben social mentés 42703 |

`supabase db push` sok függő migrációt is felnyomhat — pilot alatt inkább SQL Editor egy fájlra.

**Ne futtasd:** `20260552` (kereső v2 archive).

---

## 3. Kulcs fájlok (gyors térkép)

```
modul-app/src/lib/webshop/excel/context.ts   # scoped load — NE bontsd vissza
modul-app/src/lib/webshop/excel/plan.ts      # import terv
modul-app/src/lib/webshop/excel/apply.ts     # planShopImport + apply
modul-app/src/lib/webshop/product-actions.ts # gyártó add + Live
modul-app/src/components/webshop/catalog-add-product-dialog.tsx
modul-app/src/components/storefront/storefront-chrome.tsx  # header + footer
modul-app/src/lib/webshop/settings.ts        # StorefrontSettings + social
modul-app/src/lib/webshop/storefront-actions.ts
modul-app/supabase/migrations/20260923_*.sql
modul-app/supabase/migrations/20260924_*.sql
modul-app/supabase/migrations/20260636_*.sql
```

---

## 4. Zárolt döntések (ehhez a sávhoz)

1. **Shared footer** minden SaaS tenanthoz — nincs tenant HTML footer.  
2. **Excel context scoped** nagy katalógusnál; teljes load csak ha kell (pl. Tulajdonságok lap).  
3. **Live** = aktív + ár + fő kép + cím; leírás/kategória nem Live-blocker ([50](50-webshop-w1.md)).  
4. **Hranipex leírás:** elsődlegesen feed; vasalatmester csak fallback (hibás méretek).  
5. **Social** csak `https://` URL; üres = nincs ikon.  
6. **Kategórialista nincs a footerben** (SEO hub a fejléc / kezdőlap).

---

## 5. Nyitott / következő (amikor visszajössz)

Prioritás javaslat (nem kötelező sorrend):

1. Futtasd a hiányzó migrációkat (`20260923`, `20260924`) az érintett projekten.  
2. **Média pipeline:** feed `url_picture` / additional / `url_doc` → Storage + Termékek Excel `Kep_fajlnev`/`Galeria` + bolt Dokumentumok lap.  
3. **W1b Stripe Connect** + checkout ([50] §6).  
4. Footer: ha kell, social ikonok / kártya SVG finomítás (most szöveges chipek).  
5. Hírös: 211 leírás nélküli SKU, 223 kép nélküli Live-blokkolt.  
6. Commit a jegelés óta nem pusholt footer/social változásoknak (ha még local) — ellenőrizd `git status` `modul-app`-ra.

**Tudatos nem-cél W1-ben:** ACP Instant Checkout, saját domain kötelező, kereső v2 merge.

---

## 6. Visszakapcsolás checklist

- [ ] Olvasd: ez a doc + [50](50-webshop-w1.md) + [40](40-storefront-catalog-ai.md) footer szakasz  
- [ ] `git log` / status: mi ment fel `main`-re a webshopból  
- [ ] Migrációk állapota a remote Supabase-en  
- [ ] Smoke: `/webshop/katalogus` Excel előnézet (scoped), `/bolt` footer, Beállítások → Megjelenés social  
- [ ] Hírös pilot: Live darabszám, kép nélküliek, változatcsoport PDP  

---

## 7. Kapcsolódó chat / artefaktumok

- Cursor agent transcript: webshop PDP → Excel → Hranipex → footer (repo agent-transcripts)  
- Commit példa (korábbi sáv): `eb49972f0` — catalog bulk, lean cat/attr, scoped import  
- **Még nem commitolt (jegeléskor `main` working tree):**  
  - `docs/38`, `39`, `40`, `41`, `50` + új `51`  
  - `storefront-chrome.tsx`, `webshop-settings-client.tsx`, `settings.ts`, `storefront-actions.ts`  
  - `supabase/migrations/20260924_webshop_social_urls.sql`  
  Visszakapcsoláskor: commit + remote migráció, mielőtt social mentést tesztelsz.
