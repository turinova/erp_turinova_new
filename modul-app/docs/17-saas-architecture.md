# 17 — Komplett SaaS architektúra

Ez a dokumentum a **modul-app** platform-struktúrájának forrásigazsága: mi miből áll, hol fut, ki kivel beszél, hogyan izolálódnak a cégek, és milyen platform-szolgáltatások tartják életben a SaaS-t.

**Nem** táblamező-spec. A konkrét séma (oszlopok, típusok, indexek) külön migration / schema docban jön. Itt a **teljes rendszerkép** a döntés.

Kapcsolódó docok:

| Téma | Doc |
|---|---|
| Vízió, célcsoport | `00-overview.md` |
| Stack | `01-stack.md` |
| Szeparáció legacy-tól | `08-separation-boundaries.md` |
| Jogosultság UX | `10-permissions-and-tenancy.md` |
| Onboarding | `11-empty-tenant-and-onboarding.md` |
| Offline / conflict | `12-offline-conflict-and-recovery.md` |
| Adat / perf | `05-data-performance.md` |

---

## 0. Egy mondatos döntés

> **Egy Vercel alkalmazás + egy Supabase projekt + shared multi-tenant (RLS) + platform gerinc (auth, membership, billing állapot, audit, tenant backup tooling).** Az üzleti ERP modulok erre épülnek. A legacy appoktól teljesen elválasztva.

Célméret induláskor: **~40–50 tenant**, **~4–5 user / tenant** (~200–250 user összesen).

---

## 1. Termékpozíció a repóban

```
erp_turinova_new/
  modul-app/          ← ÚJ SaaS (ez a jövő) — saját deploy, saját stack
  main-app/           ← legacy referencia
  customer-portal/    ← legacy referencia
  b2b-portal/         ← legacy referencia
  bench/              ← stack mérés, nem production
  admin-portal/       ← legacy DB-per-tenant minta (tanulság, nem default)
```

| App | Kapcsolat |
|---|---|
| **modul-app** | Önálló SaaS admin — saját Vercel, saját Supabase használat, saját auth |
| `main-app` / `customer-portal` / `b2b-portal` | **Csak ötlet** (folyamat, domain). Nincs import, nincs shared UI package |
| `admin-portal` + shop DB-per-tenant | **Tanulság:** mikor kell külön DB; **nem** a modul-app default modellje |

Részlet: `08-separation-boundaries.md`.

**Cutover** a régi appokról később külön projekt / üzleti döntés — nem implicit fájlmigráció.

---

## 2. Deploy topológia

### 2.1 Zárolt irány (MVP → 50 tenant)

| Réteg | Darab | Technológia | Szerep |
|---|---|---|---|
| Frontend + BFF | **1×** | Vercel · Next.js App Router | UI, middleware, Server Actions / Route Handlers |
| Adat + Auth + Storage | **1×** | Supabase projekt | Postgres, Auth, Storage, (opcionális Edge Functions) |
| CDN / edge | Vercel | Region a Supabase-hez közel | Static + edge |
| Email | 1 szolgáltató | Resend / Supabase Auth email | Meghívó, jelszó, értesítés |
| Ütemezett feladatok | 1–2 | Vercel Cron és/vagy Supabase scheduled | Snapshot, billing sync, cleanup |
| Megfigyelés | később kötelező | Sentry + Vercel Analytics (vagy ekvivalens) | Hiba, perf |

### 2.2 Egy ábrán

```
                         DNS / CDN
                              │
                  ┌───────────▼───────────┐
                  │  Vercel · modul-app   │
                  │  Next.js (1 deploy)   │
                  │  middleware · API     │
                  └───────────┬───────────┘
                              │
             session · tenant context · server checks
                              │
                  ┌───────────▼───────────┐
                  │ Supabase (1 projekt)  │
                  │ Auth · Postgres+RLS   │
                  │ Storage · Cron/jobs   │
                  └───────────────────────┘
                              │
            tenants · memberships · üzleti adatok
            audit · soft delete · tenant snapshots
```

### 2.3 Mit NEM építünk induláskor

