# Turinova B2B Portal — SaaS Architecture (komplett terv)

**Scope:** `b2b.turinova.hu` — merchant + platform + storefront widget (egy Next app: `b2b-portal`)  
**Last updated:** 2026-08-18  
**Status:** Source of truth for backend / multi-tenant decisions  
**Árazás:** [`PRICING.md`](./PRICING.md)  
**Lásd még:** commerce sync + admin — [`PLATFORM_AND_ADMIN_IMPLEMENTATION.md`](./PLATFORM_AND_ADMIN_IMPLEMENTATION.md)  

Kapcsolódó:
- UI: [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)
- DB futtatás: [`DATABASE.md`](./DATABASE.md)
- SQL fájlok: [`../sql/`](../sql/) — **manuálisan** futtatandók
- Commerce sync · **Active Partner** billing · admin health · multi-platform: [`PLATFORM_AND_ADMIN_IMPLEMENTATION.md`](./PLATFORM_AND_ADMIN_IMPLEMENTATION.md)

---

## 0. Termék röviden

| Felület | Ki | Cél |
|---------|----|-----|
| Storefront widget | B2B vevő a shopban | SKU/lista → natív kosár |
| Merchant portal | Webshop tulajdonos | Shop + widget beállítás |
| Platform admin | Turinova | Tenant létrehozás, invite, suspend |

**Üzleti modell:** invite-only SaaS; **Active Partner** (widget-**rendelés**/hó). Árak v3: Start 6 900 ≤15 · Plus 12 900 ≤40 · Pro 24 900 ≤120 — [`PRICING.md`](./PRICING.md). Portál top-N + SKU soft. **Nincs Free**; trial **30 nap** Pro (logó kint) → Start minimum. Nincs nyilvános regisztráció.  
**Későbbi upsell:** teljes fulfillment ERP (külön termék / izoláció).  
**Pozíció a Shoprenter ökoszisztémában:** nem Billingo/Logzi/CloudERP helyettesítő, hanem **B2B growth layer** mellettük. App Store self-serve = későbbi fázis.

---

## 1. Ipari döntés: miért shared schema?

2024–2026 B2B SaaS default (PlanetScale, Cadence, open-source Better Auth org minták):

| Modell | Mikor | Turinova B2B |
|--------|-------|--------------|
| Shared schema + `org_id` | 95% SaaS | **Igen** |
| Schema-per-tenant | Enterprise izoláció | Nem MVP |
| DB-per-tenant | ERP / regulated | **shop-portal** — ne másold ide |

**Következmény:** egy Postgres, minden business soron `organization_id` (vagy shop → org FK), index `(organization_id, …)`.

**Isolation rétegek (mind kötelező hosszú távon):**
1. Session → aktív `org_id`
2. App data-access helper (soha nyers „minden shop”)
3. Postgres RLS + `FORCE` + `SET LOCAL app.organization_id` (pool-safe)
4. CI: cross-tenant leak tesztek

---

## 2. Rendszerhatárok (1 app, 1 truth)

```
┌──────────────────────────────────────────────┐
│  b2b-portal (:3030 / b2b.turinova.hu)        │
│  Auth, admin, settings + /widget.js + widget │
│  APIs (/api/products/*, /api/orders/*)       │
└────────────────────┬─────────────────────────┘
                     │
              shared Postgres
     org / shop / encrypted creds / widget_settings
```

| Felület | Felelős | Nem felelős |
|---------|---------|-------------|
| Portal UI | Tenant, user, invite, shop creds, widget config | Storefront cart UX |
| Widget API | Product resolve, parse, CORS, shopId→creds | User password / billing |

**Widget `shopId` = `shops.public_id`.** Local env `SHOPRENTER_*` csak fallback, ha nincs shopId.

---

## 3. Domain modell

### 3.1 Organizations (tenant)

- Egy fizető ügyfél = egy `organization`
- Státusz: `trial` | `active` | `suspended`
- Plan: `start` | `plus` | `pro` (Enterprise = custom / `partner_limit_override`). Olvasáskor `grow`→`plus`, `scale`→`pro`. Kézi SQL: `019_plans_v3.sql`.
- Trial: `trial_ends_at` (launch default **+30 nap**); trial alatt Pro entitlements
- Partner limit / SKU soft limit: plan defaults + org override — lásd PLATFORM_AND_ADMIN_IMPLEMENTATION §6
- Meter: aktív partner = **≥1 widget-rendelés / hó** (open ≠ billing)
- Trial vége → policy: widget off vagy read-only (döntés: v1 = suspend + widget_enabled=false)

### 3.2 Users + memberships

- `users`: globális identity (email unique)
- `memberships`: **role itt van** (`owner` | `admin` | `member`) — egy user több orgban lehet
- `is_platform_admin` a useren: Turinova operátor (nem org-tagság)

### 3.3 Invitations

- Invite-only onboarding
- Token: hosszú random, DB-ben **csak hash**
- Státusz: `pending` | `accepted` | `revoked` | `expired`
- Accept: user create vagy link + membership + password set

### 3.4 Shops

- 1 org → tipikusan 1 shop v1-ben (séma enged N-et későbbre)
- `shoprenter_shop_name` **globálisan unique**
- `public_id`: widget / API publikus kulcs (nem titok, de rate-limited)
- Státusz: `draft` | `active` | `needs_reauth` | `suspended` | `uninstalled`

### 3.5 Credentials

- Külön tábla: `shop_credentials`
- AES-GCM ciphertext + iv + key version
- Soha API response / log / UI plaintext
- Ping fail → `shops.status = needs_reauth`

### 3.6 Widget settings

