# Optinova Vezető (Expo)

SaaS **tenant staff** iOS companion: belépés → saját cég (tenant) kontextus.  
Forrásigazság: [`58`](../modul-app/docs/58-ios-vezetoi-app.md) · UX/wireframe: [`59`](../modul-app/docs/59-ios-vezetoi-ux.md).

**EAS project:** [@turinova/vezetoi-mobile](https://expo.dev/accounts/turinova/projects/vezetoi-mobile)  
(`projectId` az `app.json` → `extra.eas.projectId`)

## Állapot

| | |
|---|---|
| Expo + Router | Kész |
| Supabase login + tenant kapu | Kész |
| Tabok Ma / Gyártás / Figyelem / Több | Kész |
| UI kit (`src/ui` — shadcn-szerű) | Kész |
| Gifted-charts + Lucide | Kész |
| **EAS** (`eas.json`, project link) | **Kész** — development / preview / production |
| **iOS development build (telefon)** | Teendő: lásd Fázis 1c |
| **PanelUI + Uniwind** | Csak development client után (Expo Go-n worklets crash) |

## Env (helyi + EAS)

```bash
cp .env.example .env.local
# EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
# = modul-app NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
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

```bash
cd vezetoi-mobile
npx eas-cli build --platform ios --profile development
```

1. Credentials: cloud / Generate (ne helyi keychain).
2. Regisztráld az iPhone UDID-t, ha az EAS kéri.
3. Build 10–20 perc → install link / QR → telepítsd.
4. Megjelenik az **Optinova Vezető** ikon (nem Expo Go).

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