- 50 külön Supabase projekt (DB-per-tenant az összes ügyfélnek)
- Közös cookie domain / Vercel rewrite a legacy appokkal
- Monorepo shared `packages/ui` a régi appokkal
- Külső „multi-tenant middleware SaaS” a saját RLS helyett

### 2.4 Region szabály

Vercel funkció **ugyanabban a régióban** (vagy a legközelebb), ahol a Supabase Postgres fut. Lista-képernyők RTT-érzékenyek — lásd `05-data-performance.md` és `bench/RESULTS.md`.

---

## 3. Környezetek (environments)

| Env | Vercel | Supabase | Cél |
|---|---|---|---|
| **local** | `localhost` | local Supabase vagy dedicated branch | Fejlesztés |
| **staging** | staging URL | külön staging projekt (ajánlott) | UAT, demo |
| **production** | app domain | production projekt | Élő tenantok |

Szabályok:

1. Production migráció **csak** review után, egy pipeline-ból.
2. Staging adat: anonimizált / seed — ne éles ügyféladat másolás engedély nélkül.
3. Feature flag opcionális; tenant-szintű flag később (plan / beta).

---

## 4. Multi-tenancy modell

### 4.1 Alapmodell: shared schema + tenant izoláció

```
Users (Supabase Auth)
        │
        │  N:M
        ▼
Memberships  ──────────►  Roles (tenant-en belül)
        │
        ▼
     Tenants
        │
        ▼
  Üzleti adatok (minden sor tenant-hez kötve)
  RLS: a JWT / session alapján csak a saját tenant látszik
```

**Zárolt elvek:**

1. Egy app, egy production DB, **shared schema**.
2. Izoláció = **tenant kötés + RLS** (nem „majd a kliens szűr”).
3. User **több tenant** tagja lehet.
4. Az **aktuális tenant** mindig egyértelmű a UI-ban (topbar).
5. Kliensoldali gombrejtés = ergonómia; **szerver + RLS** = security.

### 4.2 Miért nem DB-per-tenant default?

A meglévő `admin-portal` minta (külön Supabase projekt / tenant) előnyös **natív per-tenant restore** és erős fizikai izoláció szempontjából, de 40–50 tenantnál:

| Szempont | Shared + RLS | DB / tenant |
|---|---|---|
| Költség | 1 projekt | ~50 projekt |
| Migráció | 1 pipeline | 50× futtatás / tracking |
| Feature roll-out | egyszer | N-szer |
| Natív 1-tenant restore | nem | igen |
| Ops komplexitás | alacsony | magas |

**Döntés:** shared + RLS default. DB-per-tenant csak **explicit üzleti indokkal** (lásd 4.3).

### 4.3 Hybrid (későbbi opció)

```
95% tenant  →  shared Supabase + RLS
1–2 whale   →  külön Supabase projekt (compliance / külön restore SLA)
```

A Next appnak tenant config alapján kell tudnia: *shared connection* vs *dedicated connection string*. Ez **nem** MVP kötelező — de az architektúra ne zárja ki (tenant rekordban „deployment mode” koncepció).

### 4.4 Tenant azonosítás a kérésben

Két elfogadható routing minta (döntés külön zárolható; a struktúra mindkettőt bírja):

| Minta | Példa | Előny | Hátrány |
|---|---|---|---|
| **Subdomain** (preferált hosszú távon) | `acme.app.example.com` | Egyértelmű kontextus, bookmark barátságos | DNS / wildcard SSL |
| **Path prefix** | `app.example.com/t/acme/...` | Egyszerűbb indulás | URL zaj, könnyebb eltéveszteni |

Közös szabályok mindkettőnél:

- Login után, ha a usernek **1** tagsága van → automatikus belépés abba a tenantba.
- Ha **több** → tenant választó, majd redirect a választott kontextusba.
- Tenant slug / id a sessionben is legyen (ne csak URL-ből „találd ki” minden requestnél megbízhatatlanul).
- Platform admin felület **nem** ügyfél-tenant slug alatt él (külön path vagy külön host).

### 4.5 Tenant életciklus (állapotok)

