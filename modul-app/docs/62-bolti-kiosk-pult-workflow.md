# 62 · Bolti kiosk → pult workflow (draft, jóváhagyás, megrendelés)

**Állapot:** 2026-11-22. P1c leadás **kész** (migráció `20261021_kiosk_quotes.sql`). PDF jóváhagyó blokk és auto-archív: **nem** készül (döntés).  
**Kapcsolat:** termék [60](60-bolti-kiosk.md) · kiosk UX [61](61-bolti-kiosk-ux.md) · quote pipeline [37](37-lapszabaszat-quote-workflow.md) · partner minta [20](20-partner-portal.md) · átvételi blokk [43](43-atveteli-blokk.md) · számlázás [36](36-szamlazas-workflow.md).

---

## 0. Egy mondat

> A vevő a bolti kiosk PC-n összerakja a szabásjegyzéket és leadja → **draft** quote (`source=kiosk`), az ügyfél telefonszám alapján kötve vagy újonnan létrehozva → a pultos **név (+ telefon utolsó 4 jegy)** alapján megtalálja, átnézi a vevővel, ha kell módosít, kinyomtatja, a vevő aláírja, majd **Megrendelés + befizetés** → gyártás → kész SMS → átadás (átvételi blokk).

---

## 1. Miért így (kutatás)

| Forrás | Tanulság |
|---|---|
| IKEA konyhatervező | Vevő tervez, kolléga **ellenőrzi**, abból rendelés. |
| Lapszab / lemezvágó ipar | **Aláírt szabásjegyzék vágás előtt**; levágott lap nem visszavehető. |
| Reddit (gyorsétterem kioskok) | Vevőnek a **név** a jó; staff oldalon a név nem egyedi, kell második azonosító. |

---

## 2. Zárolt döntések

| # | Döntés |
|---|---|
| 1 | Kiosk leadás = **`draft`**, nem `ordered`. Rendelésszám csak a pultnál. |
| 2 | Vevő felé azonosító = **név**. Nincs „jegyezd meg a számot”. |
| 3 | Staff felé = **név + telefon utolsó 4 jegye + leadás ideje**. |
| 4 | Telefon **kötelező** (teljes HU mobil). E-mail opcionális. |
| 5 | Pult sorrend: átnézés → módosítás → nyomtatás → aláírás → Megrendelés. |
| 6 | **Ügyfél leadáskor:** normalizált telefonszám egyezés → meglévő ügyfél; nincs egyezés → **új ügyfél**. Nincs „Kiosk vevő” placeholder. Akkor is marad az ügyfél, ha nem rendel (telefon / e-mail később hasznos). |
| 7 | Meglévő ügyfélnél **nem írunk felül** nevet vagy kitöltött adatot; csak üres e-mailt / üres számlázást töltünk. |
| 8 | Több ügyfél ugyanazzal a számmal → a legutóbb módosított, jelzéssel (`phone_multiple`); a pultos ellenőrzi. |
| 9 | Név foglalt (tenant-szintű egyedi név) → új ügyfél **„Név (…4567)”**, jelzés `created_renamed`. |
| 10 | Megrendelés dialógus kiosk forrásnál: **Teljes** összeg előtöltve. |
| 11 | „Átnéztem” pipa → `kiosk_consent_at` + `kiosk_consent_version`. |
| 12 | Fizetés **csak a pultnál**. |
| 13 | **Nincs** PDF jóváhagyó blokk (az átadólapon már van aláírás, [43](43-atveteli-blokk.md)). |
| 14 | **Nincs** automatikus archív / törlés: el nem hozott kiosk draftot a pultos törli, mint bármely piszkozatot. |
| 15 | Beírt méret = **kész méret, élzáróval együtt**. A vágásnál a műhely számol az élzáróval. |
| 16 | Teljes tábla árazásnál a **maradék a megrendelőé** (kiosk + pult + PDF, minden forrású ajánlatnál). |

---

## 3. Folyamat

```
KIOSK (vevő)                    SZERVER                                  PULT (staff)
────────────                    ───────                                  ────────────
Kosár → ár (Opti nesting)
Adatok: név, tel, (email,
  számla) + ☑ Átnéztem
Leadom a pultnak  ───────────►  eszköz + rate limit
                                ár újraszámolás (kliens ár nem számít)
                                eltér? → 409, vevő megerősíti
                                ügyfél: telefon egyezés / új
                                Q-szám + quote + gyerek sorok  ───────►  Home: „Kioskról érkezett”
Kész: „Mondd a neved”                                                    /ajanlatok: Kiosk badge + szűrő
                                                                         Opti módosítás → nyomtatás → aláírás
                                                                         Megrendelés (Teljes előtöltve)
```

