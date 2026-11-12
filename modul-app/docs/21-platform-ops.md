# 21 — Platform ops (1–2 fős SaaS üzem)

**Állapot:** 2026-11-12 — **Square lean IA** + tenant **Riport** tab.  
Migrációk: `20260406_platform_ops.sql`, `20260407_partner_ops.sql`, `20260600_square_plans_…`.

Kapcsolódó: `17-saas-architecture.md`, `10-permissions-and-tenancy.md`, `20-partner-portal.md`, `33-packages-and-addons.md`.

---

## 1. Zárolt döntések

### P0 (2026-09-14)

| # | Döntés |
|---|---|
| 1 | Max **2** operátor; szerep kevert: sales + onboarding + CS |
| 2 | P0 sorrend: **keresés → impersonation + audit → manuális billing** |
| 3 | Staff **impersonation kell**, **írható**; indok **nem kötelező** |
| 4 | **Egy** globális keresőmező (cég / user email / partner) |
| 5 | Billing **csak manuális** a platformon |
| 6 | Tenant detail primary: **Belépés mint…** (impersonate) |
| 7 | Tenant detailen **saját Audit tab** |
| 8 | Platform host: **`admin.optinova.hu`** (local: `admin.localhost`) |

### Sprint 1 (2026-09-14)

| # | Döntés |
|---|---|
| 1 | Unlink után a **partner választhat újra** céget (nem csak platform) |
| 2 | Partner **disable = app-szintű tiltás** (`partner_profiles.status`); **nincs** Auth ban |
| 3 | Staff reset / invite: **Supabase Auth email** (`resetPasswordForEmail` / `inviteUserByEmail`); ideiglenes jelszó másodlagos |
| 4 | **Nincs** partner impersonation — support: cég unlink/set, disable, jelszó reset (Auth) |

### Manuális előfizetés (2026-09-16)

| # | Döntés |
|---|---|
| 1 | Fizetés **manuális** (bank / külső számla) — **nincs** Stripe / checkout |
| 2 | Plan, add-on, `access_until` (+ hosszabbítás): **csak platform** |
| 3 | Tenant oldalon **soha nincs self-serve** (nincs add-on switch, plan váltás, fizetés gomb) |
| 4 | Listaárak (**nettó**): **Bolt 39 990** / **Bolt+ 59 900** / **Műhely 49 990** / **Pro 94 900** (2 hó próba→Bolt; éves = 10×). Bolt+ = PDA+jelenlét+foot szoftver; hardver egyszeri. SMS **89 Ft/db**. Mátrix: [46](46-csomagok-funkcio-matrix.md) · árak: [33](33-packages-and-addons.md). |
| 5 | Havi becslés = plan + enabled add-onok + SMS ledger (`sent`/`delivered`, lapszabászat + ügyfélrendelés) — platform és tenant **ugyanaz** a lib |
| 6 | Tenant UI: `/beallitasok/elofizetes` — **csak owner**; **nincs ár**; státusz + aktív / elérhető funkciók |
| 7 | Staff sidebar alján: ÁSZF / Adatkezelés / Impresszum (`getLegalUrls`, mint partner) |
| 8 | SMS napló: `/beallitasok/elofizetes/sms` (owner + SMS addon vagy ügyfélrendelés); platform tenant: **SMS (hó)** KPI |

Migráció: `20260427_manual_subscription_pricing.sql`, `20260428_elofizetes_owner_only.sql`.

---

## 2. Hostok

| Host | Ki | Útvonal |
|------|-----|---------|
| `app.optinova.hu` | Tenant staff | `/home`, …; `/platform` → redirect `admin.` (prod) |
| `admin.optinova.hu` | Platform operátor | tiszta: `/tenants`, `/partnerek`, `/katalogus` → rewrite `/platform/*` |
| `optinova.hu` | Partner | változatlan |

### Lean menü (2026-10-13)

| Menü | Útvonal | Megjegyzés |
|---|---|---|
| **Cégek** | `/tenants` (default home) | Teendők sáv + lista; `/` → ide redirect |
| **Partnerek** | `/partnerek` | `?tenant=` szűrő a cég detailből |
| **Katalógus** | `/katalogus` | 4 plan kártya; Haladó = feature/add-on szerkesztés |
| ~~Áttekintés / Health / Csomagok / Add-onok~~ | redirect | legacy URL-ek a fentiekre |

**Cég detail tabok:** **Riport** (első, default) · Üzem · Emberek · Eszközök · Haladó.  
**Nincs** 20 partner dump az Összegzésen — Műhelynél szám + link.

