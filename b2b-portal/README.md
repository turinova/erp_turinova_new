# B2B Portal (`b2b.turinova.hu`)

Invite-only multi-tenant SaaS: merchant portal + platform admin + **storefront widget** (egy Next app).

## Dokumentáció (olvasási sorrend)

1. [`docs/SAAS_ARCHITECTURE.md`](./docs/SAAS_ARCHITECTURE.md) — komplett SaaS terv, edge case-ek, fázisok  
2. [`docs/DATABASE.md`](./docs/DATABASE.md) — **manuális SQL** futtatás + séma  
3. [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) — UI  
4. [`sql/README.md`](./sql/README.md) — migráció lista  

## Fejlesztés (egy terminál)

```bash
cd b2b-portal
npm install
cp .env.example .env.local   # töltsd ki DATABASE_URL-t a SQL után
npm run dev
```

→ http://localhost:3030  
→ Widget: http://localhost:3030/widget.js (+ `/api/products/*`, `/api/orders/*`)

A régi `shoprenter-b2b-quickorder` (port 3020) nem kell a napi teszthez — a widget a portalból fut.

## Widget install (Shoprenter)

Merchant **Beállítások** → másold az install snippetet. Lényeg:

```html
<script>
window.SR_B2B_QUICKORDER = {
  apiBase: "http://localhost:3030",
  shopId: "<shops.public_id>",
  allowedGroupIds: [],
  requireLogin: true,
  buttonLabel: "Gyors rendelés"
};
</script>
<script src="http://localhost:3030/widget.js" defer></script>
```

Prod: `apiBase` = `https://b2b.turinova.hu` (vagy a tunnel URL).

## Adatbázis — fontos

Az SQL fájlokat **te futtatod** (Supabase SQL Editor / `psql`).  
Az app **nem** migrál automatikusan.

```text
sql/001_extensions_and_helpers.sql
sql/002_tenancy_auth.sql
sql/003_shops_and_credentials.sql
sql/004_widget_settings.sql
sql/005_audit_events.sql
sql/006_rls_policies.sql
sql/007_seed_platform_admin.sql   ← előtte: npm run hash-password
```

Platform admin jelszó hash:

```bash
npm run hash-password -- "A_JELSZAVAD"
# másold a hash-t a 007 fájlba, majd futtasd a SQL-t
```

Kulcsok:

```bash
openssl rand -hex 32   # → CREDENTIALS_ENCRYPTION_KEY
openssl rand -hex 32   # → SESSION_SECRET
```

DB health (SQL után):

```bash
curl -s http://localhost:3030/api/health/db
```

## Struktúra

```
docs/                  → architektúra + DB + design
sql/                   → manuális migrációk
public/widget.js       → storefront widget
src/app/api/products/  → widget resolve/search
src/app/api/orders/    → widget parse/export/orders
src/lib/shoprenter/    → Shoprenter client + shopId resolve
src/lib/db.ts          → pg pool + RLS tenant context
src/lib/auth/          → password, tokens, session
src/lib/crypto/        → shop credential encryption
src/types/db.ts        → row types
```

## Állapot

- [x] UI váz (liquid glass shells)
- [x] SaaS + DB dokumentáció
- [x] Manuális SQL 001–007
- [x] db client + encrypt + password helpers
- [x] Auth: login / logout / session / guards / invite accept
- [x] Platform: Új szervezet drawer + DB lista + resend invite
- [x] Merchant: shop creds mentés (AES) + kapcsolat ping + widget settings
- [x] Widget a portalban (`shopId` = public_id) — egy `npm run dev`
- [ ] Invite email provider (most: link másolás)