---

## 4. Implementáció (P1c)

### 4.1 DB · `supabase/migrations/20261021_kiosk_quotes.sql`

| Elem | Megjegyzés |
|---|---|
| `quotes.source` += `kiosk` | check constraint csere |
| `quotes.created_by` nullable | check: `created_by is not null or source = 'kiosk'` (kiosknak nincs auth user) |
| `kiosk_submitted_at`, `kiosk_device_id` | leadás ideje, eszköz |
| `kiosk_submission_id` | idempotencia (unique / tenant): dupla kattintás, retry |
| `kiosk_guest_name/phone/email` | amit a vevő beírt (pillanatkép) |
| `kiosk_consent_at`, `kiosk_consent_version` | „Átnéztem” nyom |
| `kiosk_customer_match` | `phone` · `phone_multiple` · `created` · `created_renamed` |
| `billing_*_snapshot` | meglévő mezők, ha „Kérek számlát” |
| `normalize_hu_phone(text)` + index | `06…`, `0036…`, `+36…`, 9 jegyű → `36…` |
| `find_customers_by_phone(tenant, phone)` | csak `service_role` |

### 4.2 Szerver

| Fájl | Szerep |
|---|---|
| `app/api/kiosk/[slug]/submit/route.ts` | eszköz kapu, rate limit (10 / 10 perc / eszköz vagy IP), parse |
| `lib/kiosk/submit.ts` | orchestrator: idempotencia → guest validáció → ár újraszámolás → ügyfél → Q-szám (3 retry) → insert → gyerek sorok; hiba esetén quote soft-delete |
| `lib/kiosk/customer-match.ts` | telefon egyezés / új ügyfél / névütközés |
| `lib/kiosk/customer-match-rules.ts` | tiszta szabályok + teszt |
| `lib/quotes/persist-opti-quote.ts` | közös gyerek-sor mentés (staff Opti, partner, kiosk) |
| `lib/kiosk/price.ts` · `buildKioskCartQuote` | ár + panelek + QuoteResult a mentéshez |

### 4.3 Kiosk kliens

- Valódi leadás (`submitOrder`), `submissionId` a kosár törléséig él.
- Leadás közben az idle reset nem fut.
- 409 `price_changed` → dialógus: „Az ár közben változott” (Mégse / Leadom ezen az áron).
- Lap elfogyott / nem fér fel → vissza a kosárhoz, ár újraszámolás kell.

### 4.4 Pult

- `/ajanlatok`: **Kiosk** badge, **Kiosk** szűrő chip (`?forras=kiosk`), keresés név / telefon / kiosk guest mezők alapján.
- Detail: kiosk kártya (beírt adatok, leadás ideje, ügyfél-egyezés; figyelmeztetés `phone_multiple` / `created_renamed` esetén).
- Home: „Kioskról érkezett” blokk (név, telefon vége, Q-szám, összeg, idő), lapszabászat entitlementnél.
- `CreateOrderDialog`: `defaultFullAmount` kiosk forrásnál.

---

## 5. Edge case-ek

| Eset | Kezelés |
|---|---|
| Dupla kattintás / hálózati retry | ugyanaz a `submissionId` → meglévő quote vissza |
| Ár változott kosár óta | 409 + megerősítés új árral |
| Lap törölve / nem fér fel | 422 → kosár |
| Kiosk közben kikapcsolva | 403: „A kiosk most nem fogad rendelést. Szólj a pultnál.” |
| Q-szám ütközés (párhuzamos leadás) | unique index → új szám, max 3 próbálkozás |
| Gyerek sor mentés elhasal | quote soft-delete, vevő hibaüzenet, kosár megmarad (ügyfél marad) |
| Régi ügyfél `06…` formátummal | normalizált index miatt egyezik |
| Törölt ügyfél ugyanazzal a számmal | nem egyezés → új ügyfél |
| Partner-ügyfél ugyanazzal a számmal | hozzákötjük; partner portálon nem látszik (ott `partner_profile_id` szűr) |
| Pultos Optiban módosít | `source` marad `kiosk`, pillanatképek nem változnak |

---

## 6. Későbbre

| Fázis | Tartalom |
|---|---|
| P1d | Eszköz token kötelező (most 0 eszköz = átmeneti bypass) |
| P2 | Min. előleg % · ügyfél-összevonás UI · Google értékelés QR a Kész képernyőn |
| P3 | Digitális aláírás |

## 7. Explicit NEM

- Online fizetés a kioskon
- Rendelésszám a vevőnek
- Vevői módosítás leadás után
- Partner login a kioskon
