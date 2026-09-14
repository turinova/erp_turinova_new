# 20 — Partner portal (online asztalos rendelés)

**Állapot:** Fázis 0–8 (platform áttekintés GMV/partner KPI + partnerek lista). Tovább: staff szűrők.

Kapcsolódó: `17-saas-architecture.md`, `08-separation-boundaries.md`, `19-supabase-setup.md`.  
Legacy ötletforrás (nem kód): `customer-portal` — regisztráció, cégválasztó, Opti → submit.

---

## 1. Egy mondatos döntés

> **Asztalosok (partnerek) az `optinova.hu`-n regisztrálnak, nem tenant seat-ek; a kiválasztott cég anyagával/árával Optiznak; első draft mentéskor létrejön a cég ügyféltörzsében a linked customer; beküldés = draft + `portal_submitted_at`, staff az `app.optinova.hu`-n Online jelzéssel látja.** A tenant ezt **add-onként** kapcsolja.

---

## 2. Host / szerep

| Host | Ki | Auth |
|------|-----|------|
| `app.optinova.hu` | Tenant staff | `tenant_memberships` + seat/session |
| `optinova.hu` | Partner (asztalos) | `partner_profiles` — **nem** membership, **nem** seat |

Egy Vercel deploy, middleware host alapján.  
**V1:** ugyanaz az email **nem** lehet staff + partner egyszerre.

---

## 3. Partner UI (későbbi fázisok)

Kezdőlap · Kereső · Opti · Ajánlatok · Megrendelések · Beállítások.  
**Out of V1:** NETTFRONT, Ügyfélajánlat, SMS, kedvezmény-mátrix, widget, legacy 400-as migráció.

---

## 4. Üzleti flow (zárolt)

1. Partner regisztrál → `partner_profiles`.
2. Nyilvános listából választ tenanthoz (csak ahol add-on + `active`).
3. Kereső / Opti = annak a tenantnak törzse + árazása.
4. **Első draft mentés (modell A)** → `ensure_partner_customer(tenant_id)` → `customers` + `quotes` (`source=portal`, `status=draft`, `portal_submitted_at` null).
5. **Beküldés** → `portal_submitted_at = now()`; status marad `draft`; partner **nem** szerkeszthet tovább.
6. Staff: Online / Új beküldés → meglévő convert → order / gyártás.
7. Partner Megrendelések: `portal_submitted_at IS NOT NULL` (+ későbbi státuszok).

Egy partner × egy tenant = **egy** `customers` sor (`partner_profile_id`). Másik cég = másik customer sor.

---

## 5. Entitlement

| Kulcs | Szerep |
|-------|--------|
| Feature `partner_orders` | Képesség (nem staff `page_key`) |
| Add-on `partner_orders` | „Online partner rendelés” — platform kapcsolja tenanton |

**Nincs** az Alap planban. Lista / katalógus / mentés csak ha `tenant_entitlements` tartalmazza + tenant `active`.

---

## 6. Adatmodell (Fázis 1)

| Elem | Megjegyzés |
|------|------------|
| `partner_profiles` | PK = `auth.users.id`; billing; `selected_tenant_id` |
| `customers.partner_profile_id` | Unique `(tenant_id, partner_profile_id)` élő sorokra |
| Név-unique | Csak staff ügyfelekre (`partner_profile_id IS NULL`) |
| `quotes.partner_profile_id` | Ki küldte |
| `quotes.portal_submitted_at` | Mentve vs beküldve |
| `ensure_partner_customer(uuid)` | Idempotens RPC (email merge, revive, insert) |

RLS váz: partner saját profil; saját portal quote-ok; katalógus SELECT csak `selected_tenant` + add-on; staff policy változatlan. Production / order írás csak membership.

---

## 7. Implementációs fázisok (kézi teszt stopokkal)

| Fázis | Tartalom | Te teszteléd |
|-------|----------|--------------|
| **0** | Ez a doc | OK jel |
| **1** | Migration + add-on seed + RPC/RLS | SQL: add-on, RPC 2× → 1 customer |
| **2** | Host + auth kapu (`/partner/login|register`) | Regisztráció / staff↔partner tiltás; seat csak staff |
| **2b** | Regisztráció wizard: fiók + számlázás + default cég | 3 lépés, céglista API, validáció |
| **3** | Partner shell + Beállítások (jelszó, fióktörlés) | Profil mentés / jelszó / TORLES törlés |
| **4** | Partner Kereső (kapcsolt cég anyagai) | q + lista mint staff, detail link nélkül |
| **5** | Opti + draft A | Customer + hidden unsubmitted staff |
| **6** | Submit + lock + staff badge (+ partner listák) | Szerkesztés tiltva; Online badge |
| **7** | Partner detail (PDF + megjegyzés) + Megrendelések követés | Státusz / fizetés / `production_date`; gép nem partneren |
| **8** | Platform: partner lista/detail + GMV/aktivitás KPI | `ordered_at`; read-only partnerek |
| 9 | Keményedés | Külön |

---

## 8. Tesztchecklist — Fázis 1 (SQL)

