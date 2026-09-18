# 18 — Vizuális north star (Linear light + Midday ritmus)

**Zárolt céges döntés**

> A modul-app **saját** shadcn + Tailwind UI.  
> **Sűrűség / tipó / „tool” hangulat:** Linear **light** mód.  
> **Shell arányok:** Midday-szerű ritmus (minta, nem kód).  
> **Primary:** Midday charcoal `#18181B` (nem kék). Light-first, magyar copy.  
> **Nav:** monokróm slate — tilos szivárvány accent.  
> **Licenc:** nincs Midday commercial fee; **tilos** Midday/Cal/Dub product UI forráskód átvétele (AGPL kockázat). Linearnak nincs publikus repo — nem másolható kódból.

## Mit jelent rétegenként

| Réteg | Forrás | Szabály |
|---|---|---|
| Sűrűség, tipó, hairline, kompakt kontroll | **Linear light** (megjelenés) | Primer vizuális cél |
| Sidebar / topbar arány, nav aktív állapot | **Midday** ritmus (GitHub *olvasás*) | Minta → saját kód |
| Primary, logo, certainty UX | Midday charcoal + `03` | Sidebar **mindig expanded**; monokróm nav |
| Stack / sebesség | shadcn + `05` | Lightning fast, kis bundle |

## Licenc stratégia (kötelező)

| Tevékenység | Engedélyezett? |
|---|---|
| Midday / Linear **screenshot**, nyilvános UI nézése | Igen |
| Midday GitHub **olvasása** ritmusért | Igen |
| Midday / más AGPL product **fájl másolása** `modul-app/src`-be | **Nem** |
| Midday commercial license vásárlás | Nem kell (policy: saját UI) |
| Linear forráskód 1:1 | Lehetetlen — nincs publikus repo |

## Sűrűség (Linear light → saját token)

| Elem | Cél |
|---|---|
| Body | ~13.5–14px |
| H1 oldalcím | ~18–20px / 600 |
| Gomb default | **md** (~32–36px), nem 44px |
| Topbar | ~52–56px |
| Sidebar | ~220–240px, mindig nyitva |
| Nav sor | ~32–36px |
| Oldal padding | `px-4` / `md:px-6`, szekció `p-4` |
| Aktív nav | **erősebb** soft (`--nav-slate-soft` ≈ zinc-200) + charcoal bal sáv (4px) + semibold label; monokróm, nem színes soft blokk |

Tokenek: `src/lib/tokens.css`. Tipó override a Flat 2.0 „comfortable 15px” helyett: **ez a doc + token a sűrűség forrásigazsága**.

## Certainty eltérések (szándékos)

1. Sidebar mindig expanded — nem Midday/Linear hover-collapse.  
2. Gyakori akció szöveggel látszik — nem csak shortcut.  
3. Egy primary / képernyő; toast jobb alul.  
4. Light-only V1.

## Lightning fast (kötelező)

- shadcn / saját UI — tilos MUI/Ant új kódban  
- Lista limit 25, keskeny `select`, URL page/szűrő (`05`)  
- Egy font család (Inter), kevés súly  
- Vercel + Supabase közel ugyanabban a régióban  

## Agent / fejlesztő

1. UI előtt: ez a doc + `02` + `03`.  
2. Sűrűbb Linear light; shell Midday arány — **saját komponens**.  
3. Konfliktus: certainty > vizuális másolat.  
4. PR: ne legyen „linagyolt” padding / 44px default gomb listákon.

## Kapcsolódó

- `02-enterprise-flat-2.0.md` — szín / gomb variánsok / tiltások  
- `03-ux-certainty-first.md`  
- `05-data-performance.md`  
- `17-saas-architecture.md`  
