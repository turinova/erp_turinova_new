# 21 — Platform ops (1–2 fős SaaS üzem)

**Állapot:** Sprint 1 (partner ops + staff auth tooling). Migrációk: `20260406_platform_ops.sql`, `20260407_partner_ops.sql`.

Kapcsolódó: `17-saas-architecture.md`, `10-permissions-and-tenancy.md`, `20-partner-portal.md`.

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
| 2 | Plan, add-on, `paid_through`, státusz: **csak platform** |
| 3 | Tenant oldalon **soha nincs self-serve** (nincs add-on switch, plan váltás, fizetés gomb) |
| 4 | Listaárak a katalógusban (**nettó**): Alap **22 000** (eladás + készlet + **beszerzés**), POS **9 900**, Jelenlét **9 900**, címke **9 900**, partner **19 000**, SMS **4 900 + 89 Ft/db**. Részletek: [33](33-packages-and-addons.md). |
| 5 | Havi becslés = plan + enabled add-onok + SMS ledger (`sent`/`delivered`) — platform és tenant **ugyanaz** a lib |
| 6 | Tenant UI: `/beallitasok/elofizetes` — **csak owner**; **nincs ár**; státusz + aktív / elérhető funkciók |
| 7 | Staff sidebar alján: ÁSZF / Adatkezelés / Impresszum (`getLegalUrls`, mint partner) |
| 8 | SMS napló: `/beallitasok/elofizetes/sms` (owner + SMS addon) |

Migráció: `20260427_manual_subscription_pricing.sql`, `20260428_elofizetes_owner_only.sql`.

---

## 2. Hostok

| Host | Ki | Útvonal |
|------|-----|---------|
| `app.optinova.hu` | Tenant staff | `/home`, …; `/platform` → redirect `admin.` (prod) |
| `admin.optinova.hu` | Platform operátor | tiszta: `/`, `/tenants`, … → rewrite `/platform/*` |
| `optinova.hu` | Partner | változatlan |

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

## 7. Manuális billing mezők (`tenants`)

- `billing_status`: `none` \| `trial` \| `active` \| `past_due` \| `canceled`
- `trial_ends_at`, `paid_through`
- `billing_notes`, `internal_notes`
- `contact_phone`, `contact_email`

### 7.1 Katalógus árak (nettó HUF)

- `product_plans.price_monthly_huf` (+ `currency`) — **nettó** havidíj
- `product_addons.price_monthly_huf`, opcionális `price_unit_huf` + `unit_key` (`sms_sent`) — **nettó**
- Szerkesztés: `/platform/csomagok`, `/platform/add-onok`
- Tenant detail → **Billing**: havi becslés (nettó) + manuális státusz / határidő
- Tenant app → **Előfizetés**: csak olvasás; UI mindenütt jelzi: nettó

**TILOS tenant oldalon:** add-on enable, plan váltás, fizetés / upgrade CTA.

---

## 8. Env (Vercel)

```
NEXT_PUBLIC_PLATFORM_ORIGIN=https://admin.optinova.hu
NEXT_PUBLIC_APP_ORIGIN=https://app.optinova.hu
NEXT_PUBLIC_PARTNER_ORIGIN=https://optinova.hu
COOKIE_DOMAIN=.optinova.hu
```

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
- Tartalom: ÁFA, cég (Kecskemét + Optinova logo storage), fizetési módok, egységek, díjtípusok, gyártók, gépek, raktár + pénztár, vágási díj, SMS, demo vevő/szállító, HR, Jelenlét addon + **katalógus** (2 tábla, 2 él, 2 munkalap, 3 termék + képek `public/images/demo-seed/`).
- Egy gomb / create checkbox — `seed_demo_master_data` RPC + `seedDemoCatalog` TS.
- Audit: `tenant.demo_seed`.
- Idempotens: törzs + katalógus (SKU `ZSL-001`) külön skipelhető.
## 11. Cég lezárás / végleges törlés

- **Lezárás** (`closePlatformTenant`): `status = churned` — tagok nem kapnak tenant kontextust (`resolveCurrentTenant` kihagyja). Adat megmarad.
- **Végleges törlés** (`purgePlatformTenant`): csak `churned` + slug megerősítés. Storage prefix törlés, `tenants` DELETE (cascade), orphan Auth userek törlése (ha nincs más membership / partner / platform admin).
- Audit: `tenant.status` / `tenant.purge` (purge után `tenant_id` null, slug a details-ben).
- UI: tenant detail → **Veszélyzóna**.
