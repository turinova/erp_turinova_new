# 28 — Értékesítés workflow (Sale)

**Státusz:** S1 + S1.5 + billing/díjbekérő UX.  
**Route:** `/ertekesitesek`  
**Migráció:** `20260509` … **`20260528_sale_confirmed_fulfill.sql`**  
**Kapcsolat:** [36](36-szamlazas-workflow.md)

---

## 0. Egy mondat

> Értékesítés = tételek + fizetés + (külön) áruátadás. Utalásnál számlázás kötelező → díjbekérő. Készlet csak teljesítéskor (kivéve „Áru átadva most” / KP).

---

## Boldog utak

| Út | Eredmény |
|---|---|
| KP / kártya | `fulfilled` + paid + stock → opcionális számla |
| Utalás (default) | `confirmed` + unpaid, **nincs** stock → számlázás panel auto → díjbekérő |
| Utalás + áru most | `fulfilled` + unpaid + stock → díjbekérő |
| Fizetés + dijbekérő + confirmed | Áru átadása → végszámla |
| POS + Számlát kér + ügyfél | Billing behúzás → auto számla + „Eladás / PDF” visszajelzés |

---

## Create UX

- **Utalás:** Számlázás panel automatikus; ügyfél / utalásra váltáskor billing behúzás; adószám lookup; submit → `?issue=proforma`.
- **KP:** „Számlát kér” opt-in.
- Primary: utalás+függőben → **Rendelés rögzítése**.

## Detail

Két badge: `status` × `payment_status`. CTA: Díjbekérő → Fizetés → Áru átadása → Végszámla.

## Ügyfél

`/ugyfelek` számlázás: `DocumentBillingFields` + taxpayer lookup (üres mezőket tölt).

## POS

Ügyfél választás / „Számlát kér” → billing az ügyfélről. Sikeres számla: zöld sáv + **Eladás / PDF** gomb + toast.
