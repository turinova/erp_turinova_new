# 08 — Szeparáció: modul-app vs legacy appok

**Zárolt döntés.** Ez a dokumentum a legfontosabb architekturális határ.

## modul-app = teljesen külön alkalmazás

A `modul-app` **nem** a `main-app`, `customer-portal` vagy `b2b-portal` átdolgozása, bővítése vagy UI-csomagja.

| | modul-app | main-app / customer-portal / b2b-portal |
|---|---|---|
| Kódbázis | Saját `modul-app/` mappa, saját `package.json` | Meglévő, érintetlen |
| Deploy | Saját Vercel projekt / domain | Meglévő deploy marad |
| Auth / cookie / middleware | Saját, nulláról | Nem másoljuk át |
| UI stack | shadcn + Tailwind + Flat 2.0 | MUI / Materialize / vegyes — **nem hozzuk át** |
| Komponensek | Saját `src/components/` | **Nincs import** legacy-ból |
| Design system | `modul-app/docs/` + `src/lib/tokens.css` | Csak **ötlet**, nem forrás |

## Mit jelent: „csak ötlet merítés”

A legacy appokból **engedett**:

- Üzleti folyamat megértése (pl. rendelés felvétel lépései)
- Mezőnevek / domain fogalmak (magyar UI copy irány)
- „Mit csinál ez a képernyő?” — funkcionális követelmény
- Tanulság: mi nem működött (túl sűrű UI, rejtett akciók, limit 100…)

**Tilos** legacy-ból modul-app-ba:

- Fájl / komponens / hook **másolás** vagy symlink
- `@/` import más app mappájából
- Közös `packages/ui` a három régi apppal (nincs ilyen terv)
- Materialize / MUI theme, layout, menü struktúra átvétele „gyorsítás” címén
- Ugyanaz a Supabase auth cookie / middleware minta „mert már működik”
- „Migráljuk át ezt az oldalt” = copy-paste refaktor

**Szabály:** ha valami a legacy-ból jön, **újraírjuk** modul-app elvek szerint; legfeljebb a viselkedés legyen hasonló, a kód soha.

## Repo elrendezés (szándék)

```
erp_turinova_new/
  modul-app/          ← ÚJ, önálló SaaS app (ez a jövő)
  main-app/           ← legacy, referencia
  customer-portal/    ← legacy, referencia
  b2b-portal/         ← legacy, referencia
  bench/              ← stack mérés (nem production app)
```

A mappák **egy git repóban** lehetnek, de **nem egy alkalmazás**. Nincs shared runtime dependency köztük.

## Agent / fejlesztő szabály

1. `modul-app/**` munkánál **csak** `modul-app/docs/` az irányadó.
2. Legacy mappák megnyitása = olvasás ötletért; **ne írj oda** modul-app kódot.
3. PR modul-app-ban: ne tartalmazzon importot `../main-app`, `../customer-portal`, stb.
4. Konfliktus (legacy minta vs modul-app doc) → **modul-app doc nyer**; legacy-t ne „javítsd” modul-app miatt.

## Mi NEM cél

- main-app és customer-portal UI **egységesítése** egy közös libben
- Fokozatos „átköltöztetés” file-by-file
- Ugyanaz a Vercel rewrite / cookie domain megosztás a régi appokkal (modul-app külön élet)

## Mi a cél

- Tiszta, gyors, certainty-first SaaS admin **új alapokon**
- Legacy csak **domain tudás** forrása, amíg az új modulok meg nem íródnak

Ha később üzletileg lecserélitek a régi appot: az **külön projekt / cutover**, nem implicit ebből a mappából.

A teljes SaaS platformstruktúra (1 Vercel, 1 Supabase, RLS, platform gerinc): **`17-saas-architecture.md`**.
