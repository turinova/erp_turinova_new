# Turinova B2B Portal — Design System & UI/UX Principles

**Scope:** `b2b.turinova.hu` (merchant) + Platform Admin (`/admin`) + Auth (`/login`, invite)  
**Stack context:** Next.js App Router, Tailwind v4, Lucide icons (preferred)  
**Last updated:** 2026-08-13  

This document is the **source of truth** for visual and interaction decisions.  
When in doubt: **speed → compactness → clarity**. Everything else is secondary.

---

## 1. Product context

| Surface | Who | Purpose |
|---------|-----|---------|
| Auth | Invited users only | Login / set password — **no public signup** |
| Platform Admin | Turinova operators | Manage all SaaS tenants |
| Merchant Portal | Shop owners | Shop, widget settings, partners, reports (later) |

Tenants are **created by us** after email inquiry (invite-only).  
Never add a public “Sign up” CTA on login.

---

## 2. Non-negotiable priorities

1. **Speed** — Instant feel; minimal JS on critical paths; no decorative motion.
2. **Compactness** — Dense, calm layouts (Linear / Stripe ops style).
3. **Clarity** — In 3 seconds: where am I, what’s wrong, what do I do next.

If a design element does not serve a **decision** or an **action**, remove it.

---

## 3. Inspiration (2026 SaaS) — take & leave

### Take
- Calm / quiet chrome (hierarchy from type + spacing)
- Table-first admin (not chart-first vanity dashboards)
- Progressive disclosure
- Role-based shells (platform ≠ merchant)
- Command palette (⌘K) for power users
- **Widget liquid glass language** for product chrome (see §3.1)

### Leave / reject
- Heavy decorative glassmorphism (blur on every card / purple glow)
- Dark mode as default (light-first for B2B admin)
- AI chat bubble as primary UI
- 6–12 KPI cards with no next action
- Fat sidebars with 20+ nav items
- Marketing footers inside the app chrome

### Steve Jobs filter
- One primary action per view
- Ruthless reduction
- No ornament for its own sake

### 3.1 Liquid glass (aligned with storefront widget)

The portal **must feel like the B2B quick-order widget**, not a generic shadcn template.

| Element | Spec (from widget) |
|---------|-------------------|
| Canvas | `#F7F6F3` |
| Surface | `#FFFFFF` |
| Accent | `#000000` (Olvasó) |
| Text / muted | `#1A1917` / `#6F6E69` |
| Hairline | `0.5px` `rgba(55,53,47,.16)` |
| Glass chrome | `rgba(247,246,243,.82)` + `backdrop-filter: saturate(1.6) blur(20px)` on **header / sidebar only** |
| Nav segment | Apple-style pill track `rgba(55,53,47,.08)` + white active chip + light shadow |
| Radius | **0** — szögletes (Olvasó); sehol sem lekerekített kártya / control |
| Font | system / SF Pro stack (fast, native) |
| Motion | ≤180ms ease; respect `prefers-reduced-motion` |

**Rule:** glass on **chrome**, solid surfaces on **content** (tables, forms) — keeps readability and paint performance.

---

## 4. Design tokens

### Color

| Token | Value | Use |
|-------|--------|-----|
| `--bg` / canvas | `#F7F6F3` | Page background (widget) |
| `--surface` | `#FFFFFF` | Cards, tables |
| `--surface-2` | `#EFEEE9` | Inputs, table header |
| `--text` | `#1A1917` | Primary text |
| `--muted` | `#6F6E69` | Secondary — keep readable on surface |
| `--line` / `--line-strong` | `rgba(55,53,47,.09/.16)` | Hairlines |
| `--accent` | `#000000` | Primary CTA (Olvasó / high contrast) |
| `--ok` / `--warn` / `--danger` | `#2F6F4E` / `#9A6700` / `#A32D2D` | Status |

**Do not** default to purple-indigo SaaS cliché or cream + terracotta “AI landing” looks.

### Typography

- **System stack** (widget): `-apple-system, SF Pro Text, Segoe UI, system-ui`
- Base size **13px**; titles 15–18px; labels 11–12px
- Tracking slightly tight (`-0.01em`)

### Shape & depth

| Rule | Value |
|------|--------|
| Radius | **0** — sharp corners everywhere (cards, controls, chips) |
| Border | **0.5px** hairline |
| Shadow | Active nav chip / login card only — light |
| Glass | Header + sidebar only (`.glass-bar` / `.glass-side`) |
| Icon | Inline SVG 14–16px; **no emoji** |

### Motion

- Default: minimal
- Allowed: ≤150–180ms opacity/hover; widget ease `cubic-bezier(.2,.8,.2,1)`
- Honor `prefers-reduced-motion`

### Density

- Table row height ~36–40px
- Page padding 20–24px desktop, 12–16px mobile
- Header height 48–52px
- Sidebar 240px → collapsed 52px

---

## 5. Application shells

### 5.1 Auth shell (`/login`, `/invite/[token]`)

- Full-viewport canvas
- **No** app sidebar, **no** top nav
- Centered card max-width **360–400px**
- Optional micro-footer: Privacy · Contact (12px muted)

### 5.2 Platform shell (`/admin/*`)

```
┌──────────┬────────────────────────────┐
│ Sidebar  │ Top header (48–52px)       │
│ 240px    ├────────────────────────────┤
│          │ Main content               │
│          │                            │
└──────────┴────────────────────────────┘
```

- **No** marketing footer in-app (optional 32px version stamp only)
- Mobile: sidebar → drawer

### 5.3 Merchant shell (`/home`, `/settings`, …)