Üzleti állapotok, amelyek a **struktúra** részei (UX: `10` + `11`):

| Állapot | Jelentés | Tipikus UI hatás |
|---|---|---|
| `provisioning` | Létrejön, seed / checklist | Vezetett onboarding |
| `active` | Fizető / használható | Teljes app |
| `read_only` | Pl. lejárat utáni türelmi | Írás tiltva + banner |
| `suspended` | Felfüggesztve | Belépés korlátozott / üzenet |
| `churned` / archivált | Megszűnt | Nincs normál belépés; export megőrzés policy szerint |

A user mindig tudja: **mi történt, mire hat, mit tehet most** (certainty-first).

---

## 5. Identitás, tagság, jogosultság

### 5.1 Rétegelt ellenőrzés

```
Browser
  → Vercel middleware (van érvényes session?)
    → App shell (aktuális tenant látszik? membership?)
      → UI (rejt navigációt / tilt akciót magyarázattal)
        → Server Action / Route Handler (role + tenant check)
          → Supabase (JWT + RLS)
```

Ha bármelyik réteg elbukik: **érthető magyar hiba**, nem silent fail.

### 5.2 Fogalmak

| Fogalom | Jelentés |
|---|---|
| **User** | Auth identitás (email, session) |
| **Tenant** | Ügyfélcég / előfizető |
| **Membership** | User ↔ Tenant kapcsolat + szerepkör(ök) |
| **Role** | Tenant-en belüli jogosultságkészlet |
| **Platform admin** | Turinova belső szerep — nem ügyfél-membership |

### 5.3 Szerepkörök (UI név)

Emberi magyar nevek a felületen (`10-permissions-and-tenancy.md`):

- Tulajdonos
- Adminisztrátor
- Irodai munkatárs
- Műhely
- Pénzügy
- Csak megtekintés

Nyers technikai kulcs **ne** jelenjen meg a UI-ban.

### 5.4 Navigáció vs akció

- **Navigáció:** ami soha nem releváns a szerepkörnek → **rejtsd**.
- **Akció** látható rekordon: ha nincs jog → **disabled + magyarázat**, ne tűnjön el.

### 5.5 Support impersonation

Platform / support más nevében nézheti a tenantot:

- **Tartós, erős banner** (kit néz, melyik tenant).
- Kilépés az impersonationből mindig egyértelmű.
- Audit: ki impersonált, mikor, milyen tenantban.

### 5.6 Meghívó flow (struktúra)

1. Tulajdonos / admin meghívót küld (email + szerepkör + tenant).
2. User elfogadja (új fiók vagy meglévő).
3. Membership létrejön.
4. Első belépés → onboarding / empty state a tenant állapotától függően.

---

## 6. Alkalmazás belső struktúra (logikai)

### 6.1 Shell

Minden tenant-képernyő ugyanazon a vázon:

```
┌──────────────────────────────────────────────────────────┐
│ Banner (impersonation / előfizetés / rendszerüzenet)     │
├────────────┬─────────────────────────────────────────────┤
│ Sidebar    │ Topbar: cégnév · tenant-váltó · user menü   │
│ (modulok   ├─────────────────────────────────────────────┤
│  jog       │ PageHeader (cím · 1 primary jobbra)         │
│  szerint)  ├─────────────────────────────────────────────┤
│            │ Tartalom (lista / űrlap / detail)           │
│            │ Toast: jobb alul                            │
└────────────┴─────────────────────────────────────────────┘
```

UI szabályok: Flat 2.0 + certainty-first (`02`, `03`, `04`).  
Egy primary akció / képernyő. Primary jobbra. Destruktív dialógus default fókusz: `Mégse`.

### 6.2 Rétegek az appban

```
modul-app/
  Platform réteg          Auth, meghívó, tenant választó, onboarding,
                          (belső) support admin
  Tenant shell            Layout, navigáció, banner, tenant kontextus
  Üzleti modulok          Rendelés, készlet, ajánlat, … (domain szerint)
  Design system           components/ui + patterns + tokens.css
  Adatelérés              supabase client, server helpers, query conventions
```

