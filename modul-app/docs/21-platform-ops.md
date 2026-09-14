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
| 4 | Partner impersonation: handoff `NEXT_PUBLIC_PARTNER_ORIGIN`-re; `subject_kind=partner`; tenant lehet null |

---

## 2. Hostok

| Host | Ki | Útvonal |
|------|-----|---------|
| `app.optinova.hu` | Tenant staff | `/home`, …; `/platform` → redirect `admin.` (prod) |
| `admin.optinova.hu` | Platform operátor | tiszta: `/`, `/tenants`, … → rewrite `/platform/*` |
| `optinova.hu` | Partner | változatlan |

---

## 3. Impersonation szabályok

- Operator session mentése → cél user session (RLS = cél user).
- Írható (cél user jogai szerint).
- Banner: kit / melyik cég (vagy „Partner portál”); **Kilépés a support módból**.
- TTL: 60 perc.
- Audit: `impersonation.start` / `impersonation.end`.
- Staff: nem rúgja ki a cél user meglévő `app_user_sessions` sorát (middleware bypass).
- Partner: nincs `app_user_sessions` — partner host middleware profile + status check.

---

## 4. Partner ops

- `partner_profiles.status`: `active` \| `disabled` (+ `disabled_at` / `reason` / `by`)
- Disable → login / middleware kiléptet; Auth user megmarad
- Unlink → `selected_tenant_id = null`; partner Beállításokban újra választhat
- Platform set tenant: support override (csak accepting cégek)
- UI: `/platform/partnerek/[id]`

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

---

## 8. Env (Vercel)

```
NEXT_PUBLIC_PLATFORM_ORIGIN=https://admin.optinova.hu
NEXT_PUBLIC_APP_ORIGIN=https://app.optinova.hu
NEXT_PUBLIC_PARTNER_ORIGIN=https://optinova.hu
COOKIE_DOMAIN=.optinova.hu
```

**Local path-mód (impersonation teszt egy hoston):**

```
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3010
NEXT_PUBLIC_PARTNER_ORIGIN=http://localhost:3010
# PLATFORM_ORIGIN / COOKIE_DOMAIN kikommentelve
```

Handoff URL mindig abszolút, ha az origin be van állítva (admin hostról ne legyen relatív `/api/...`).
Migráció: `20260407_partner_ops.sql` + `20260408_impersonation_subject_kind_grant.sql`.

## 9. Perf (platform navigáció)

- Auth user lista: **60s in-memory cache** + request dedupe (`listAllAuthUsersCached`)
- Tenant / partner detail: **`getAuthUsersByIds`** (nem full listUsers)
- Áttekintő: health **Suspense** (nem a kritikus path)
- Platform session: **lean** — nincs membership / entitlements fetch
- `loading.tsx` skeleton azonnali visszajelzéshez
