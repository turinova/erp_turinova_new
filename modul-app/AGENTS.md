# AGENTS — modul-app

Cursor / AI agentnek:

1. **Forrásigazság:** `docs/` (kezdőpont: `README.md` → `docs/INDEX.md`).
2. **Szabály fájl:** repo gyökér `.cursor/rules/modul-app.mdc` (alwaysApply).
3. UI stack: **shadcn/ui + Tailwind**, Flat 2.0 tokenek: `src/lib/tokens.css`.
4. UX: certainty-first — lásd `docs/03-ux-certainty-first.md`.
5. ERP/SaaS kritikus kiegészítések: `docs/09-keyboard-and-data-entry.md`, `docs/10-permissions-and-tenancy.md`, `docs/13-numbers-units-formats.md`.
6. **Platform / tenancy / deploy struktúra:** `docs/17-saas-architecture.md` (1 Vercel + 1 Supabase + RLS; nem DB-per-tenant default).
7. **Vizuális north star:** `docs/18-midday-visual-reference.md` — Linear light sűrűség + Midday ritmus; AGPL kód másolás tilos; nincs Midday license fee.
8. **Supabase auth + tenancy:** `docs/19-supabase-setup.md` + `supabase/migrations/`.
9. PR előtt: `docs/07-checklist.md`.
10. Másolható etalon irány: `docs/16-reference-screen.md`.

**Szeparáció:** modul-app külön app. `main-app`, `customer-portal`, `b2b-portal` → csak ötlet (folyamat/domain), **tilos** onnan import / copy-paste. Ne másold Materialize/MUI mintákat. Részlet: `docs/08-separation-boundaries.md`.
