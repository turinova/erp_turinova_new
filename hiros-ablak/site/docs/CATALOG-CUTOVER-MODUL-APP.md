# Bútorlap + munkalap átállás → modul-app tenant

Cél: a `www.hirosablak.hu/butorlap` és `/munkalap` a modul-app DB Hírös
tenantjából (`hiros-ablak-kft` / `45dd7c02-…`) olvasson. Ár továbbra sincs a weblapon.

Te futtatod a SQL-eket manuálisan. A kód (migráció fájlok, weblap env minta,
modul-app űrlap mezők) már a repóban van.

## Lépés 1 — Séma + view (modul-app Supabase SQL editor)

Fájl: `modul-app/supabase/migrations/20261030_public_catalog_views.sql`

Mit csinál:

- `slug` + `indexable_on_site` a `sheet_materials` és `linear_materials` táblákon
- unique index slugra
- `public_butorlap` / `public_munkalap` view (csak Hírös tenant, **ár nélkül**)
- `GRANT SELECT` anon + authenticated

Ellenőrzés utána:

```sql
select count(*) from public.public_butorlap;
select count(*) from public.public_munkalap;
-- várhatóan ~0 slug nélkül is jönnek a sorok; slug a 2. lépés után lesz hasznos
```

## Lépés 2 — Slug + indexelés import

Fájl: `modul-app/supabase/migrations/20261030b_public_catalog_slug_import.sql`

Nagy fájl (~200 KB). A SQL editorba másold be / futtasd. A végén van ellenőrző SELECT.

Várható: sheet ~850+ indexable, linear ~680+ indexable, mindkettőn slug kitöltve.

## Lépés 3 — Hírös Ablak env (először Preview)

Vercel → hiros-ablak projekt → Environment Variables (Preview):

- `NEXT_PUBLIC_SUPABASE_URL` = `https://bcfsplmetuziczzxgsix.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a modul-app anon key (ugyanaz, mint a modul-app Verceljén)

Deploy preview, ellenőrizd:

- `/butorlap` lista + kép
- egy ismert slug PDP (pl. régi URL)
- `/munkalap` + típus chip (Munkalap / Asztallap / Hátfal)
- Network: a view válaszában **nincs** `price` / `price_net`
- sitemap: indexable sorok

Lokálisan: `hiros-ablak/site/.env.local` ugyanerre a URL/key-re.

## Lépés 4 — Production env csere

Ugyanaz a két env Production-ön → redeploy.

Rollback: env vissza a régi `xgkavi…` projektre (amíg az él).

## Lépés 5 — Karbantartás a modul-appban

Táblás / szálas anyag szerkesztőn:

- **Weblap slug**
- **Indexelhető a weblapon**
- Előnézet link a hirosablak.hu-ra

Új anyag alapból nem indexelhető, amíg be nem kapcsolod.

## OpenAI feed

Külön fázis — csak miután a weblap már a modul-app tenantot szolgálja.