### Tenant Riport (addon-csoportos)

Forrás: `tenant-report-queries.ts` · UI: `tenant-report-panel.tsx`.  
**Szabály:** szekció csak ha a feature entitlement be van (vagy van releváns forgalom SMS/POS-nál).  
**Időszak:** URL `?view=month|year&period=YYYY-MM|YYYY` (Budapest). Aktuális hónap/év = **MTD/YTD**; delta = **azonos napig** az előző időszakban (like-for-like).  
**Nincs** tenant-közi összehasonlítás.

**Fogalmak (ne keverd):**
- **Felvett megrendelés / forgalom** = `order_number` + `ordered_at`, `status ≠ cancelled`, `deleted_at` null; **archív is beleszámít**; összeg `final_total_gross`. Nem készpénz, nem „lezárt”.
- **Partner beküldés** = `portal_submitted_at` (még nem megrendelés). Konverzió = beküldés → van `order_number`.
- **Rögzített befizetés** = `quote_payments` a nem-lemondott quote-on (`payment_date`).
- PostgREST: lapszab / payment / sales **page-elve** (1000-es csonk nélkül); belépő = exact `count`.

| Blokk | Entitlement | Tartalom |
|-------|--------------|----------|
| **Cég (közös)** | mindig | Belépett ember **görgetett 7d** / hely (nem a report periódus) |
| **Lapszabászat + partner** | `lapszabaszat` | Felvett megrendelés/forgalom, chart (BP hét/hó), beküldés→konverzió, félkész snapshot, rögzített befizetés |
| **Belépőszámláló** | `footcounter` | Ma Be/Ki, időszak IN — service-role exact count |
| **Jelenlét** | `jelenlet` | Aktív dolgozó, jelenléti nap/időszak, terminál |
| **SMS** | `quote_ready_sms` (vagy van forgalom) | SMS db az időszakban |
| **Bolt / POS** | `pda_pos` (vagy van eladás) | Eladás `fulfilled_at` (hiányzik → `created_at`) |

---

## 3. Impersonation szabályok

Csak **tenant staff** felhasználóra (nem partner portál).

- Operator session mentése → cél user session (RLS = cél user).
- Írható (cél user jogai szerint).
- Banner: kit / melyik cég; **Kilépés a support módból**.
- TTL: 60 perc.
- Audit: `impersonation.start` / `impersonation.end`.
- Nem rúgja ki a cél user meglévő `app_user_sessions` sorát (middleware bypass).
- Handoff: abszolút URL `NEXT_PUBLIC_APP_ORIGIN`-re (`/api/platform/impersonation/complete`).

---

## 4. Partner ops

- `partner_profiles.status`: `active` \| `disabled` (+ `disabled_at` / `reason` / `by`)
- Disable → login / middleware kiléptet; Auth user megmarad
- Unlink → `selected_tenant_id = null`; partner Beállításokban újra választhat
- Platform set tenant: support override (csak accepting cégek)
- UI: `/platform/partnerek/[id]` — **nincs** „Belépés mint partner”

---

## 5. Staff auth tooling

- **Reset email** / **Invite email** (Supabase Auth template)
- **Ideiglenes jelszó** (másodlagos; session revoke a useren)
- **Session revoke**: user vagy egész tenant (`app_user_sessions`)

---

## 6. Operátor inbox

- Áttekintő **Teendők** lista (stuck / billing / partner)
- Tenant detail **Következő lépés** playbook (onboarding next step)

---

## 7. Manuális billing (`tenants`) — lean `access_until`

**Egy igazság:** `access_until` (nap, Europe/Budapest) + opcionális `access_source` (`trial` \| `paid` \| `manual`).

| Mező / UI | Szerep |
|---|---|
| `access_until` | Hozzáférés utolsó napja |
| `access_source` | Badge: próba vs fizetett |
| Származtatott státusz | `unset` / `trial` / `ok` / `grace` (≤14 nap lejárat után) / `expired` — **nem** szerkeszthető enum |
| Platform Üzem | Hero + **+1 hónap** (primary) / +1 év / Próba 14 nap; Haladó: dátum + Leállít |
| Teendők | `expired` → `grace` → `ending_soon` → `unset` (+ never_login / package_review) |
| Új cég | Auto **14 nap próba** |
| Legacy sync | `billing_status` / `trial_ends_at` / `paid_through` írva marad (riport); UI nem szerkeszti |
| `billing_notes`, `internal_notes`, `contact_*` | Változatlan |

