# 05 — Adat és teljesítmény (Vercel + Supabase)

A UI lib csak ~15–25%-ot ad a listaérzethez. A többi **adatút**.

## Célértékek (orientáció)

| Művelet | Cél |
|---|---|
| Lista első tartalom (meleg) | < 300 ms érzés (skeleton azonnal) |
| Lapváltás | előző adat marad (`placeholderData`), nincs fehér villanás |
| First Load JS (lista shell) | tartsd a bench közeli sávban (~130 KB irány) |
| Default page size | **25** (UI max 50) |

## Szerveroldali lista — kötelező minta

```
URL: /resources?page=2&q=blum&status=active&limit=25

1) keskeny select (csak oszlopok)
2) filter + order
3) range((page-1)*limit, page*limit - 1)
4) total: külön, cache-elve ha drága
```

**Tilos:**

- `select('*')` listán
- limit 100 default
- kliensoldali szűrés 10k+ soron
- végtelen scroll admin listában

## TanStack Query

```ts
staleTime: 30_000 // listáknál tipikusan
placeholderData: keepPreviousData // lapváltáskor
```

- Prefetch következő lap hoverre / idle-ben, ha olcsó.
- Mutáció után: érintett query invalidálás — ne az egész app.

## Virtualizáció

- Lapozott 25–50 sor: **nem kell** virtual.
- Opti / nagy grid / több száz DOM sor egy nézetben: `@tanstack/react-virtual`.
- Soha ne renderelj 2000 `<tr>`-t „majd a böngésző bírja”.

## Komponens / bundle fegyelem

- Chart, PDF, Three, nehéz editor: **dinamikus import** csak az adott oldalon.
- Lucide: név szerinti import, ne egész pack.
- Ne húzz be MUI/Ant „egyetlen komponensért”.

## Óriás Client fájlok

Több ezer soros `*Client.tsx` = lassú parse + karbantarthatatlan.

Szabály: új / migrált oldal:

- page (RSC) → adatfetch ahol lehet
- list / form / dialog külön fájl
- nehéz panel: `dynamic(() => import(...))`

## Vercel

- `compress: true`, static cache a `_next/static`-ra
- API listák: inkább `no-store` auth-os adatoknál; nyilvános master data rövid `s-maxage`
- Kerüld a felesleges Edge/Node hopot: region a DB közelében

## Supabase

- Index: `deleted_at`, gyakori filter, `created_at` / name search (trigram ha kell)
- Soft delete: minden listán `.is('deleted_at', null)`
- Ne service-role-ozz a böngészőből
- Összetett írás: RPC / transaction a szerveren

## Mérés

Új nehéz oldal előtt: Next build First Load JS + egy manuális lassú hálózatos próba.  
Stack összehasonlítás: `bench/` mappa.
