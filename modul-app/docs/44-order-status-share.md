# 44 — Ügyfél rendelés-státusz link (SMS)

**Route:** `/r/[token]` (publikus, noindex)  
**Tábla:** `order_share_links` (`20260613_order_share_links.sql`)  
**Kapcsolat:** [42](42-ugyfelrendeles.md), [37](37-lapszabaszat-quote-workflow.md)

## Cél

Rövid SMS (1 segment) + link: a megrendelő mobilon látja, **mi átvehető**, **mennyi a most fizetendő**, **hol / hívás / navigáció**.

## Modell

| Mező | Érték |
|---|---|
| `kind` | `cso` \| `quote` |
| Token | `base64url` ~12 char |
| TTL | 30 nap (küldéskor meghosszabbít) |
| Aktív link | 1 / rendelés (unique partial index) |

Betöltés: service role a Next szerveren (`loadCustomerOrderStatusByToken`) — anon RLS nincs a táblán.

Abszolút URL: `appOrigin()` — `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_APP_ORIGIN` → `VERCEL_URL` → localhost. **Prod:** állítsd `NEXT_PUBLIC_APP_URL`-t.

## UI

Lean shell (`CustomerOrderStatusShell`):

1. Brand (logo **vagy** cégnév, középen)
2. **Status hero** — soft tone panel, nagy ikon (✓ / ! / óra), nagy cím („Kész, átvehető”), rendelésszám; success/warning ünnepélyesebb
3. **Mi készült el / Átvehető most**
   - CSO: kész tételek (név wrap, db, **egységár + sorösszeg**) + „Még úton” (ár nélkül); „Összesen N tétel” ha ≥2 kész; „Most fizetendő” = kész − előleg
   - Lapszab: anyagonként **panel db** (nem m² / tábla); élzárás: `8 db · élzárás`; „Összesen N db” csak ≥2 anyagnál
4. **Most fizetendő** (CSO: rövid hint — előleg / csak kész)
5. **Átvétel** — cím + **Hívás** (primary) + **Google Maps / Waze** ikon gombok (csak ha van cím)

Nincs üdvözlés, progress chip, beágyazott térkép.

Beállítások (`/beallitasok/sms`): sticky telefon-keret előnézet. Nincs teszt SMS.

## SMS

Default sablonok: `{status_url}`. Generálás: `ensureOrderShareLink` küldés / preview előtt.
