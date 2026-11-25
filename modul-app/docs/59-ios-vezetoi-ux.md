# 59 — Vezetői iOS: UX, layout, wireframe

**Állapot:** 2026-11-24 (6) — **Kezdőlap „csendes rács”:** 3 csoport szürke címmel (Lapszabászat · Ajánlatok ma · Bolt), csak 4 betűméret (40 hero / 28 csempe / 15 csoportcím / 13 felirat), fekete szám + szürke felirat + szürke ikon; szín csak állapot (zöld ✓ / borostyán ⚠ szöveggel), nincs színes kártyaháttér; csempék fix 128px, 2/sor; térköz 12 csoporton belül, 24 csoportok közt. Ajánlatok: két egyforma csempe (Mi készítettük · Partnertől: db + Ft).  
2026-11-24 (5) — **Kezdőlap újratervezve:** fejléc (cím, dátum, cég) nélkül; csak a lényeg, blokkonként domain színű ikon + felirat: Lapszabászat ma rendeltek (Ft, vs tegnap ilyenkor, db) · Szabás ma (Meter + ítélet + m) · Elmaradás **méterben** + késő rendelések száma · Ajánlatok ma (saját vs partner/portál: db + Ft, arány sáv) · Belépők ma · Bent ma. Kikerült: óránkénti görbe, 7 napos diagram, Google.  
2026-11-24 (4) — **Belépők újratervezve:** fejléc nélkül; eszközállapot mindig látszik („● Élő · N perce frissült”, kiesésnél borostyán kártya); Ma \| 7 nap \| Hónap. Ma: „Ma bejött X fő” + ítélet az azonos hétnap átlagához „ilyenkor” (±10%), Bent most ≈ (be − ki), csúcsóra, óránkénti PanelUI BarChart (aktuális óra kiemelve). 7 nap: összeg vs előző 7 nap, napnevek, legforgalmasabb nap. Hónap: léptető, vs előző hónap, napi oszlopok, „Melyik napon jönnek a legtöbben?” hétnap-profil. Nincs heatmap / időjárás / szezon. Türkiz domain szín (`#0D9488`); gifted-charts kikerült.  
2026-11-24 (3) — **Jelenlét újratervezve:** PanelUI `WeekStrip` hétsáv (napi „N fő”), nagy szám (gyűrű nélkül) + bontás + egy mondat; csoportos lista (Bent most · Már elment · Távol · Nincs jelölés · Szabadnapos) avatarral, típussal, ledolgozott idővel. Késést **nem** jelzünk (döntés). Szabadnap = vasárnap, nem szombatos dolgozó szombaton, munkaszüneti nap (`hr_work_calendar`).  
2026-11-24 (2) — **Kezdőlap csak lapszabászat** (POS / eladás jelenleg nem használt, nem jelenik meg). Hero: „Ma rendeltek · lapszabászat” Ft + egy mondat „▲ 12%-kal több, mint **tegnap ilyenkor**” (tisztességes összevetés, nem teljes tegnapi nap). Alatta PanelUI `AreaChart` ma (kék `#2563EB`) vs tegnap (szürke) óránként halmozva, ujjal olvasható; `Meter` szabási kapacitás + Elmaradás csempe; `BarChart` 7 nap (ma teli kék). Hero → **Lapszabászat részletező** (7 | 30 nap: napi oszlopok, előző időszak mondat, partnerportál vs saját arány-sáv, top 5 anyag táblában — `Leaderboard`). Szín = domain (Opti kék), szürke = összevetés, borostyán = figyelmeztetés; mindig felirattal.  
2026-11-24 — **PanelUI + Uniwind bevezetve** (dev client). Kezdőlap: hero mindig **Mai forgalom Ft** = eladás (`fulfilled_at` nap) + lapszabászat (`quotes.ordered_at`), delta szöveggel (tegnap · múlt hét), 7 napos spark; alatta max 2 kártya (Bent ma → Szabás ma → Belépők ma prioritás), a többi a „Továbbiak” listában. Több: csoportos lista (Cég / Modulok / Kijelentkezés megerősítéssel, Mégse balra). Töltés: skeleton, nem spinner.  
2026-11-18 — UX zárolva; **Belépők + Ma hero redesign** (Square/Midday: egy hero, segmented Ma\|Hét\|Hó, lean glance).  
**App:** `vezetoi-mobile/` · termék: [58](58-ios-vezetoi-app.md) · web KPI: [35](35-home-kpis.md) · certainty: [03](03-ux-certainty-first.md) · vizuál: [18](18-midday-visual-reference.md).

---

## 0. Egy mondat

> **Jobs:** egy kérdés / pillantás — „Hogy áll ma a cég?”  
> **Square / Shopify:** hero Ft + kevés kártya + tap → mélység a weben.  
> **Midday / Linear light:** charcoal, hairline, sűrű tipó — nem marketing landing, nem színes dashboard-erdő.

---

## 1. Referenciák → mit veszünk át