```
┌──────────┬────────────────────────────┐
│ Sidebar  │ Top header (title)         │
│ 220px    ├────────────────────────────┤
│          │ Main content               │
└──────────┴────────────────────────────┘
```

- Same chrome as platform (`.glass-side` + `.glass-bar`, density)
- Nav: Áttekintés · Beállítások (later: Partnerek, Riportok — keep tiny)
- Never mix platform `/admin` routes into merchant nav
- Mobile: horizontal strip under header (same as platform)

---

## 6. Login & invite — UX spec

### `/login`

**Goal:** 3 seconds to understand and act.

Content (top → bottom):
1. Brand wordmark: `Turinova B2B`
2. Title: `Bejelentkezés`
3. One-line: access by invite only; no public registration
4. Email (autofocus)
5. Password (+ show/hide)
6. Primary: `Belépés` (full width)
7. Text link: forgot password
8. Helper: `Nincs fiókod? Írj nekünk` → mailto / contact URL

**States:**
- Loading: button spinner, fields disabled
- Error: single banner above form (not toast spam)
- Enter submits

**Forbidden:** social login (v1), signup form, feature marketing columns, illustrations.

### `/invite/[token]`

1. Valid → set password (+ confirm) → auto session → role-based redirect (`/admin` or `/home`)
2. Invalid/expired → clear error + ask for new invite
3. Same auth card chrome as login

---

## 7. Platform Admin — UX spec

### Sidebar nav (v1 keep tiny)

| Item | Route | Notes |
|------|-------|--------|
| Tenantok | `/admin` | Primary |
| Beállítások | `/admin/settings` | Platform config — can wait |
| (User) | bottom | Who is logged in |

Max **3–5** items early. Active: 2px accent bar + semibold.

### Top header

- Left: page title **or** breadcrumb (not both cluttered)
- Right: ⌘K search trigger
- Optional: help link
- Sticky, 1px bottom border, surface background

### Command palette (⌘K)

Search: org name, shop name, owner email  
Actions: “Új szervezet”  
Enter → navigate; Esc → close

---

## 8. Platform pages

### 8.1 `/admin` — Tenant list

**Page header (one row):**
- Title: `Tenantok`
- Sub: invite-only + count
- Primary CTA: `Új szervezet`

**Toolbar (one row):**
- Search
- Status filter
- Plan filter
- Persist filters in URL: `?q=&status=&plan=`

**Table columns:**

| Column | Content |
|--------|---------|
| Szervezet | Name + primary email |
| Shop | Shoprenter name / domain |
| Státusz | Chip: trial / active / suspended / needs_reauth |
| Plan | Starter / Pro |
| Widget | él / ki |
| Frissítve | Relative time |
| ⋯ | Row menu |

**Row menu:** Open · Resend invite · Widget on/off · Suspend/Activate · (later Impersonate with confirm)

**Empty state:** One block + CTA — no illustration collage.

**Status chips:**
- `active` → ok
- `trial` → neutral / accent outline
- `suspended` → danger
- `needs_reauth` → warn (actionable)

**Do not** put GMV charts on the list page.

### 8.2 Create org (drawer / modal ~480px)

Single step fields:
1. Organization name  
2. Shoprenter shop name  
3. Store URL  
4. Plan + trial days  
5. Owner email (invite target)  
6. Submit: create + send invite  

Success → org detail + short confirmation.

Prefer **drawer/modal** over a 5-step wizard.

### 8.3 `/admin/orgs/[id]` — Tenant detail

**Tabs:** Áttekintés · Shop · Felhasználók · Usage  

**Áttekintés:** status, plan, trial end, widget health, API health, **one** primary next action  

**Shop:** credential status (never show secrets), origins, `public_id` + publishable key (copy), widget toggle  

**Felhasználók:** email, role, last login, invite pending + invite CTA  

**Usage (optional v1):** 7/30d counts — 3 numbers or one small table, not a dashboard theme  

---

## 9. Interaction & a11y checklist

- [ ] `cursor-pointer` on clickable controls  
- [ ] Visible focus rings  
- [ ] Text contrast ≥ 4.5:1  
- [ ] No emoji icons  
- [ ] Hover ≤150–300ms if any  
- [ ] Responsive: 375 / 768 / 1024 / 1440  
- [ ] Tables: horizontal scroll + sticky first column on mobile  
- [ ] Destructive actions need confirm  

---

## 10. Explicit non-goals (v1)

- Public registration  
- Glass UI / purple SaaS skin  
- Dark-first theme  
- In-app AI assistant  
- Chart-heavy home for platform  
- Merchant and platform menus in one nav  
- Heavy footers inside admin  

---

## 11. Related product decisions (for consistency)

- Multi-tenant **shared DB** for this SaaS (not DB-per-shop)  
- Widget remains separate app (`shoprenter-b2b-quickorder`); portal configures it  
- Portal chrome: **Olvasó** — white canvas, black type, strong borders (`#000` accent). Widget storefront themes remain independent (Papír / Éjjel / …).  
- **Backend plan:** [`SAAS_ARCHITECTURE.md`](./SAAS_ARCHITECTURE.md) · **SQL:** [`DATABASE.md`](./DATABASE.md) (manual migrations only)
- **Commerce sync · Active Partner billing · admin implementation:** [`PLATFORM_AND_ADMIN_IMPLEMENTATION.md`](./PLATFORM_AND_ADMIN_IMPLEMENTATION.md)  

---

## 12. How to use this doc

1. Before adding a UI pattern → check **§2 priorities** and **§3 leave list**  
2. Before new admin page → match **§5 shell** + **§8** density  
3. Before “making it prettier” → ask: does it help speed, compactness, or clarity?  

When implementing, prefer updating this file if a principle changes — don’t silently diverge.
