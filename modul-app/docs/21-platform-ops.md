# 21 — Platform ops (1–2 fős SaaS üzem)

**Állapot:** P0 kész (keresés, impersonation, audit, manuális billing, `admin.` host). Migráció: `20260406_platform_ops.sql`.

Kapcsolódó: `17-saas-architecture.md`, `10-permissions-and-tenancy.md`, `20-partner-portal.md`.

---

## 1. Zárolt döntések (2026-09-14)

| # | Döntés |
|---|---|
| 1 | Max **2** operátor; szerep kevert: sales + onboarding + CS |
| 2 | P0 sorrend: **keresés → impersonation + audit → manuális billing** |
| 3 | Staff **impersonation kell**, **írható**; indok **nem kötelező**; partner impersonation **később** |
| 4 | **Egy** globális keresőmező (cég / user email / partner) |
| 5 | Billing **csak manuális** a platformon; külön számlázás; itt státusz / trial / paid_through |
| 6 | Tenant detail primary: **Belépés mint…** (impersonate) |
| 7 | Tenant detailen **saját Audit tab** |
| 8 | Platform host: **`admin.optinova.hu`** (local: `admin.localhost`) |

**Nem P0:** partner disable, maintenance banner, Stripe, export/snapshot, platform RBAC (owner vs support).

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
- Banner: kit / melyik cég; **Kilépés a support módból**.
- TTL: 60 perc.
- Audit: `impersonation.start` / `impersonation.end`.
- Nem rúgja ki a cél user meglévő `app_user_sessions` sorát (middleware bypass impersonation cookie-val).

---

## 4. Manuális billing mezők (`tenants`)

- `billing_status`: `none` \| `trial` \| `active` \| `past_due` \| `canceled`
- `trial_ends_at`, `paid_through`
- `billing_notes`, `internal_notes`
- `contact_phone`, `contact_email`

---

## 5. Env (Vercel)

```
NEXT_PUBLIC_PLATFORM_ORIGIN=https://admin.optinova.hu
NEXT_PUBLIC_APP_ORIGIN=https://app.optinova.hu
COOKIE_DOMAIN=.optinova.hu   # opcionális; subdomain cookie megosztás
```

## 6. Perf (platform navigáció)

- Auth user lista: **60s in-memory cache** + request dedupe (`listAllAuthUsersCached`)
- Tenant / partner detail: **`getAuthUsersByIds`** (nem full listUsers)
- Áttekintő: health **Suspense** (nem a kritikus path)
- Platform session: **lean** — nincs membership / entitlements fetch
- `loading.tsx` skeleton azonnali visszajelzéshez