| Forrás | Átvett | Nem másoljuk |
|---|---|---|
| **Steve Jobs / Apple** | Egy hero; progressive disclosure; „insanely great” = kevesebb, de egyértelmű; default light, nagy szám | Skeuomorph, felesleges animáció, discovery-játék |
| **Square Dashboard** | Owner vs employee IA; tab bar a pillérekre; web a hosszú farkra; metrics kártya 2–3 adatpont | 40 termék menü; POS a telefonon |
| **Shopify Analytics** | Hero sales + trend; dátum mindig elérhető; kártya tap → report; Ma vs tegnap / előző időszak | Tömeges custom riport builder v1-ben |
| **Midday / Linear ([18](18-midday-visual-reference.md))** | `#18181B` primary; body ~14px; kompakt kontroll; szín = jelentés | AGPL UI kód; 44px „linagyolt” gombok; leaf-rainbow |
| **Certainty ([03](03-ux-certainty-first.md))** | Egy fókusz / képernyő; plain HU; empty = következő lépés | Hover-only; szín-only státusz |

**Célpersona:** ügyvezető / tulajdonos — 5 mp scan, Ft első ([35](35-home-kpis.md)). Nem pulti dolgozó (az PDA hullám).

---

## 2. Zárolt UX elvek (mobil)

1. **Egy hero / Ma tab** — „Mai forgalom” 2–3× nagyobb, mint a többi szám.  
2. **Max 4 bottom tab** (+ Több) — Square-szerű pillérek, nem 8 tab.  
3. **Kártya ≤ 3 adatpont** — különben tábla álruhában.  
4. **Szín csak delta / figyelmeztetés** (kintlévő, elmaradás, silent) — nem dekor.  
5. **Tap = deep link webre** (részlet) — ne építsünk második ERP-t.  
6. **Dátum / „Ma” kontextus látszik** — Shopify: időszak top-level. v1: fix „Ma / MTD”, pill később.  
7. **Tenant mindig látható** — kis cégnév a Ma headerben (bizonyosság: „melyik cég számait nézem?”).  
8. **Pull-to-refresh** minden listán / Ma-n.  
9. **Entitlement rejt** — nincs üres „Gyártás” tab, ha nincs lapszab.  
10. **Egy primary / dialógus** — kijelentkezés confirm: Mégse default fókusz.

---

## 3. Információs architektúra (v1)

```
Belépés
   ↓
[Ma]  [Jelenlét]  [Belépők]  [Figyelem]  [Több]
                                      ↑ Gyártás → Több lista
```

| Tab | Job (egy mondat) | Primary tartalom |
|---|---|---|
| **Ma** | „Mennyi jött be ma / hónapban?” | Hero mai forgalom + MTD + belépő glance |
| **Jelenlét** | „Ki van bent?” | Placeholder → később jelenlét glance |
| **Belépők** | „Hányan jöttek be?” | Hero szám + Ma\|Hét\|Hó segmented + full-width bar |
| **Figyelem** | „Mi vár döntésre / pénzre / hangra?” | Partner inbox + AR + silent |
| **Több** | Cég / kijárat / ritkább | Tenant, **Gyártás** (lapszab), web, kijelentkezés |

**Miért 5 tab?** Apple HIG + Material + Android native max. Gyártás nem 6. tab — Square More mintára a Több alatt.

---

## 4. Vizuális tokenek (mobil)

| Token | Érték |
|---|---|
| Háttér | `#FAFAFA` (subtle) |
| Surface / kártya | `#FFF` + 1px `#E4E4E7` |
| Ink | `#18181B` |
| Secondary | `#52525B` |
| Hero szám | ~34–40px / 700 / tabular |
| Kártya cím | 12px semibold muted uppercase vagy sentence |
| Kártya szám | ~20–22px / 600 |
| Delta fel | success ink + szöveg („+12%”) |
| Delta le / figyelmeztetés | warning/danger + szöveg |
| Tab bar | native iOS; aktív = ink; idle = muted |
| Safe area | kötelező; bottom tab felett tartalom padding |
| Gomb | default ~40–44px **csak** primary CTA-n (Belépés / Kijelentkezés) — lista sorok sűrűbbek (~36–40) |

**Tilos:** gradiens/glow, lila-on-white AI klisé, kártyaerdő 8 KPI egy viewportban, infinite scroll riportokban.

---

## 5. Wireframe-ek (ASCII)

### 5.1 Belépés (implementálva)

```
┌─────────────────────────┐
│   [ Turinova logo ]     │
│   Optinova · Vezető     │
│ Email / Jelszó [👁]     │
│ [      Belépés        ] │  ← egy primary; nincs hint / deep link / forgot
└─────────────────────────┘
```



### 5.2 Ma (hero)

```
┌─────────────────────────┐
│ Ma          Asztalos Kft│  ← cím + tenant (nincs Optinova H1)
│─────────────────────────│
│ Mai forgalom            │
│ 1 248 000 Ft            │  ← HERO
│ ▁▂▃▅▄▆█ 7 nap           │  ← spark
│ vs tegnap  +8%          │
│─────────────────────────│
│ ┌──────────┐ ┌────────┐ │
│ │ Havi MTD │ │Kinnlevő│ │  ← 2 secondary card
│ │ 18,2 M   │ │ 420 e  │ │
│ └──────────┘ └────────┘ │
│ ┌─────────────────────┐ │  ← lapszab ON
│ │ Mai lapszabászat    │ │
│ └─────────────────────┘ │
│ Belépők ma        128   │  ← lean glance; tap → Belépők tab
│ ▁▂▃▅██▄                 │
└─────────────────────────┘
```

