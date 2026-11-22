# 58 — Vezetői iOS app (SaaS tenant riportok)

**Állapot:** 2026-11-18 — **5 tab IA:** Ma · Jelenlét · Belépők · Figyelem · Több (Gyártás a Több alatt).  
**Persona:** ügyvezető / tulajdonos / irodavezető — **5 mp glance**, Ft / pénzhatás első.  
**Kapcsolat:** UX/wireframe **[59](59-ios-vezetoi-ux.md)** · home KPI [35](35-home-kpis.md) · tenancy [10](10-permissions-and-tenancy.md) · SaaS [17](17-saas-architecture.md) · eszközök [14](14-responsive-and-devices.md) · PDA (későbbi hullám) [45](45-pda-pos-addon.md).

---

## 0. Egy mondat

> A SaaS tenant staff (ugyanaz a login, mint a webes modul-app) iPhone-on belép, és **csak a saját cége (tenant)** riportjait / áttekintéseit látja — RLS + entitlement szerint.

---

## 1. Cél / nem-cél

### Cél (v1)

| | |
|---|---|
| Ki | Tenant **staff** membership (nem partner portal, nem platform admin) |
| Hol | iOS első (TestFlight); Android később ugyanabból az Expo kódból |
| Mit | Olvasás: forgalom, kintlévő, gyártás elmaradás, partner inbox, kiemelt partnerek, (addon) belépő / jelenlét glance |
| Biztonság | Ugyanaz a Supabase project + **RLS**; aktív `tenant_id` a sessionből — nincs cross-tenant leak |
| Mély munka | Cell / sor → deep link a webes modul-appra (Safari / in-app browser) |

### Nem cél (v1)

- PDA eladás, árellenőrzés kamera-first, kosárátadás ([45](45-pda-pos-addon.md)) — **2. hullám**
- Lapszab `/scanner`, Opti, beérkezés scan
- Számla kiállítás, törzs CRUD, Excel, műszakzárás KP
- Partner (asztalos) app — külön ICP ([20-partner-portal](20-partner-portal.md))
- Platform impersonation / multi-tenant „összes cég” dashboard
- Offline-first queue

---

## 2. Zárolt stack

| Réteg | Választás | Miért |
|---|---|---|
| Framework | **Expo** (React Native) | Meta ajánlja; TS; Cursor + Expo Go |
| Nyelv | TypeScript | modul-app stack |
| Routing | Expo Router | file-based |
| Backend | Meglévő Supabase + RLS | 1 DB, shared schema ([17](17-saas-architecture.md)) |
| Auth | Staff Supabase auth + membership | Nincs külön „mobil user” tábla |
| Biometria | `expo-local-authentication` (opcionális unlock) | Session refresh továbbra is Supabase |
| Data | Lean query / RPC — mint home KPI | Nincs `select('*')`; limitált listák |
| UI | Saját `src/ui` + gifted-charts, Midday tokenek | PanelUI Expo Go-n NO-GO (worklets); később dev client |
| Chart | `react-native-gifted-charts` + SVG | Glance spark; Victory Native csak EAS után |
| Ikon | `lucide-react-native` | Web Lucide párhuzam |
| Build | **EAS Build / Submit** (iOS első) | Xcode a gépen **nem** kell; lokális `expo run:ios` SSD miatt szünetel |
| OTA | EAS Update (JS) | Natív modul változás → új store build |

**Tudatos nem:** Flutter, Capacitor mint végleges product, külön Swift app, UI-share Next.js komponensekkel.

Repo hely: **`vezetoi-mobile/`** (monorepo root, a `modul-app` mellett) — külön deploy artifact; **nincs** import legacy `main-app` / portalokból.

---

## 3. Tenancy és belépés

1. User email + jelszó (ugyanaz, mint `/login` a staff hoston).
2. Session → membership(s) → **aktív tenant** (ha több: választó, mint web topbar).
3. Minden riport query: `tenant_id = aktív tenant` + RLS.
4. Entitlement / `page_access`: ami a weben rejtve van, a mobilon is **rejtve** (pl. nincs lapszab → nincs lapszab KPI / elmaradás).
5. Dev bypass session **tiltva** production buildben.
6. Partner-only fiók (`partner_profiles`, staff membership nélkül) → **nem** léphet be ebbe az appba (külön partner surface később).

Copy (HU): „A számaid a kiválasztott céghez tartoznak.” Tenant váltáskor pull-to-refresh az összes tabon.

---

## 4. v1 képernyők

Certainty-first: **egy fókusz / tab**; nagy tabular Ft; szín csak kivételre ([35](35-home-kpis.md), [03](03-ux-certainty-first.md)).