### 6.3 Könyvtárirány (stack docdal összhangban)

```
modul-app/
  src/
    app/                 # App Router (route groups: (auth), (app), (admin))
    components/
      ui/                # shadcn primitives
      patterns/          # PageHeader, DataTable, FormField, StatusBadge…
    lib/
      tokens.css
      supabase/
    hooks/
  docs/                  # ez a dokumentáció
```

Nincs import `../main-app`, `../customer-portal`, `../b2b-portal` felé.

### 6.4 Adatút listáknál (kötelező)

```
URL (page + szűrők)
  → Server / Query (tenant-scoped)
    → limit default 25 (UI max 50)
    → keskeny select (ne *)
      → DataTable
```

Nincs végtelen scroll listákban. Részlet: `05-data-performance.md`.

---

## 7. Platform szolgáltatások (SaaS gerinc)

Ezek **nem** egy ERP modul mezői — a SaaS mag. Az üzleti modulok ezekre támaszkodnak.

### 7.1 Katalógus

| Szolgáltatás | Feladat | Megjegyzés |
|---|---|---|
| **Tenant lifecycle** | Létrehozás, slug, státusz, felfüggesztés | Platform + self-serve onboarding |
| **Membership + roles** | Meghívó, szerepkör, kizárás | Tenant tulajdonos UI |
| **Auth session** | Login, cookie, tenant kontextus | Saját middleware — ne legacy minta |
| **Billing / előfizetés** | Plan, lejárat → app korlátozás | Stripe vagy manuális MVP |
| **Feature / plan gate** | Modul elérhető-e a planben | UI + szerver |
| **Audit** | Ki · mit · mikor (magas kockázat) | Support + bizalom |
| **Soft delete + undo** | Napi „visszaállítás” | Certainty-first |
| **Tenant export** | „Összes adatom” / belső backup | GDPR + ops |
| **Tenant snapshot** | Ütemezett logikai mentés | Per-tenant DR (lásd 8.) |
| **Storage** | Fájlok tenant-prefixszel | Policy / RLS |
| **Support tools** | Impersonation, diagnosztika | Erős banner + audit |
| **Email / értesítés** | Meghívó, fontos esemény | Ne spamelj; magyarázó copy |
| **Observability** | Error tracking, alap metrikák | Staging + prod |

### 7.2 Billing és app állapot kapcsolata

Billing **nem** csak számlázási képernyő:

```
Billing provider / manuális státusz
        │
        ▼
Tenant subscription state
        │
        ├── active      → teljes írás/olvasás
        ├── past_due    → banner + türelmi szabály
        ├── read_only   → írás tiltva
        └── suspended   → belépés / használat korlátozva
```

A korlátozás **szerveren** is érvényesüljön, ne csak UI-ban.

### 7.3 Audit — mit kötelező naplózni (struktúra)

Legalább:

- Bejelentkezés / sikertelen próbálkozás (ahol elérhető)
- Membership változás (meghívás, szerepkör, kizárás)
- Destruktív / irreverzibilis üzleti művelet
- Impersonation start/stop
- Tenant státusz váltás (suspend, read_only)
- Export / restore műveletek

UI-ban magas kockázatnál legyen nyom: ki, mikor, milyen állapot (`10`).

---

## 8. Backup, restore, katasztrófa

### 8.1 Fontos tény

Supabase natív backup / PITR = **egész projekt**, nem „csak az Acme Kft.”.

| Eszköz | Hatáskör | Mikor |
|---|---|---|
| Supabase napi backup / PITR | Egész DB | Katasztrófa, regionális hiba |
| Soft delete + undo | Egy rekord / folyamat | Napi user hiba |
| Audit-based recovery | Egy művelet | Téves státusz / érték |
| Tenant export / snapshot | Egy tenant logikai adatai | Ügyfél kérés, partial DR |
| Selective merge stagingről | Egy tenant | Ritka, runbookos művelet |
| Dedicated project (whale) | Egy tenant natívan | Szerződéses izoláció |

### 8.2 Kötelező ops csomag shared DB mellett