Migráció: `supabase/migrations/20260331_partner_portal.sql`.

1. `product_features` / `product_addons` / `product_addon_features` — van `partner_orders`.
2. Tenanton add-on enable + materialize → `tenant_entitlements` tartalmazza `partner_orders`.
3. Partner user + `partner_profiles` sor (staff membership nélkül).
4. `select ensure_partner_customer('<tenant_id>')` kétszer → ugyanaz az `id`.
5. Meglévő emailű staff customer → második ensure **linkeli**, nem duplikál.
6. `tenant_accepts_partner_orders(id)` true csak active + entitlement mellett.

---

## 9. Tesztchecklist — Fázis 2

Local (staff host, pl. `localhost:3010`):

1. `/partner/register` → új email → `partner_profiles` sor + `/partner/home`
2. Ugyanazzal a fiókkal `/login` (staff) → hiba: partner fiók
3. Staff userrel `/partner/login` → hiba: céges fiók
4. Partner session mellett **nincs** `modul_session_nonce` kötelező (másik böngészőben is beléphet)
5. Staff belépés továbbra is single-session (nonce)
6. Opcionális: `MODUL_AUTH_SURFACE=partner` → `/login` redirect `/partner/login`

### Fázis 2b — regisztráció bővítés

1. `/partner/register` 3 lépés: fiók → számlázás → cég
2. Mobil kötelező; adószám/cégjegyzék → cím kötelező
3. `GET /api/partner/companies` csak `partner_orders` + active tenanteket ad
4. Profilban `selected_tenant_id` + billing mezők kitöltve
5. Home mutatja a cég **nevét**, nem csak UUID-t

### Fázis 3 — Beállítások

1. `/partner/beallitasok` — profil + cég mentés
2. Jelszócsere (jelenlegi ellenőrzés)
3. Fiók törlés: `TORLES` + jelszó → auth user törlés; beküldött quote megmarad a cégnél
4. Shell nav: Kezdőlap + Beállítások élő; többi stub

### Fázis 4 — Kereső

1. Kapcsolt cég nélkül → figyelmeztetés + Beállítások
2. `q` keresés → kapcsolt tenant anyagai, árak
3. Nincs staff törzsadat detail link

### Fázis 5 — Opti + draft A

1. Migráció (opcionális, de ajánlott): `20260401_partner_generate_quote_number.sql`
2. `/partner/opti` — kapcsolt cég anyag + élzáró + vágási díj
3. Optimalizálás + mentés → `ensure_partner_customer` + `quotes.source=portal`, `portal_submitted_at` null
4. Q-szám: RPC ha elérhető, különben service-role allokáció (`partner-quote-number.ts`)
5. Második mentés ugyanarra a `quote_id`-re frissít
6. Staff `/ajanlatok` **nem** listázza az elküldetlen portal draftot
7. Staff detail URL → 404 / nincs a nem beküldött portal draft

### Fázis 6 — Beküldés + listák + Online

1. `/partner/ajanlatok` — elküldetlen draftok; részleteken Beküldés / Törlés
2. Beküldés → `portal_submitted_at`; partner nem szerkeszthet tovább
3. `/partner/megrendelesek` — beküldött tételek (olvasható)
4. Staff `/ajanlatok` — megjelenik + **Online** badge
5. Opti mentés után redirect → partner Ajánlatok

### Fázis 7 — Detail + Megrendelések követés

1. Partner detail (PDF, megjegyzés) staff layouttal
2. `/partner/megrendelesek`: Fizetés + Státusz badge (partner label/tone) + **Gyártás** = csak `production_date`
3. Detail: fizetés badge partnernek; gyártás dátum; **gyártógép / vonalkód nem** partneren
4. Label: Beküldve / Megrendelve / Gyártásban / Gyártás kész / Átadva / Törölve (`partner-status-labels.ts`)
5. Tone: `ready` = success, `ordered` = info
6. `quotes.project_name` — Opti + detail szerkesztés; lista a szám alatt; PDF V1-ben nem
7. Partner megrendelés detail: befizetés lista (összeg, dátum, mód) + fizetve/hátralék; belső comment rejtve

### Fázis 8 — Platform KPI + partnerek

1. `/platform` — Aktivitás / GMV (HUF) / Partner sáv; 7 nap Δ
2. Megrendelés KPI: `quotes.ordered_at` (migráció `20260404`)
3. `/platform/partnerek` lista + detail (read-only)
4. Attention: partner cég nélkül / sosem login
5. Tenant detail: GMV 30 nap, linked partners, portal beküldés 30 nap

---

## 10. Explicit NEM (V1)

- Partner seat / `app_user_sessions`
- Staff + partner ugyanaz az email
- Beküldés után partner edit
- Dual-DB / legacy portal bridge
- Kódimport `customer-portal`-ból
- Partneren gyártógép / vonalkód megjelenítés
- Projekt név a PDF-en (V1)
- Partner befizetés rögzítés / belső payment comment
- Platform partner disable / unlink / impersonate (V1 read-only)