| Tab / screen | Tartalom | Web forrásigazság |
|---|---|---|
| **Ma** | Hero mai forgalom + MTD + kintlévő + belépő chart | `getHomeKpiBundle` / footcounter slim |
| **Jelenlét** | Placeholder → bent/kint glance | `/jelenlet` |
| **Belépők** | Hero belépő + Ma\|Hét\|Hó chart | `footcounter_*` RPC |
| **Figyelem** | Partner inbox + AR + silent | home inbox + kintlévő + kiemelt |
| **Több** | Tenant, Gyártás (lapszab), web, kijelentkezés | — |
| **Gyártás** | Nem tab — Több → elmaradás screen | backlog ([35](35-home-kpis.md)) |

**Deep link:** pl. elmaradás → `{staffOrigin}/megrendelesek?overdue=1`; partner sor → ajánlat detail URL.

Empty state: plain language + „Nyisd meg a webes Optinovát” CTA.

---

## 5. Adatréteg (javaslat)

| Elv | Részlet |
|---|---|
| Újrahasználat | Preferáld a meglévő lean query / RPC mintákat (`src/lib/home/*`, `kiemelt-partnerek/queries`) — **ne** másold a Next server actionokat vakon |
| Mobil API | Ha kell: dedikált lean Route Handler-ek vagy shared package típusok; mindig tenant-scoped |
| Lista limit | Default **25** (vagy kisebb glance: 5–10) |
| Frissítés | Pull-to-refresh; opcionális silent interval csak a Ma tabon |
| Formátum | Ft / dátum: [13](13-numbers-units-formats.md) (Budapest nap) |

---

## 6. Fázisok

| Fázis | Tartalom | Stop / teszt |
|---|---|---|
| **0** | Ez a doc + `vezetoi-mobile/` README | OK |
| **1a** | Expo skeleton, login, partner tiltás, tenant választó | Expo Go: staff belépés + cégnév (kész) |
| **1b** | Tab IA + Ma hero KPI + Figyelem + Gyártás + Több ([59](59-ios-vezetoi-ux.md)) | Kód kész — Expo Go smoke: számok ≈ `/home`; lapszab OFF → nincs Gyártás tab |
| **1c** | **EAS** project + `eas.json` + iOS **development client** (felhőbuild, Xcode nélkül) | Saját ikon a telefonon; `npm run start:dev`; PanelUI csak ezután. Repo: `vezetoi-mobile/` · Expo: `@turinova/vezetoi-mobile` |
| **2** | Spark polish, méter elmaradás; opcionális PanelUI a dev clienten | |
| **3** | Biometria unlock, empty/error, ikon | Belső TestFlight (`preview` / `production`) |
| **4** | EAS production / App Store (ha döntés) | Review checklist |
| **5+** | Android smoke; push inbox; PDA hullám külön doc | — |

**Becsült idő (1 fő + Cursor, iOS első):** belső MVP **~1.5–2.5 hét**; store-ready polish **~3–4 hét**.

---

## 7. Tesztchecklist (v1)

1. Staff user tenant A → csak A adatai.  
2. Multi-membership → váltás után számok cserélődnek.  
3. Partner-only user → belépés elutasítva.  
4. Lapszab entitlement OFF → nincs lapszab / elmaradás blokk.  
5. Kintlévő / mai forgalom ≈ web `/home` ugyanarra a napra (BP timezone).  
6. Deep link megnyitja a staff hostot bejelentkezve (vagy login `?next=`).  
7. RLS: service role **nincs** a kliensben.

---

## 8. Későbbi hullámok (nem v1)

1. **Staff műhely / pult:** PDA eladás, árellenőrzés, lapszab scanner ([45](45-pda-pos-addon.md)).  
2. **Push:** új partner beküldés, ÜR kész, AR emlékeztető.  
3. **Partner Expo app** (asztalos) — külön bundle ID / login surface.  
4. Android store listing.

---

## 9. Elnevezés / branding

- Munkanév: **Vezetői app** / bundle pl. `hu.optinova.vezetoi` (végleges App Store név külön döntés).  
- Vizual: Enterprise Flat + Midday ritmus light ([18](18-midday-visual-reference.md)) — mobil sűrűség, nem „linagyolt” marketing landing.

---

## 10. DoD (dokumentum)

- [x] Stack zárolva (Expo)  
- [x] Tenancy / auth szabályok  
- [x] v1 képernyőlista  
- [x] Nem-célok (PDA külön)  
- [x] Repo mappa: `vezetoi-mobile/`  
- [x] Expo scaffold + login + tenant kapu (Fázis 1a)  
- [x] Ma / Figyelem / Gyártás / Több UI + lekérdezések (Fázis 1b kód)  
- [x] UI kit (`src/ui`) + gifted-charts spark + Lucide tabok  
- [x] Login polish: Face ID session lock, mezőfókusz, üres form disabled  
- [ ] Expo Go smoke: számok ≈ `/home` (kézi)  
- [x] EAS project link + `eas.json` (development / preview / production)  
- [ ] Fázis 1c: iOS development build telepítve + `start:dev` smoke  
- [ ] PanelUI csak development clienten (Expo Go tiltva)  
- [ ] NativeWind + RN Reusables CLI (ha Expo SDK stabil)  