1. Soft delete az üzleti entitásokon.
2. Audit magas kockázatú műveletekre.
3. Tenant export API / job.
4. Ütemezett tenant snapshot (kritikus entitáskör) Storage-ba.
5. **Írott restore runbook**: hogyan állítasz vissza *egy* tenantot anélkül, hogy a többit visszavinnéd.

### 8.3 Tipikus forgatókönyvek

| User / ügyfél kérés | Első válasz |
|---|---|
| „Véletlenül töröltem egy rendelést” | Soft delete undo / audit |
| „Tegnapi állapot kell az egész cégemnek” | Tenant snapshot / selective restore |
| „Az egész SaaS elromlott” | Supabase PITR / projekt restore |
| „Jogi izoláció + saját restore SLA” | Dedicated Supabase projekt (hybrid) |

---

## 9. Storage és fájlok

- Minden objektum **tenant-hez kötött** (prefix vagy metadata).
- Letöltés / feltöltés: membership + RLS/policy.
- Export ZIP / snapshot: külön bucket vagy prefix, retention policy-val.
- Nyilvános URL csak tudatos, tenant-biztonságos esetekben (általában signed URL).

---

## 10. Request flow — etalon

### 10.1 Lista megnyitás

```
1. User:  /t/acme/rendelesek?page=1&status=open
2. Middleware: érvényes session?
3. Tenant kontextus: acme (URL + session egyezés)
4. Membership: user tagja-e acme-nek?
5. Query: tenant-scoped lista, limit 25, keskeny select
6. UI: DataTable + látható sorakciók + PageHeader primary
```

### 10.2 Író művelet

```
1. User: „Rendelés lezárása”
2. UI: megerősítés ha destruktív / irreverzibilis
3. Server Action: session + tenant + role
4. DB: RLS mellett update
5. Audit sor
6. Toast jobb alul + query invalidálás
7. Ha hiba: magyar, actionable üzenet (06, 12)
```

### 10.3 Tenant váltás

```
1. Topbar → másik cég
2. Session current tenant frissül
3. Redirect a másik tenant kezdő / utolsó biztonságos útjára
4. Egyértelmű visszajelzés: „Most a X cégben dolgozol”
5. Előző tenant cache ne szivárogjon át (Query key: tenantId prefix)
```

TanStack Query key konvenció: **minden tenant-adat kulcsában szerepeljen a tenant id**.

---

## 11. Onboarding a struktúrában

Az architektúra támogatja a `11-empty-tenant-and-onboarding.md` flowt:

1. Tenant `provisioning` / `active` + empty checklist.
2. Ne nyíljon rá az összes modul egyszerre.
3. Empty state: egy mondat + egy primary CTA.
4. Első sikerélmény cél (pl. első törzsadat vagy első rendelés).

Platform felelősség: tenant létrehozás + seed + checklist állapot.  
Modul felelősség: saját empty state + CTA.

---

## 12. Üzleti modulok helye (határ)

A platform **gerinc** stabil; az ERP modulok **ráépülnek**:

```
[ Platform: auth · tenant · membership · billing state · audit · export ]
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   Rendelés / ajánlat    Készlet / termék      Pénzügy / … 
   (példa domain)        (példa domain)        (később)
```

Szabályok:

- Új modul **nem** vezethet be saját tenancy / auth megoldást.
- Minden új üzleti tábla / entitás → tenant-kötés + RLS a platform mintájára.
- Modul jogosultság mátrix dokumentálva (képernyő / akció × szerepkör).
- Legacy folyamatötlet OK; legacy kód tilos.

Az első konkrét modulok listája **üzleti prioritás** — ezt a docot nem kell minden termékdöntésnél újraírni; a határ igen.

---

## 13. Biztonsági alapelvek (struktúra)

1. RLS minden tenant-üzleti adaton — default deny.
2. Service role kulcs **csak** szerveren, soha kliensben.
3. Server Action / RPC érzékeny műveletre — ne „rejtsük a gombot”.
4. Impersonation auditált és bannerrel jelzett.
5. Export / restore jogosultság szűk (tulajdonos / platform).
6. Rate limit auth és export végpontokon (ahol megoldható).
7. Secrets: Vercel env + Supabase dashboard — ne commit.