Migráció: `20260601_access_until_lean_billing.sql`. Lib: `src/lib/billing/access.ts`.

### 7.1 Katalógus árak (nettó HUF)

- `product_plans.price_monthly_huf` (+ `currency`) — **nettó** havidíj
- `product_addons.price_monthly_huf`, opcionális `price_unit_huf` + `unit_key` (`sms_sent`) — **nettó**
- Szerkesztés: `/platform/katalogus` (és Haladó plan/add-on)
- Tenant detail → **Üzem / Előfizetés**: havi becslés + access_until hosszabbítás
- Tenant app → **Előfizetés**: csak olvasás (származtatott státusz + dátum)

**TILOS tenant oldalon:** add-on enable, plan váltás, fizetés / upgrade CTA.

---

## 8. Env (Vercel)

```
NEXT_PUBLIC_PLATFORM_ORIGIN=https://admin.optinova.hu
NEXT_PUBLIC_APP_ORIGIN=https://app.optinova.hu
NEXT_PUBLIC_PARTNER_ORIGIN=https://optinova.hu
COOKIE_DOMAIN=.optinova.hu
```

**Cookie-k mindig host-only-k** (nincs `Domain`). A `COOKIE_DOMAIN` már csak takarításra kell: a korábban így írt
`modul_*` példányokat a belépés (`/auth/session-bootstrap`) és a middleware (ha egy név kétszer érkezik) lejáratja
(`src/lib/auth/shared-cookies.ts`). Ok: a domain példány a host-only párja mellett a Safariban győzött → `nonce_mismatch`.
Impersonation vége külön admin hoston: csak a cél sessiont zárjuk le (`signOut` local), az operátor admin hostos
sütijeihez és refresh tokenjéhez nem nyúlunk. Middleware kidobás: `signOut({ scope: 'local' })`, előtöltésre (`Next-Router-Prefetch`)
204 kidobás nélkül, átirányítás `Cache-Control: no-store`.

**Local path-mód (staff impersonation teszt):**

```
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3010
# PLATFORM_ORIGIN / COOKIE_DOMAIN kikommentelve
```

Handoff URL mindig abszolút, ha az APP origin be van állítva (admin hostról ne legyen relatív `/api/...`).
`subject_kind` / nullable `tenant_id` a DB-ben megmarad (legacy), de a kód csak staff impersonationt indít.
Migráció: `20260407_partner_ops.sql` + `20260408_impersonation_subject_kind_grant.sql`.

## 9. Perf (platform navigáció)

- Auth user lista: **60s in-memory cache** + request dedupe (`listAllAuthUsersCached`)
- Tenant / partner detail: **`getAuthUsersByIds`** (nem full listUsers)
- Áttekintő: health **Suspense** (nem a kritikus path)
- Platform session: **lean** — nincs membership / entitlements fetch
- `loading.tsx` skeleton azonnali visszajelzéshez

## 10. Demó törzs seeder (platform)

Migráció: `20260522_seed_demo_master_data.sql`.

- RPC: `seed_demo_master_data(tenant_id)` + `demo_master_has_data(tenant_id)` — **service_role only**.
- UI: cég létrehozás checkbox + tenant detail **Demó adatok feltöltése** (confirm).
- Tartalom: ÁFA, cég (Kecskemét + Turinova logo storage), fizetési módok, egységek, díjtípusok, gyártók, gépek, raktár + pénztár, vágási díj, SMS, demo vevő/szállító, HR, Jelenlét addon + **katalógus** (2 tábla, 2 él, 2 munkalap, 3 termék + képek `public/images/demo-seed/`).
- Egy gomb / create checkbox — `seed_demo_master_data` RPC + `seedDemoCatalog` TS.
- Audit: `tenant.demo_seed`.
- Idempotens: törzs + katalógus (SKU `ZSL-001`) külön skipelhető.
## 11. Cég lezárás / végleges törlés

- **Lezárás** (`closePlatformTenant`): `status = churned` — tagok nem kapnak tenant kontextust (`resolveCurrentTenant` kihagyja). Adat megmarad.
- **Végleges törlés** (`purgePlatformTenant`): csak `churned` + slug megerősítés. Storage prefix törlés, `tenants` DELETE (cascade), orphan Auth userek törlése (ha nincs más membership / partner / platform admin).
- Audit: `tenant.status` / `tenant.purge` (purge után `tenant_id` null, slug a details-ben).
- UI: tenant detail → **Veszélyzóna**.
