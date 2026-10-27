# 44 — Ügyfél rendelés-státusz link (SMS)

**Route:** `/r/[token]` (publikus, noindex)  
**Tábla:** `order_share_links` (`20260613_order_share_links.sql`)  
**Kapcsolat:** [42](42-ugyfelrendeles.md), [37](37-lapszabaszat-quote-workflow.md)

## Cél

Rövid SMS (1 segment) + link: a megrendelő mobilon látja, **mi átvehető**, **mi úton**, **mennyi a most fizetendő**, **hol / hívás**.

## Modell

| Mező | Érték |
|---|---|
| `kind` | `cso` \| `quote` |
| Token | `base64url` ~12 char |
| TTL | 30 nap (küldéskor meghosszabbít) |
| Aktív link | 1 / rendelés (unique partial index) |

Betöltés: service role a Next szerveren (`loadCustomerOrderStatusByToken`) — anon RLS nincs a táblán.

## UI

Lean shell (`CustomerOrderStatusShell`), Square/Stripe ritmus — egy kérdéssor:

1. **Státusz** (badge + rendelésszám; részlegesnél 1 sor magyarázat)
2. **Mi készült el** (+ CSO: „Még úton”, összeg nélkül)
3. **Most fizetendő** (nagy szám)
4. **Átvétel** + **Hívás**

Nincs üdvözlés, progress chip, footer szöveg. Átadva: rövid köszönő + hívás.

Beállítások (`/beallitasok/sms`): sticky **telefon-keret előnézet** (SMS-pillanat sample). Nincs teszt SMS küldés.

## SMS

Default sablonok: `{status_url}`. Generálás: `ensureOrderShareLink` küldés / preview előtt.
