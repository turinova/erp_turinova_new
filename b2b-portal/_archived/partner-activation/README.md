# Partnerek aktiválása (archiválva)

**Archiválva:** 2026-08-28  
**Indok:** Merchant oldal nem kell — induló partner email / checklist feature visszavonva.

## Eredeti route

- `/partnerek-aktivalasa` — merchant UI
- `/api/merchant/partner-activation` — GET/PATCH

## Fájlok

| Mappa | Tartalom |
|-------|----------|
| `page/` | Next.js page |
| `api/` | API route |
| `components/` | `PartnerActivationView.tsx` |
| `lib/` | activation types, email builder, data layer, schema ensure |
| `sql/` | `035_marketing_profile.sql` |

## DB

Ha már lefutott a `035_marketing_profile.sql`, a `shops.marketing_profile` oszlop megmarad — nem használja az app. Nem kötelező droppolni.

## Visszaállítás

1. Másold vissza a fájlokat az eredeti `src/` és `sql/` helyekre.
2. Add hozzá a nav-et (`MerchantShell`), middleware-t, overview setup lépést.
3. Futtasd az ensure / 035 SQL-t, ha még nincs oszlop.