- Gomb felirat, vevőcsoport ID-k, feature flags (JSONB)
- `widget_enabled` a shopon (gyors kill switch)

### 3.7 Audit

- `audit_events`: ki, mit, mikor, meta JSONB
- Platform + merchant érzékeny műveletek

---

## 4. Auth flow (invite-only)

```
Platform admin                Owner email                 Merchant
     │                             │                          │
     │── create org + shop draft ──┤                          │
     │── create invitation ────────▶ email link               │
     │                             │── /invite/[token] ───────▶│
     │                             │   set password            │
     │                             │── membership owner ───────│
     │                             │── login ──────────────────▶│
     │                             │   /home → /settings       │
```

**Session:** httpOnly cookie, server-side `sessions` tábla (vagy signed JWT + rotation).  
**Guard:**
- `/admin/*` → `is_platform_admin`
- `/home`, `/settings` → aktív membership + org nem suspended

**Nincs** public `/signup`.

---

## 5. Shop kapcsolat

### 5.1 MVP (manuális)

1. Platform vagy merchant megadja: shop name, store URL, API client id/secret
2. Encrypt → DB
3. Ping Shoprenter API
4. Origins allowlist (storefront domain)

### 5.2 Később: Shoprenter App Store

- RedirectUri / EntryPoint / UninstallUri + HMAC
- Install → shop bind
- Scope upgrade (`approveScopes`)
- Uninstall → `uninstalled` + creds revoke

---

## 6. Widget multi-tenant

1. Install script: `data-shop-id="{public_id}"` vagy query
2. API: `public_id` → shop → org status check → decrypt creds → Shoprenter
3. CORS: csak `shop_allowed_origins`
4. Suspended / widget off → 403

---

## 7. Edge case katalógus (kötelező kezelés)

### Tenancy
| # | Case | Elvárt |
|---|------|--------|
| T1 | Query `org_id` nélkül | RLS / helper blokkol |
| T2 | User 2 orgban | Explicit active org a sessionben |
| T3 | Platform user merchant route | 403 vagy üres |
| T4 | Org suspended | Login merchant blocked; widget 403 |
| T5 | Org hard delete | Cascade shops/invites; audit megmaradhat |

### Invite / auth
| # | Case | Elvárt |
|---|------|--------|
| A1 | Expired token | Clear error + „kérj új invite-ot” |
| A2 | Reused token | Reject |
| A3 | Revoked | Reject |
| A4 | Email már user | Csak membership + optional password reset |
| A5 | Dupla pending ugyanarra org+email | Egy pending (unique partial) |
| A6 | Brute-force token | 32+ byte entropy, hash, rate limit |

### Shop
| # | Case | Elvárt |
|---|------|--------|
| S1 | Ugyanaz a shop name 2 orgnál | Unique violation, UX hiba |
| S2 | Bad creds | `needs_reauth` |
| S3 | Token expired | Refresh vagy reauth |
| S4 | Uninstall webhook | status + wipe secrets |
| S5 | Custom domain | origins frissítés |

### Widget
| # | Case | Elvárt |
|---|------|--------|
| W1 | public_id leak | Origin + rate limit |
| W2 | CORS `*` prod | Tilos |
| W3 | Cache-elt widget + suspend | Server gate |
| W4 | API rate (Shoprenter) | Per-shop limiter |

### Ops
| # | Case | Elvárt |
|---|------|--------|
| O1 | Pool tenant bleed | `SET LOCAL` / transaction-scoped config |
| O2 | Key rotation | `key_version` a ciphertext mellett |
| O3 | Logs | Nincs secret |

---

## 8. Implementációs fázisok

| Fázis | Mit | Done when |
|-------|-----|-----------|
| **1** | SQL séma (manuális) + docs + db client | Migrations lefuttatva, ping DB |
| **2** | Auth: invite accept + login + session + guards | Platform létrehoz → owner belép |
| **3** | Shop save + encrypt + ping | Settings mentés, status chip él |
| **4** | Widget `public_id` routing (portalban) | 2 shop külön creddel |
| **5** | Hardening: RLS force, audit UI, rate limit | Leak tesztek zöldek |
| **6** | App Store OAuth | Install/uninstall |

**Most:** Fázis 1–4 alap kész (widget a `b2b-portal`-ban, `shopId` resolve); hardening / invite email következik.

---

## 9. Tech stack (portal)

| Réteg | Választás | Megjegyzés |
|-------|-----------|------------|
| DB | PostgreSQL (Supabase project OK) | SQL **kézzel** |
| Query | `pg` (node-postgres) | Nincs auto-migrate |
| Password | `bcrypt` / `argon2` | Invite + login |
| Secrets | AES-256-GCM | `CREDENTIALS_ENCRYPTION_KEY` |
| Session | DB `sessions` + httpOnly cookie | |
| Email | később Resend/Postmark | Invite link |

**Nem használunk** ORM auto-migrate-et. A séma igazsága: `b2b-portal/sql/*.sql`.

---

## 10. Non-goals (v1)

- Public registration
- DB-per-shop
- Stripe billing engine (plan mező elég)
- Impersonate audit nélkül
- Portal + widget egyetlen Next appba kényszerítése
- RLS nélkül „majd emlékszünk a WHERE-re”

---

## 11. Következő lépés az embernek

1. Olvasd el [`DATABASE.md`](./DATABASE.md)
2. Hozz létre dedikált Postgres / Supabase projektet (ne a shop-portal tenant DB)
3. Futtasd sorban: `sql/001` → `007` (lásd sql/README)
4. Töltsd ki `b2b-portal/.env.local`-t
5. Jeeld, ha a séma fent van → folytatjuk Auth (Fázis 2) implementációval