---

## 14. Megfigyelhetőség és üzemeltetés

Minimum production előtt:

| Terület | Elvárás |
|---|---|
| Hibák | Client + server error tracking |
| Uptime | Vercel + Supabase státusz figyelem |
| Runbook | Tenant restore, suspend, impersonation |
| Migráció | Egyirányú, reviewolt, staging először |
| Support | Tenant id / slug kereshető a support UI-ban |

---

## 15. Skálázási út (nem most, de irány)

| Fázis | Tenants | Architektúra |
|---|---|---|
| **MVP** | 1–10 | 1 Vercel + 1 Supabase + RLS + soft delete + audit |
| **Growth** | 10–50 | + tenant snapshot, billing automation, observability |
| **Scale / enterprise** | 50+ vagy whale | Connection pooling figyelem, esetleg read replica; hybrid dedicated DB igény szerint |
| **Nem cél** | — | Minden tenant külön projekt „biztonságból” |

50 tenant shared DB mellett **adatmennyiségben** tipikusan még kényelmes, ha indexelés és lista-query szabályok (`05`) megmaradnak.

---

## 16. Döntési mátrix — gyors emlékeztető

| Kérdés | Válasz |
|---|---|
| Hány Vercel deploy? | **1** (plusz staging) |
| Hány Supabase prod projekt? | **1** (default) |
| Tenant izoláció? | **RLS + tenant kötés** |
| Natív 1-tenant DB restore? | **Nem** — saját tooling |
| User több cégben? | **Igen** — membership + váltó |
| Legacy kód? | **Nem** — csak ötlet |
| UI stack? | **shadcn + Flat 2.0** |
| Lista? | **Szerver lapozás, limit 25** |
| Dedicated DB? | **Csak whale / szerződés** |

---

## 17. Nyitott, de struktúrát nem blokkoló döntések

Ezeket külön lehet zárolni; a fenti architektúra mindkét választást tűri:

1. **Tenant routing:** subdomain vs path (`/t/{slug}`).
2. **Billing provider:** Stripe vs manuális státusz MVP-ben.
3. **Első 3 üzleti modul** prioritása.
4. **Email provider** konkrét választása.
5. **Platform admin** host: `admin.` subdomain vs `/platform` path.

Amit **nem** nyitunk újra fejlesztés közben:

- Shared DB + RLS default
- Egy Vercel app
- Szeparáció a legacy appoktól
- Soft delete + audit + tenant export mint DR alap

---

## 18. Agent / fejlesztő checklist (architektúra)

Új feature előtt:

- [ ] Tenant-scoped-e az adat? (RLS + szerver check)
- [ ] Query key / cache tartalmazza a tenant id-t?
- [ ] Írás auditálandó-e?
- [ ] Soft delete illik-e ide undo-hoz?
- [ ] Plan / előfizetés korlátozhatja-e?
- [ ] Empty state megvan-e új listán?
- [ ] Nincs legacy import?
- [ ] Lista: limit, keskeny select, URL state?

PR előtt: `07-checklist.md` + ez a lista, ha tenancy / platform érintett.

---

## 19. Összefoglaló ábra

```
                         DNS
                          │
              ┌───────────▼───────────┐
              │   Vercel · modul-app  │
              │   Next.js (1 deploy)  │
              └───────────┬───────────┘
                          │
         Auth session · tenant context · API
                          │
              ┌───────────▼───────────┐
              │  Supabase (1 projekt) │
              │  Auth · Postgres+RLS  │
              │  Storage · jobs       │
              └───────────┬───────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Platform gerinc   Üzleti modulok    Ops tooling
   tenant·member     rendelés·…        snapshot·audit
   billing state                       restore runbook
```

**Forrásigazság:** ha UI/UX vs ez a doc konfliktusba kerül a tenancy/deploy kérdésben → **ez a doc**; ha vizuális/UX → `02` / `03`. Szeparációban → `08`.
