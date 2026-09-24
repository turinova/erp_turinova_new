# 22 — Teljesítmény playbook (lightning-fast fenntartás)

**Cél:** a modul-app maradjon **villámgyors** — ne csak egyszer optimalizáljuk, hanem minden PR-nál védjük.

Kapcsolódó:

| Doc | Szerep |
|---|---|
| [05-data-performance.md](05-data-performance.md) | Lista / query / bundle alapszabályok |
| [20-session-snapshot.md](20-session-snapshot.md) | P2 aláírt session cookie részletek |
| [01-stack.md](01-stack.md) | shadcn + TanStack — ne MUI/Ant |
| `scripts/speed-test.mjs` | Mérhető baseline |
| `bench/RESULTS.md` | UI lib bench (shadcn vs MUI/Ant) |

---

## 1) Egy mondatos döntés

> A lassúság **nem a shadcn UI**, hanem az **auth waterfall + multi-roundtrip keresés + `next dev` polling**.  
> Gyorsaság = **kevés DB roundtrip / request** + **aláírt session snapshot** + **1 RPC kereső** + **prod-szerű mérés**.

---

## 2) Mit csináltunk (2026-09) — ne bontsd szét

| Fázis | Mit | Hol | Hatás |
|---|---|---|---|
| **P0** | Lean `/api/kereso` auth (1× getUser) | `kereso-auth.ts`, `api/kereso` | Keystroke auth ~200 ms → ~40–60 ms sáv |
| **P0** | `pg_trgm` + `search_materials_catalog` RPC | migráció `20260421*` | Search SQL ~140 ms → **~77 ms** warm |
| **P0** | Middleware skip heavy auth keresőn | `middleware.ts` | Nincs `isAppSessionValid` keystroke-on |
| **P1** | TanStack Query + 150 ms debounce + `keepPreviousData` | `kereso-client.tsx`, `AppQueryProvider` | Gépelés közben nincs fehér villanás |
| **P2** | HMAC session snapshot cookie (15 perc) | `session-snapshot.ts`, `session.ts` | Entitlement bundle **~146 ms → ~0 ms** hit-en |
| **P2** | Lean middleware ha snapshot OK | `middleware.ts` | Nincs nonce DB check minden navigáción |
| **P2** | Vercel region `dub1` | `vercel.json` | Auth/DB RTT (Ireland ≈ Supabase) |

**Mért baseline (warm, service/auth user, 2026-09):**

| Metrika | Érték |
|---|---:|
| listOrders-shaped | ~79 ms |
| quoteDetail-shaped | ~98 ms |
| Session DB miss (entitlements parallel) | ~146 ms |
| Session snapshot HMAC verify | **~0–1 ms** |
| Kereső legacy 4 query | ~144 ms |
| Kereső RPC | **~77 ms** |

HTTP TTFB-t **`next build && next start`**-tal mérj — **ne** `next dev` + `WATCHPACK_POLLING` alapján ítélj.

---

## 3) Célértékek (fenntartandó)

| Művelet | Cél | Hogyan ellenőrizd |
|---|---|---|
| Lista / megrendelések meleg érzés | **&lt; 300 ms** tartalom | `next start` + Network |
| Kereső keystroke → találat (meleg API) | **≤ 180 ms** (stretch 120) | `/api/kereso` + `Server-Timing` |
| Session snapshot hit | **&lt; 5 ms** local verify | speed-test „snapshot HMAC” |
| Session DB miss (ritka) | **≤ 200 ms** | speed-test „session-parallel” |
| Navigáció staff oldalak között | ne „töltődik 1–2 s” | snapshot cookie jelen van |
| First Load JS (lista shell) | bench közeli | `next build` |

---

## 4) Zárolt architektúra (tilos visszabontani)

### Auth / session

1. **`getSessionUser` snapshot-first** — ne írd vissza „mindig full entitlements”.
2. **`modul_session_v1` + `SESSION_SNAPSHOT_SECRET`** — prod env kötelező.
3. Middleware: ha snapshot érvényes → **ne** hívj `isAppSessionValid` + membership query-t.
4. Single-login (`app_user_sessions` nonce) **marad** — snapshot `nonce` mezővel kötve.
5. Impersonation: **ne** cache-elj hosszú snapshotot (DB path).

### Kereső

1. Preferáld a **`search_materials_catalog` RPC**-t; legacy 4 query csak fallback.
2. `/api/kereso`: **`resolveKeresoAuth`** — ne `getSessionUser` + `getPartnerSession` párost.
3. Partner settings: **60 s memory cache** OK; invalidálás mentéskor.
4. Debounce **≤ 150 ms**; TanStack Query `staleTime` + `placeholderData`.

### Adat

1. Lista default **limit 25**; nincs `select('*')`.
2. URL: `page` / szűrő state.
3. Soft delete: `.is('deleted_at', null)`.
4. ILIKE kereséshez **trigram index** (lásd `20260421`).

