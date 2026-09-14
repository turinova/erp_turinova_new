# Dokumentáció — tartalomjegyzék

| Fájl | Tartalom |
|---|---|
| [00-overview.md](00-overview.md) | Vízió, célcsoport, appok viszonya, alapelvek |
| [01-stack.md](01-stack.md) | Technológiai stack, tiltott libek, legacy csak referencia |
| [02-enterprise-flat-2.0.md](02-enterprise-flat-2.0.md) | Teljes vizuális specifikáció (tokenek, elevation, tipó…) |
| [03-ux-certainty-first.md](03-ux-certainty-first.md) | UX alacsony digitális rutinra / gyenge munkamemóriára |
| [04-components.md](04-components.md) | Kötelező komponensminták (PageHeader, DataTable, FormField…) |
| [05-data-performance.md](05-data-performance.md) | Vercel + Supabase, táblák, query, virtualizáció |
| [06-copy-hungarian.md](06-copy-hungarian.md) | Magyar UX writing szabályok |
| [07-checklist.md](07-checklist.md) | Fejlesztői / PR checklist |
| [08-separation-boundaries.md](08-separation-boundaries.md) | **Külön app** — nincs kód legacy-ból |
| [09-keyboard-and-data-entry.md](09-keyboard-and-data-entry.md) | Billentyűzetes flow, scanner, Excel paste |
| [10-permissions-and-tenancy.md](10-permissions-and-tenancy.md) | Jogosultság, tenant-váltás, impersonation |
| [11-empty-tenant-and-onboarding.md](11-empty-tenant-and-onboarding.md) | Első 20 perc, empty state, import |
| [12-offline-conflict-and-recovery.md](12-offline-conflict-and-recovery.md) | Mentési hiba, draft, konkurens szerkesztés |
| [13-numbers-units-formats.md](13-numbers-units-formats.md) | Pénz, ÁFA, egységek, kerekítés |
| [14-responsive-and-devices.md](14-responsive-and-devices.md) | Desktop / tablet / phone szabályok |
| [15-print-and-documents.md](15-print-and-documents.md) | Print, PDF, címke, fekete-fehér olvashatóság |
| [16-reference-screen.md](16-reference-screen.md) | Lista + űrlap etalon képernyő-spec |
| [17-saas-architecture.md](17-saas-architecture.md) | **Komplett SaaS struktúra** — deploy, tenancy, platform gerinc, DR |
| [18-midday-visual-reference.md](18-midday-visual-reference.md) | **Vizuális north star** — Linear light + Midday ritmus, no AGPL copy |
| [19-supabase-setup.md](19-supabase-setup.md) | **Supabase auth + tenancy** setup (env, SQL, seed) |
| [20-partner-portal.md](20-partner-portal.md) | **Partner portal** — online asztalos, add-on, fázisok |
| [21-platform-ops.md](21-platform-ops.md) | **Platform ops** — 1–2 fős üzem, P0 döntések, admin host |

**Forrásigazság sorrend:** `07-checklist` betartása = a többi doc összefoglalója. Konfliktusnál: overview → ux → **18 vizuális sűrűség** → flat 2.0 színek → stack. Tenancy / deploy: **`17`**. Auth setup: **`19`**. Partner (asztalos): **`20`**. Platform ops: **`21`**.
