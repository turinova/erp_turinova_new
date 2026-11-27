# Turinova Admin (Expo) — korábban „Optinova Vezető”

SaaS **tenant staff** iOS companion: belépés → saját cég (tenant) kontextus.  
Forrásigazság: [`58`](../modul-app/docs/58-ios-vezetoi-app.md) · UX/wireframe: [`59`](../modul-app/docs/59-ios-vezetoi-ux.md).

**EAS project:** [@turinova/vezetoi-mobile](https://expo.dev/accounts/turinova/projects/vezetoi-mobile)  
(`projectId` az `app.json` → `extra.eas.projectId`)

## Állapot — 2026-11-26 (riport-app átépítés)

A változások **nincsenek commitolva** (`git status vezetoi-mobile modul-app`).

### Hol tartunk

| Terület | Állapot |
|---|---|
| Login, tenant kapu, Face ID | Kész |
| PanelUI + Uniwind dev client | Kész — utolsó iOS dev build: EAS `91ac4ed5-b12a-4def-98d4-d7a165b3dadb` (új natív modul nem kellett) |
| **Kezdőlap** (`app/(app)/(kezdolap)/index.tsx`) | Kész — Ma / Hét / Hónap, összevetéssel; számok a modul-app mobil API-ból |
| **Részletezők** (`(kezdolap)/rendelt · ajanlatok · szabas · elmaradas`) | Kész — natív Stack fejléc, visszahúzás, örökölt időszak |
| **Jelenlét** (`jelenlet.tsx`) | Kész — WeekStrip hét, nagy szám + bontás, csoportos lista |
| **Belépők** (`belepok.tsx`) | Kész — eszközállapot, Ma / 7 nap / Hónap |
| Gyártás / régi Lapszabászat képernyő, `react-native-gifted-charts` | **Törölve** |
| TestFlight / App Store | **Nincs elkezdve** — lásd lent |

### Kezdőlap — zárolt döntések (riport app, nem teendőlista)

- Fejléc: **cégnév ▾** (több cégnél váltó) + **frissítés ideje** („10:42”, 15 percnél régebbi → borostyán). Alatta **Ma / Hét / Hónap** (megmarad újraindítás után; a részletezők öröklik).
- Időszakfüggő: **Rendelt** hero (Ft + `▲ 18% · +158 000 Ft` + „a szokásos csütörtökhöz képest” + „10 rendelés · szokásos: 8”) · **Ajánlatok** csempe (db + „N partnertől”, nincs delta) · **Belépők** csempe (fő + delta).
- **Most** csoport (időszaktól független): **Szabás ma** (% + ThinBar + „410 / 500 m”) · **Elmaradás** (N rendelés, „N el sem indult”, méter) · **Bent most 5 / 6** sor → Jelenlét tab.
- Összevetés: **Ma** = előző 4 azonos hétnap átlaga ugyanaddig az óráig (munkaszüneti / 0 rendeléses nap nélkül) · **Hét** = múlt hét hétfőtől ugyanaddig · **Hónap** = előző hónap 1–N. („okt. 1–26.-hoz képest”). ±2% alatt szürke „≈ ugyanannyi”; nincs bázis → „Nincs összevetési adat”.
- Minden csempe kattintható (›). Hálózati hiba + van cache → borostyán sáv („a 10:12-es adatot látod”). A Kezdőlapon **nincs grafikon**.
- **Nem kell:** teendők / Figyelem blokk, polc, kiadás, befizetés, kintlévőség (a lapszab POS folyamat nincs használatban), Google.
- Csak 4 betűméret: 40 (hero) · 28 (csempe) · 15 (csoportcím) · 13 (felirat). Szín **csak állapot**, mindig jellel + szöveggel.

### Részletezők

| Képernyő | Tartalom |
|---|---|
| Rendelt | Ma: óránkénti halmozott vonal vs szokásos (szaggatott szürke); Hét/Hónap: napi oszlop vs előző időszak · Saját / Partnerportál sáv · Top 5 anyag · „Mit számolunk ide?” |
| Ajánlatok | Összes db · Hét/Hónap: napi halmozott oszlop (saját kék / partner lila) · Ki készítette sáv · Top 5 partner |
| Szabás | Mai % · gépenként (ha >1 gép) · következő 5 munkanap |
| Elmaradás | Darab, méter, el sem indult · 10 legrégebbi · **Összes megnyitása a weben** → `/megrendelesek?focus=late` (Safari) |

### Adatforrások

Az üzleti számok **a modul-app mobil API-ból** jönnek, ugyanazokkal a definíciókkal, mint a webes kezdőlap:
`GET {EXPO_PUBLIC_API_URL}/api/m/v1/{kezdolap|rendelt|ajanlatok|szabas|elmaradas}?tenant=<uuid>&period=ma|het|honap`
— `Authorization: Bearer <Supabase access token>`; a route RLS-sel, tagság- és modulellenőrzéssel fut (`modul-app/src/lib/mobile/`).

| Képernyő | Forrás |
|---|---|
| Rendelt / Ajánlatok / Szabás / Elmaradás | modul-app `src/lib/mobile/pulse.ts` (megrendelés = `ordered_at`, archivált benne, sztornó nem; Elmaradás = `lateCutoffYmd` + `hr_work_calendar`, archivált nem; Szabás = `getSchedulerKpis`) |
| Belépők | RPC `footcounter_today_slim_agg`, `footcounter_dashboard_agg`; `footcounter_settings`, `footcounter_devices.last_seen_at` (közvetlen Supabase) |
| Jelenlét / Bent most | `hr_employees`, `hr_employee_types`, `hr_attendance_days`, `hr_absences`, `hr_work_calendar` (közvetlen Supabase) |

Cache: `src/lib/use-cached-resource.ts` — AsyncStorage-ból azonnal, utána frissít; előtérbe jövéskor (>1 perc) és fókuszban 5 percenként újratölt.

### Folytatás — újraindítás

```bash
# 1) modul-app (a mobil API innen jön)
cd modul-app && npm run dev            # :3010

# 2) mobil
cd vezetoi-mobile
npm install
./node_modules/.bin/tsc --noEmit -p .
npx expo start --dev-client --clear   # --clear kell: régi Metro cache → Worklets 0.13 vs 0.14 hiba
```

`.env.local`: `EXPO_PUBLIC_API_URL=http://<Mac LAN IP>:3010` (`ipconfig getifaddr en0`), élesben `https://app.optinova.hu` (alapértelmezés).
Telefonon a saját **Optinova Vezető** dev client ikon (az új név az első új buildtől látszik: „Turinova Admin”). Natív változásnál: `npx eas-cli build --platform ios --profile development`.

### Nyitott teendők (következő kör)

1. **Commit** + deploy (kérésre) — élesben a mobil API csak a modul-app deploy után érhető el.
2. EAS env: `EXPO_PUBLIC_API_URL=https://app.optinova.hu` (preview / production).
3. ~~Márka~~ — eldöntve: **Turinova Admin**, csak iPhone (`supportsTablet: false`), terjesztés: **Unlisted App**.
4. Nagy felbontású logó (SVG / 1024 px) → ikonok újragenerálása.

### App Store / TestFlight — lépések (még nem kezdtük)

1. **Terjesztés döntés:** TestFlight először (belső, review nélkül) → **Unlisted App** kérvény (B2B belső app; nyilvános store-ban 3.2 miatt elutasítás kockázat).
2. App Store Connect → New App, név **Turinova Admin**, bundle `hu.optinova.vezetoi`, magyar nyelv, SKU `vezetoi-mobile`.
3. Build + feltöltés:
   ```bash
   npx eas-cli build -p ios --profile production
   npx eas-cli submit -p ios --latest     # ascAppId utána mehet az eas.json submit.production-be
   ```
4. Adatlap: 6,9" képernyőképek (1320×2868), leírás, kulcsszavak, Support URL, **Privacy Policy URL**, kategória Business, korhatár, App Privacy (e-mail, nincs tracking). Export compliance már beállítva (`ITSAppUsesNonExemptEncryption: false`).
5. Review: **demó tenant + demó fiók** — lépésről lépésre: [`docs/app-store-review-demo.md`](docs/app-store-review-demo.md) (SQL: `docs/app-store-review-demo-seed.sql`). Review note (EN): B2B, nincs publikus regisztráció, unlisted szándék.

---

## Állapot (alap)

| | |
|---|---|
| Expo + Router | Kész |
| Supabase login + tenant kapu | Kész |
| Tabok: Kezdőlap (Stack + 4 részletező) · Jelenlét · Belépők · Több | Kész |
| UI: PanelUI + Uniwind, adapterek `src/ui` | Kész |
| **EAS** (`eas.json`, project link) | **Kész** — development / preview / production |
| **iOS development build (telefon)** | Kész (Fázis 1c) |

## Env (helyi + EAS)

```bash
cp .env.example .env.local
# EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
# = modul-app NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
# EXPO_PUBLIC_API_URL = staff webes host (dev: http://<Mac LAN IP>:3010)
```

`.env.local` gitignore-olt. **Soha** ne tedd be a service role kulcsot.

### EAS Secrets (buildhez kötelező)

A felhőbuild **nem** olvassa a `.env.local`-t. Egyszer minden környezetre:

```bash
cd vezetoi-mobile
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL \
  --value 'https://….supabase.co' \
  --environment development --environment preview --environment production \
  --visibility sensitive --type string --non-interactive

npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value 'eyJ…' \
  --environment development --environment preview --environment production \
  --visibility sensitive --type string --non-interactive
```

Ellenőrzés (értékek nélkül): `npx eas-cli env:list`

---

## Fázis 1c — EAS development build (Xcode nélkül)

A helyi `expo run:ios` **szünetel** (belső SSD / Xcode DeviceSupport). A natív appot az **EAS felhő** buildeli.

### Előfeltételek

1. Expo login: `npx eas-cli whoami` → `turinova`
2. EAS env-ek feltöltve (fent)
3. iPhone: **Fejlesztői mód** ON
4. Apple Team az `app.json`-ban: `CV2CJMLP6K` (Personal Team: ~7 naponta újraaláírás)

### Build + telepítés

Monorepo: a repo gyökerén van **`.easignore`** (csak `vezetoi-mobile/` megy fel — különben >2 GB limit). Kezdetben elég iOS.

```bash
cd vezetoi-mobile
npx eas-cli build --platform ios --profile development
```

1. Credentials: cloud / Generate (ne helyi keychain).
2. Regisztráld az iPhone UDID-t, ha az EAS kéri.
3. Build 10–20 perc → install link / QR → telepítsd.
4. Megjelenik az **Optinova Vezető** ikon (nem Expo Go).

Android később: ugyanaz `--platform android`-dal.

### Napi JS fejlesztés

```bash
npm install
npm run start:dev
```

Nyisd a telefonon a **saját** app ikont. Ugyanaz a Wi‑Fi, vagy `--tunnel`.

| Változás | Új EAS build kell? |
|---|---|
| JS / TSX / stílus | Nem |
| Natív modul, plugin, `app.json` plugin, ikon | Igen |

### PanelUI

Expo Go-n: crash (`NativeWorklets`).  
Development clienten: új EAS build a PanelUI csomagok után, majd `npm run start:dev`.

- Belépés: `app/_layout.tsx` → `import '../src/global.css'`, `Uniwind.setTheme('light')`, `<PanelUIProvider>`.
- Téma: `src/global.css` (Midday light tokenek a PanelUI `theme.css` fölött). Metro: `withUniwindConfig`.
- Képernyők csak `@/ui`-ból importálnak (adapterek a PanelUI fölött): `Screen`, `HeroMetric`, `ListSection` + `ListRow`, `SegmentedControl`, `ConfirmDialog`, `Skeleton`, `StatusText`, `Button`, `Card`.
- Importálj subpathról (`panelui-native/components/button`), ne a gyökérből.

### Tipikus hibák

| Tünet | Mit nézz |
|---|---|
| Install fail / profil | UDID nincs a provisioningben → eszköz + rebuild |
| Üres Supabase / login fail a buildelt appban | EAS `env:list` — hiányzik a két `EXPO_PUBLIC_*` |
| Metro nem kapcsolódik | Ugyanaz a Wi‑Fi, vagy `npx expo start --dev-client --tunnel` |
| PanelUI crash Expo Go-ban | Várt; használd a saját ikont |
| Personal Team 7 nap | Új development build / újraaláírás |
| Lokális `ios:device` disk full | Ne; maradj EAS-en |

### Belépés ellenőrző lista

1. Staff email+jelszó → cégnév  
2. Rossz jelszó → hibaüzenet  
3. Kijelentkezés → login  
4. Session megmarad újraindítás után  
5. Partner fiók → elutasítás  
6. Több cég → váltás  

---

## Expo Go (csak korai JS smoke)

```bash
npx expo start
```

QR → Expo Go. **Nem** végleges UI-teszt (PanelUI nem megy). Napi munka: development client.

---

## Profilok (`eas.json`)

| Profil | Mire |
|---|---|
| `development` | Dev client + Metro (`developmentClient: true`) |
| `preview` | Belső demó, store nélkül |
| `production` | TestFlight / App Store (később) |

**Nincs `channel` / `expo-updates` az első buildben** (OTA később). Így az EAS nem kéri az `expo-updates` telepítését, ami peer conflictot okozott (`react` 19.3.0 vs `react-dom` 19.3.1).

Android: ugyanazok a profilok később; iOS első.

---

## Szeparáció

Nincs import `main-app` / portalokból. Backend = meglévő Supabase + RLS.