Tap forgalom/kintlévő → web. Belépő glance → native Belépők tab.

### 5.2b Belépők (Square / Midday — egy hero)

```
┌─────────────────────────┐
│ Belépők     Asztalos Kft│
│ [  Ma  |  Hét  |  Hó  ] │  ← segmented
│                         │
│          128            │  ← HERO ~44px, nincs Card keret
│        belépő           │
│ Kilépő 41 · bent 87     │  ← max 1 hint
│                         │
│ ▁▂▃▅██▄▃▂▁              │  ← full-width bar
│  8      12     17       │
│ Csúcs 14:00 · 32        │  ← max 1 detail
└─────────────────────────┘
```

**Tilos:** 2×2 KPI grid, „Forgalom” dekor cím, Live/Idle badge a hero mellett.

### 5.3 Gyártás (lapszab)

```
┌─────────────────────────┐
│ Gyártás                 │
│ Elmaradás               │
│ 42 m · 7 megrendelés    │  ← hero figyelmeztetés
│ Lejárt gyártási nap     │
│ [ Megnyitás listában → ]│  ← deep link overdue
│─────────────────────────│
│ Heti szabás (H–P)       │
│ [egyszerű bar / számok] │
│ Mai terhelés  68%       │
│ Hátra         120 m     │
└─────────────────────────┘
```

### 5.4 Figyelem (action inbox)

```
┌─────────────────────────┐
│ Figyelem                │
│ Új partner rendelések 3 │
│ ┌─────────────────────┐ │
│ │ Kovács Bt. · 2 órája│ │
│ │ 186 000 Ft          │ │
│ └─────────────────────┘ │
│ Kintlévőség             │
│ ┌ Nagy Bt.    210 e → ┐ │
│ └ Kis Kft.     90 e → ┘ │
│ Kiemelt — csendes       │
│ ┌ Asztalos X  48 nap  ┐ │
└─────────────────────────┘
```

Empty: „Nincs új teendő. A Ma tabon látod a forgalmat.”

### 5.5 Több

```
┌─────────────────────────┐
│ Több                    │
│ Cég                     │
│ ○ Asztalos Kft. (aktív) │
│ ○ Másik Bt.             │
│─────────────────────────│
│ Belépők ma    128 / 41  │  ← addon
│ Jelenlét      4/6 bent  │
│─────────────────────────│
│ Megnyitás böngészőben → │
│ Kijelentkezés           │
└─────────────────────────┘
```

---

## 6. Navigáció és gesztusok

| Gesztus | Viselkedés |
|---|---|
| Pull-to-refresh | Frissít aktív tab adatát |
| Tap metric card | Deep link staff web (ugyanaz a session ha lehetséges, különben login `?next=`) |
| Tap partner sor | Ajánlat / ügyfél web detail |
| Long-press | **Nincs** v1 (certainty: ne rejtett akció) |
| Swipe tab között | Native tab switch OK |
| Biometria | Fázis 3: unlock meglévő sessionre — nem helyettesíti a staff jelszót első belépéskor |

---

## 7. Copy (HU) — hang

- Címek: **Ma**, **Gyártás**, **Figyelem**, **Több** — ne „Dashboard”, „Analytics”.  
- Hero label: „Mai forgalom”, nem „GMV”.  
- Figyelmeztetés: „Lejárt gyártási nap, még nem kész” ([35](35-home-kpis.md)).  
- Hiba: magyaráz + mit tegyen („Nézd a Wi‑Fi-t és húzd le frissítéshez”).  
- Tenant: „A számaid a kiválasztott céghez tartoznak.”

---

## 8. Mit *ne* építsünk a UI-ba (v1)

- Szerkeszthető widget grid / drag-reorder (Square késői feature)  
- Teljes chart suite (heti stacked mindent) — glance elég  
- Dark mode  
- Push badge mindenre — csak később, kevés típus  
- In-app Opti / POS / számla  
- „AI insight” szövegblokkok

---

## 9. Implementációs sorrend (UI)

1. **Ma shell** — tenant header + hero Ft (egy szám a home KPI-ból) + 2 secondary card  
2. Tab bar IA (Ma / Figyelem / Több; Gyártás ha entitlement)  
3. Figyelem listák (inbox → AR → silent)  
4. Gyártás elmaradás  
5. Spark / micro-viz (ha nem lassít)  
6. Deep link + empty states  
7. Biometria / ikon / TestFlight polish  

---

## 10. DoD (ez a doc)

- [x] Referencia → elvek  
- [x] 4 tab IA + wireframe  
- [x] Token + tilos lista  
- [x] Design review irány → Fázis 1b implementálva (`vezetoi-mobile` tabok + Ma hero)  
