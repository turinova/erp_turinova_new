# 01 — Technológiai stack

## Döntés (zárolt)

| Réteg | Választás | Indok |
|---|---|---|
| Framework | **Next.js 15+** (App Router) | Meglévő tudás, Vercel natív |
| UI | **shadcn/ui + Tailwind CSS** | Legkisebb First Load JS a benchben; teljes kontroll; Flat 2.0 könnyen tokenizálható |
| Ikon | **Lucide** (outline) | Egy stílus, shadcn default |
| Tábla logika | **TanStack Table** + saját shell | Oszlopok / state; kinézet Flat 2.0 |
| Nagy lista DOM | **TanStack Virtual** ha kell | Csak látható sorok |
| Server state | **TanStack Query** | Cache, `placeholderData`, prefetch |
| URL state | **nuqs** vagy Next `searchParams` | Szűrő + page a URL-ben |
| Auth / DB | **Supabase** | Meglévő multi-tenant modell |
| Host | **Vercel** | Meglévő deploy |

### Bench bizonyíték (ugyanaz a lista oldal, 5000 sor, +80ms Supabase RTT szimuláció)

| Stack | First Load JS | HTML TTFB |
|---|---:|---:|
| **shadcn + Tailwind** | **131 KB** | ~8 ms |
| MUI 6 (lean) | 174 KB | ~10 ms |
| Ant Design 5 | 350 KB | ~70–217 ms |

Részlet: [`../../bench/RESULTS.md`](../../bench/RESULTS.md)

**Következtetés:** Ant Design **lassabb**, mint a jelenlegi lean MUI. shadcn a nyerő. A `main-app` Materialize sablon még a lean MUI-nál is nehezebb — a sablont nem visszük tovább.

## Tiltott / kerülendő új függőségek

| Tilos új feature-ben | Miért |
|---|---|
| `@mui/*`, Emotion mint UI alap | Bundle + CSS-in-JS; legacy |
| `antd`, `@ant-design/*` | Nehéz First Load + lassú SSR |
| AG Grid (kivéve külön üzleti döntés) | Licence + stílusharc |
| Több ikonkészlet keverve (Remix + MUI + Lucide) | Inkonzisztens |
| GSAP / Three.js dashboard layoutban | Felesleges súly |
| Végtelen scroll listákban | Elveszett pozíció, gyenge certainty |

## Ajánlott package mag (modul-app)

```
next
react react-dom
tailwindcss
class-variance-authority clsx tailwind-merge
lucide-react
@tanstack/react-query
@tanstack/react-table
@tanstack/react-virtual
@supabase/supabase-js @supabase/ssr
nuqs   # opcionális, ajánlott
zod    # validáció
react-hook-form @hookform/resolvers  # űrlapok
sonner vagy saját toast  # Flat 2.0 toast szabályokkal
```

shadcn komponenseket a CLI-vel / másolással a `src/components/ui` alá tesszük, majd **Flat 2.0 tokenekre** igazítjuk (`04-components.md`).

## Architektúra irány

```
modul-app/
  src/
    app/                 # Next App Router
    components/
      ui/                # shadcn primitives (Button, Input…)
      patterns/          # PageHeader, DataTable, FormField, StatusBadge…
    lib/
      tokens.css         # Flat 2.0 CSS változók
      supabase/
    hooks/
  docs/                  # EZ a dokumentáció
```

**Nincs** közös `packages/ui` a legacy appokkal (`main-app`, `customer-portal`, `b2b-portal`). A modul-app design system **csak** a `modul-app/src/` alatt él. Lásd: `08-separation-boundaries.md`.

## Vercel + Supabase szabályok (stack szint)

1. Region: Vercel funkció **közel** a Supabase projekthez.
2. Lista API: `range` / cursor + **limit default 25** (max 50 UI-ból).
3. `select` csak a listához kellő oszlopok — ne `*`.
4. Exact `count` drága: ha nem kell pontos összesen minden kattintásra, cache / approximate / ritkább frissítés.
5. RLS + index a szűrt / rendezett oszlopokra.
6. Érzékeny művelet: server route / RPC, ne csak kliens „rejtsen” gombot.

Kapcsolódó részletes doksik:

- `05-data-performance.md`
- `10-permissions-and-tenancy.md`
- `12-offline-conflict-and-recovery.md`
- `13-numbers-units-formats.md`
- `14-responsive-and-devices.md`
- `17-saas-architecture.md` — komplett SaaS / tenancy / deploy struktúra

## Legacy appok (csak referencia)

- Olvasd a régi appot **funkció megértéséhez**, ne másold a kódját.
- Új képernyő modul-app-ban: **nulláról** shadcn + docs szerint.
- Ne importálj `../main-app`, `../customer-portal`, `../b2b-portal` útvonalat.
- Óriás legacy `*Client.tsx` fájlok **nem sablonok** — csak tanulság: szét kell vágni route / panel szerint az új appban.

## Referenciaképernyő

Az első valódi modul-app képernyők előtt készüljön legalább egy lista- és egy űrlap-etalon a `16-reference-screen.md` szerint. Ez fontosabb, mint újabb elméleti komponensvariánsok kitalálása.