### Mérés

1. Sebességet **`npm run build && npm run start`**-tal ítélj.
2. `npm run dev` + `WATCHPACK_POLLING` (T7) → **torz** (másodperces compile).
3. Speed-test: `npm run speed-test` (`scripts/speed-test.mjs`).

---

## 5) Kritikus fájlok (térkép)

```
src/lib/auth/session.ts              ← snapshot-first SessionUser
src/lib/auth/session-snapshot.ts     ← HMAC sign/verify
src/lib/auth/kereso-auth.ts          ← lean kereső auth
src/lib/auth/actions.ts              ← login írja a snapshotot
src/lib/supabase/middleware.ts       ← lean path + kereső skip
src/lib/search/materials-search.ts   ← RPC + legacy fallback
src/app/api/kereso/route.ts          ← Server-Timing
src/components/search/kereso-client.tsx
src/components/providers/app-query-provider.tsx
supabase/migrations/20260421*.sql
vercel.json                          ← regions: ["dub1"]
```

---

## 6) PR checklist — teljesítmény

Új feature / refaktor előtt:

- [ ] Új listán: limit 25, keskeny select, URL page/szűrő?
- [ ] Hozzáadtál-e **új** `getSessionUser` / entitlement query-t hot pathre? (layout, middleware, API keystroke) → **kerüld**
- [ ] Keresés / typeahead: 1 RPC vagy max 1–2 query? Nem 4× parallel ILIKE index nélkül?
- [ ] Snapshot invalidálás, ha jogot / tenantot változtatsz?
- [ ] Nehéz lib (excel / pdf / chart): dynamic import, nem shell?
- [ ] Mértél `next start`-tal vagy csak `dev`-vel?
- [ ] Speed-test érintett céljai még PASS?

Részletes UI checklist: [07-checklist.md](07-checklist.md).

---

## 7) Hogyan mérj (parancsok)

```bash
cd modul-app

# DB path + snapshot microbench + kereső RPC
npm run speed-test

# Prod-szerű HTTP (szerver fut + cookie)
npm run build && npm run start
# másik terminál:
SPEED_TEST_BASE_URL=http://localhost:3010 \
SPEED_TEST_COOKIE='...' \
npm run speed-test
```

Kereső API böngészőben: Network → `/api/kereso` → **Server-Timing**: `auth`, `search`, `total`.

---

## 8) Tipikus regressziók (amit már láttunk)

| Tünet | Gyakori ok | Fix irány |
|---|---|---|
| Minden oldal 1–3 s | Snapshot cookie hiány / secret mismatch / TTL | Login újra; `SESSION_SNAPSHOT_SECRET` egyezzen |
| `session_replaced` / `nonce_*` spam | Nonce DB ≠ cookie; Safari stale; 2 eszköz | Bootstrap login; cookie wipe; reason-specifikus UI |
| Kereső 500 `id is ambiguous` | Régi RPC a DB-ben | Futtasd `20260421b_…fix.sql` |
| Kereső lassú, de RPC OK | Újra full `getSessionUser` az API-n | Maradj `resolveKeresoAuth`-nál |
| „Lassú app” csak laptopon | `next dev` + polling + hideg compile | `next start` |
| Partner kereső üres | RLS / partner settings | Policy + Online partner beállítások |

---

## 9) Mit *ne* csinálj „gyorsítás” címén

- UI lib csere (MUI/Ant) — a bench szerint a shadcn a gyorsabb irány.
- Teljes Linear sync engine V1-ben.
- Service role a böngészőből.
- Snapshot TTL ∞ / aláírás nélkül (biztonsági lyuk).
- Middleware-ből teljes entitlements betöltés „biztos ami biztos”.
- Dev polling sebességét prod SLA-nak tekinteni.

---

## 10) Következő opcionális lépések (ha kell még)

Csak ha a fenti célok **már** tartanak, és még kell:

1. Partner lean snapshot (staff mintájára)
2. `getUser` költség csökkentése (rövidélű „auth ok” hint — óvatosan)
3. További listák TanStack Query + `placeholderData`
4. Read-heavy törzs local snapshot (P3 — nagy beruházás)

---

## 11) Összefoglaló a jövőbeli énnek

Ha az app „megint lassú”:

1. **`next start`** vagy Vercel preview — nem dev.
2. Van-e **`modul_session_v1`** cookie login után?
3. Kereső: **Server-Timing** + RPC él-e a DB-ben?
4. Nem került-e vissza **full session bundle** a layout/middleware/API hot pathre?
5. Futtasd: `npm run speed-test` — hasonlítsd a §2 táblához.

**A gyorsaság nem feature flag — architektúra-döntés.** Ezt a docot PR review-nál idézd.
