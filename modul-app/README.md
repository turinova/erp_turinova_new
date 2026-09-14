# modul-app — Turinova SaaS

Ez a mappa a **modul-app** — egy **teljesen szeparált, új Turinova SaaS alkalmazás** (kód + irányadó dokumentáció).

## Fejlesztés indítása

```bash
cd modul-app
cp .env.example .env.local   # AUTH_DEV_BYPASS=true → demo belépés
npm install
npm run dev                  # http://localhost:3010
```

Belépés fejlesztői módban (ha nincs Supabase env): bármilyen email + jelszó.  
Éles / SaaS auth: lásd [docs/19-supabase-setup.md](docs/19-supabase-setup.md) — URL + anon key, migráció, seed.

## Dokumentáció

Az alábbi docs a stack, UI és UX forrásigazsága.

A `main-app`, `customer-portal` és `b2b-portal` **nem részei** ennek a projektnek: onnan legfeljebb **ötletet** merítünk (folyamat, mezők, mit csináljon egy képernyő). Kódot, komponenst, auth mintát **nem másolunk**.

Minden `modul-app` fejlesztésnél ezek a dokumentumok az irányadók. Konfliktus legacy mintával → **modul-app docs nyer** (de a legacy kódot ne módosítsd modul-app miatt).

## Hol kezdjem?

| Ha… | Olvasd |
|---|---|
| Új vagy a projektben | [docs/00-overview.md](docs/00-overview.md) |
| Legacy appoktól való elhatárolás | [docs/08-separation-boundaries.md](docs/08-separation-boundaries.md) |
| Billentyűzetes adatbevitel | [docs/09-keyboard-and-data-entry.md](docs/09-keyboard-and-data-entry.md) |
| Komplett SaaS architektúra | [docs/17-saas-architecture.md](docs/17-saas-architecture.md) |
| Vizuális north star (Linear light + Midday ritmus) | [docs/18-midday-visual-reference.md](docs/18-midday-visual-reference.md) |
| Supabase auth + tenancy setup | [docs/19-supabase-setup.md](docs/19-supabase-setup.md) |
| Jogosultság / tenancy UX | [docs/10-permissions-and-tenancy.md](docs/10-permissions-and-tenancy.md) |
| Empty tenant / onboarding | [docs/11-empty-tenant-and-onboarding.md](docs/11-empty-tenant-and-onboarding.md) |
| Stack / függőség kérdés | [docs/01-stack.md](docs/01-stack.md) |
| Szín, tipó, gomb, tábla kinézet | [docs/02-enterprise-flat-2.0.md](docs/02-enterprise-flat-2.0.md) |
| „Egyszerű user”, érthetőség | [docs/03-ux-certainty-first.md](docs/03-ux-certainty-first.md) |
| Komponenst építesz | [docs/04-components.md](docs/04-components.md) |
| Lista / nagy adat / Vercel+Supabase | [docs/05-data-performance.md](docs/05-data-performance.md) |
| Magyar feliratok, hibák | [docs/06-copy-hungarian.md](docs/06-copy-hungarian.md) |
| Számok és mértékegységek | [docs/13-numbers-units-formats.md](docs/13-numbers-units-formats.md) |
| Print / PDF | [docs/15-print-and-documents.md](docs/15-print-and-documents.md) |
| Referenciaképernyő-spec | [docs/16-reference-screen.md](docs/16-reference-screen.md) |
| PR / képernyő átadás előtt | [docs/07-checklist.md](docs/07-checklist.md) |
| Teljes tartalomjegyzék | [docs/INDEX.md](docs/INDEX.md) |

## Rövid döntések (nem vitathatók fejlesztés közben)

1. **UI kit:** shadcn/ui + Tailwind (nem MUI, nem Ant Design).
2. **Stílus:** Enterprise Flat 2.0.
3. **UX cél:** bizonyosság-first (certainty > speed of clicks) — alacsony digitális rutinú userekre.
4. **Host / adat:** Vercel + Supabase (ugyanaz a modell, mint most).
5. **Sebesség:** szerveroldali lapozás, keskeny select, kis First Load JS; a bench: `bench/RESULTS.md`.
6. **Rögzített UI döntések:** primary action jobbra; toast jobb alul; destruktív dialog default fókusz `Mégse`.

## Kapcsolódó mérések

A stack választást alátámasztó A/B/C mérés: [`../bench/RESULTS.md`](../bench/RESULTS.md)  
(shadcn First Load JS 131 KB · MUI 174 KB · Ant 350 KB)

## Cursor

A `.cursor/rules/modul-app.mdc` szabály **mindig érvényes** a modul-app és az új SaaS UI munkára: az agentnek ezt a dokumentációt kell követnie.
