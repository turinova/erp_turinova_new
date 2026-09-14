# 19 — Supabase auth + SaaS tenancy setup

Ez a lépésről-lépésre útmutató a **modul-app** valódi auth + tenant kötéséhez.

Kapcsolódó: `17-saas-architecture.md`, `10-permissions-and-tenancy.md`.

## 1. Supabase projekt

1. Hozz létre egy projektet (ajánlott régió: EU / Frankfurt vagy ahhoz közeli).
2. **Authentication → Providers → Email** legyen bekapcsolva.
3. Settings → API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Env

```bash
cp .env.example .env.local
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
AUTH_DEV_BYPASS=false
```

Ha az URL + anon key ki van töltve, az app **Supabase Auth**-ot használ (a bypass csak akkor él, ha *nincs* Supabase config).

## 3. Migráció (tenancy táblák + RLS)

Futtasd a Supabase **SQL Editor**-ben, sorrendben:

1. `supabase/migrations/20260310_tenancy_foundation.sql`
2. `supabase/migrations/20260310_tax_rates.sql` (Adónem törzs)
3. `supabase/migrations/20260310_manufacturers.sql` (Gyártók törzs)
4. `supabase/migrations/20260310_equipment.sql` (Berendezés törzs)
5. `supabase/migrations/20260310_edge_materials.sql` (Élzárók)
6. `supabase/migrations/20260310_edge_materials_equipment_id.sql` (élzáró → berendezés FK; meglévő DB-re)
7. `supabase/migrations/20260311_sheet_materials.sql` (Táblás anyagok + `sheet-materials` storage bucket)
8. `supabase/migrations/20260312_customers.sql` (Ügyfelek)
9. `supabase/migrations/20260313_cutting_fees.sql` (Opti vágási díj)
10. `supabase/migrations/20260314_cutting_fees_pricing_mode.sql` (árazási mód)
11. `supabase/migrations/20260315_sheet_waste_multi_default.sql` (waste_multi default)
12. `supabase/migrations/20260316_quotes.sql` (Árajánlatok lean: quotes + panels + árazás)
13. `supabase/migrations/20260317_tenant_companies.sql` (Cégadatok + logo storage)

Létrehoz:

- `tenants`
- `tenant_memberships`
- `is_tenant_member()`, `user_tenant_ids()`, `can_write_tenant()`
- `tax_rates` (tenant-scoped ÁFA kulcsok + RLS)
- `manufacturers` (tenant-scoped gyártók + RLS)
- `equipment` (tenant-scoped berendezések + RLS)
- `edge_materials` (tenant-scoped élzárók + RLS)
- `sheet_materials` (táblás anyagok + RLS; **nincs** élzáró hozzárendelés)
- Storage bucket `sheet-materials` (tenant mappa prefix, max 2 MB kép)
- `customers` (ügyfelek + RLS; **nincs** kedvezmény / SMS / kedvenc)
- `cutting_fees` (Opti vágási díj + pricing_mode)
- `quotes`, `quote_panels`, `quote_material_lines`, `quote_edge_lines` + `generate_quote_number(tenant_id)`
- `tenant_companies` (cégprofil 1:1) + bucket `tenant-company-logos`
- RLS: user csak a saját tagságait / tenantjait olvassa / írja

## 4. Auth user + seed

1. Authentication → Users → **Add user** (email + jelszó).
2. Nyisd meg `supabase/seed.sql`, cseréld az emailt a tiédre.
3. Futtasd az SQL Editorben.

## 5. Próba

```bash
npm run clean   # ha ENOENT / fehér képernyő / MODULE_NOT_FOUND volt
npm run dev     # webpack + polling (T7 USB); turbopack: npm run dev:turbo
# http://localhost:3010/login
```

**Fontos (külső lemez):** a `.next` a projektben marad. Ne symlinkeld tmp-re — a Next onnan nem találja a `node_modules`-t (`react/jsx-runtime` hiba). Lassú USB esetén polling már be van kapcsolva a `dev` scriptben.

- Helyes email/jelszó + membership → `/home`, topbaron a **tenant neve**.
- Auth OK, de nincs membership → `/no-access` (nem „hibás jelszó” — futtasd a seedet!).
- Kijelentkezés törli a sessiont + current tenant cookie-t.

## 6. Mit csinál az app kód

| Fájl | Szerep |
|---|---|
| `src/lib/supabase/*` | SSR / browser / middleware kliens |
| `src/lib/auth/session.ts` | User + aktuális tenant (membership) |
| `src/lib/auth/actions.ts` | Login / logout |
| `src/lib/tenancy/memberships.ts` | Membership lekérdezés |
| `src/app/(auth)/no-access` | Nincs tenant tagság |
| Cookie `modul_current_tenant_id` | Aktuális tenant (későbbi váltóhoz) |

## 7. Még nincs V1-ben (szándékos)

- Self-serve regisztráció / meghívó email
- Tenant váltó UI (több tagság esetén az első aktív)
- Platform admin / impersonation
- `service_role` a Next env-ben (ne tedd ki kliensre)

## 8. Hibaelhárítás

| Tünet | Ellenőrzés |
|---|---|
| „Hibás email vagy jelszó” | Auth user létezik? Confirm email kikapcsolva localhoz? |
| Mindig `/no-access` | Seed lefutott? Email egyezik (`seed.sql`)? Migráció? |
| Fehér képernyő / `ENOENT` / `react/jsx-runtime` | `Ctrl+C` → `npm run clean && npm run dev` (ne symlinkeld a `.next`-et tmp-re) |
| `relation tenants does not exist` | Migráció SQL nem futott le |
| Email not confirmed | Auth settings: disable confirm email localhoz |
