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
| [20-session-snapshot.md](20-session-snapshot.md) | **P2 session snapshot** — aláírt cookie, lean middleware |
| [20-partner-portal.md](20-partner-portal.md) | **Partner portal** — online asztalos, add-on, fázisok |
| [21-platform-ops.md](21-platform-ops.md) | **Platform ops** — 1–2 fős üzem, P0 döntések, admin host |
| [22-performance-playbook.md](22-performance-playbook.md) | **Lightning-fast fenntartás** — P0–P2 döntések, mérés, regresszió |
| [23-lapszabaszat-addon.md](23-lapszabaszat-addon.md) | Lapszabászat add-on — entitlements, nav, deps |
| [24-beszerzes-workflow.md](24-beszerzes-workflow.md) | **Beszerzés workflow** — beszállító → rendelés → beérkezés → készlet; edge case-ek |
| [25-warehouses.md](25-warehouses.md) | Raktárak MVP |
| [26-beerkezesek.md](26-beerkezesek.md) | Beérkezések + stock receive |
| [27-keszlet-atadasok.md](27-keszlet-atadasok.md) | **Áttárolás + mozgások** — azonnali transfer, ledger lista |
| [28-ertekesites-workflow.md](28-ertekesites-workflow.md) | **Értékesítés** — manuális sale, kedvezmény, fizetés, stock out; POS/webshop-ready |
| [29-pos-workflow.md](29-pos-workflow.md) | **POS** — scanner-first till, channel=pos, P0+P1 |

**Forrásigazság sorrend:** `07-checklist` betartása = a többi doc összefoglalója. Konfliktusnál: overview → ux → **18 vizuális sűrűség** → flat 2.0 színek → stack. Tenancy / deploy: **`17`**. Auth setup: **`19`**. Partner (asztalos): **`20-partner-portal`**. Session snapshot: **`20-session-snapshot`**. Platform ops: **`21`**. Teljesítmény: **`22`** (+ `05`). Beszerzés domain: **`24`**.
