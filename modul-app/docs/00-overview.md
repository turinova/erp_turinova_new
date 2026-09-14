# 00 — Áttekintés és vízió

## Cél

Egy **tökéletesen működő, villámgyors SaaS admin élmény** — **teljesen külön alkalmazásként**, a `main-app`, `customer-portal` és `b2b-portal` mellett (nem helyettük automatikusan, nem merge-elve):

- **Enterprise Flat 2.0** vizuális nyelvet követ,
- **bizonyosság-first** UX-et ad (nem „power-user dense dashboard”),
- **Vercel + Supabase** infrastruktúrán fut,
- shadcn/ui + Tailwind stacken épül.

Ez a dokumentáció a **modul-app** és minden hozzá kapcsolódó UI fejlesztés irányadója.

## Célcsoport (kötelezően figyelembe veendő)

A tipikus user:

- **nem fejlesztő**, nem „SaaS native”,
- gyakran **heti / napi rutinfeladatokat** végez (rendelés, készlet, ajánlat),
- **megszakítva** dolgozik (telefon, műhely, ügyfél),
- **fél a hibázástól** — nem kísérletezik gombokkal,
- a munkamemóriája korlátozott, ezért nem szabad arra kényszeríteni, hogy több képernyő között fejben tartson fontos információkat,
- inkább **bizonyosságot** akar („jól csináltam”), mint kevés kattintást.

**Következmény:** minden UI döntésnél a kérdés nem az, hogy „elegáns-e a power usernek?”, hanem:

> *Egy ritkán belépő, kevésbé digitálisan magabiztos ember 5 másodperc alatt megérti-e, mit kell tennie, és vissza tud-e lépni, ha elrontotta?*

## Appok viszonya (szeparáció)

| App | Kapcsolat a modul-app-hoz |
|---|---|
| **modul-app** | Önálló új SaaS app — saját deploy, stack, kód |
| `main-app` | Legacy — **csak ötlet** (folyamat, domain); nincs kódmegosztás |
| `customer-portal` | Legacy — **csak ötlet** |
| `b2b-portal` | Legacy — **csak ötlet** |

Részletes határok: **[08-separation-boundaries.md](08-separation-boundaries.md)**.  
Komplett SaaS struktúra (deploy, tenancy, platform gerinc, DR): **[17-saas-architecture.md](17-saas-architecture.md)**.  
Supabase bekötés lépései: **[19-supabase-setup.md](19-supabase-setup.md)**.  
Partner / online asztalos (add-on): **[20-partner-portal.md](20-partner-portal.md)**.

**Nem cél:** UI egységesítés közös package-ben, fájl-migráció, import a régi appokból.

## Öt nem tárgyalható alapelv

1. **Egy primary akció / képernyő.**
2. **Gyakori művelet mindig látható** (nem kebab, nem csak hover).
3. **Címke a mező felett** — placeholder soha nem címke.
4. **Státusz = szín + szöveg** (szín önmagában tilos).
5. **Lista = szerveroldali lapozás** — nincs „tölts le mindent”.
6. **Legacy appokból csak ötletet merítünk** — nincs import, nincs copy-paste.

## Referenciák (külső)

- Enterprise Flat 2.0 (belső spec → `02-enterprise-flat-2.0.md`)
- GOV.UK / NHS form patterns — plain language, egy fókusz
- Stripe Dashboard — job-alapú navigáció, empty state CTA
- SAP Fiori / ServiceNow Horizon writing — rövid, aktív, nem hibáztat
- Bench eredmény: `bench/RESULTS.md`

## Mit NEM csinálunk

- MUI / Ant Design új feature-ben
- Materialize sablon továbbvitele
- „Modern” dekor: glow, glassmorphism, gradiens gomb, neumorf
- Power-user only shortcut mint az *egyetlen* út egy gyakori feladathoz
