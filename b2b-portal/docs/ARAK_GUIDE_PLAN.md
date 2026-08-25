# Árak — merchant útmutató (terv + edge case stress)

**Dátum:** 2026-08-25  
**Státusz:** GO implementációra (döntések lezárva)  
**Kapcsolódó eng doc:** [`B2B_PRICING_STRATEGIES.md`](./B2B_PRICING_STRATEGIES.md)

---

## 1. Lezárt döntések

| # | Döntés | Érték |
|---|--------|-------|
| 1 | Navigáció | **Árak almenü:** Árazás (`/arak`) + Útmutató (`/arak/utmutato`) |
| 2 | Stratégiák a guide-ban | **5** (4 élő + 1 „Hamarosan”: mennyiségi sáv) |
| 3 | Első belépés overlay / banner | **Nem** |
| 4 | Beszerzés / árrés | **Említve** a guide-ban (olvasás, nem cost-plus gomb) |
| 5 | Sorrend | Edge case → terv frissítés → UI (nincs új árazó funkció ebben a PR-ben) |

---

## 2. Edge case & stress (mielőtt kód)

### 2.1 Navigáció / IA

| Case | Kockázat | Szabály |
|------|----------|---------|
| `/arak` vs `/arak/utmutato` | Mindkettő „Árak” active → zavar | Parent **Árak** kiemelve, ha `pathname.startsWith("/arak")`; gyerek **pontos** match |
| `isActive("/arak")` ma `startsWith` | Útmutató is „Árazás” active lenne | Gyerekekre **exact** (`===` vagy trailing slash nélkül) |
| Mobile chip sor | Almenü elfér? | Két chip: **Árazás** + **Útmutató** (nem nested) |
| Header `h1` | Mindig „Árak” | `/arak` → „Árazás”; `/arak/utmutato` → „Útmutató” |
| `fullBleed` | Guide tábla-layoutban full bleed | **Csak** `/arak` exact (PricesView); `/arak/utmutato` → padded `main` |
| Deep link bookmark | Régi `/arak` link | Marad Árazás — semmi törés |
| Impersonate | Shell ugyanaz | Nincs különág |

### 2.2 Tartalom pontosság (support-kockázat)

| Case | Kockázat | Szabály |
|------|----------|---------|
| „Mennyiségi sáv” késznek tűnik | Merchant keresi a UI-t | Badge **Hamarosan**; nincs CTA az Árazásra sáv-szerkesztőre |
| Csoport % vs bulk −15% | Összekeverés #1 | Külön kártya + 1 mondat: „% = egész csoport; bulk = kijelöltekre **fix** ár” |
| Fix drágább, mint a % | „Miért nem a %?” | Precedencia: **fix mindig győz** (SR/portál terv) |
| Cost üres (—) | Guide ígér árrést | Szöveg: „ha kitöltötted a Shoprenterben”; ha nincs → — |
| ÁFA 27% | Bruttó eltérhet | Egy mondat: „Bruttó jelenleg 27%-kal számolva (becsült)” |
| Mirror / késleltetés | „A bolt mást mutat” | „Az ár a Shoprenterbe mentődik; a lista a tükörből gyors” |
| Névtelen / nem bolt-SKU | Guide nem említi | Eng téma; guide nem ígér 1:1 boltfront listát |
| Eng ID-k (P-01…) | Merchant zavar | Guide-ban **nincs** P-kód; csak magyar név |

### 2.3 UX / a11y stress

| Case | Szabály |
|------|---------|
| Hosszú oldal mobil | Szekciónként egy H2; sticky nincs kötelező |
| CTA „Megnyitom az Árazást” | Link `/arak` — minden élő stratégiánál OK; sávnál **nincs** |
| Reduced motion | Nincs animáció / max opacity |
| Kártyák | Csak ha CTA van — különben szekció (design system: ne dekoratív kártyahalom) |
| Nyelv | Végig magyar, tegezés mint a portál |

### 2.4 Mit *nem* csinálunk ebben a körben

- P-05 módválasztó, P-06 UI, P-10 gomb  
- Első belépés modal  
- Cost plan-kapu változtatás  
- Angol locale  

---

## 3. Oldal váz (`/arak/utmutato`)

1. **Cím:** Hogyan árazz B2B partnereket  
2. **Lead:** 1–2 mondat — Shoprenter az igazság; itt állítod a csoportárakat.  
3. **Precedencia** sáv: Fix → (később sáv) → Csoport % → Bolti lista  
4. **5 stratégia** (sorrend):
   - Csoport kedvezmény %
   - Fix partnerár
   - Lista −% → rögzített ár (bulk / márka)
   - Bolti listaár (referencia)
   - Mennyiségi sáv — **Hamarosan**
5. **Beszerzés és árrés** — rövid: mit látsz az Árazáson; nem automata cost-plus  
6. **GYIK** (3): % vs bulk; fix vs %; miért bruttó  
7. **CTA** alul: Árazás megnyitása  

---

## 4. Implement fájlok

| Fájl | Változás |
|------|----------|
| `MerchantShell.tsx` | Árak children; title; fullBleed exact `/arak` |
| `app/(merchant)/arak/utmutato/page.tsx` | Új |
| `components/merchant/PricingGuideView.tsx` | Tartalom |
| `PricesView.tsx` | Fejléc link „Útmutató” (opcionális, döntés: igen) |
| `docs/ARAK_MERCHANT_GUIDE.md` | Merchant copy forrás / review |
| `B2B_PRICING_STRATEGIES.md` | §11 IA + hivatkozás |

---

## 5. Done when

- [x] Desktop: Árak alatt Árazás + Útmutató, active state helyes  
- [x] Mobile: mindkét chip  
- [x] `/arak/utmutato` padded, 5 stratégia + cost szekció, nincs first-visit banner  
- [x] Sáv = Hamarosan, nincs hamis CTA  
- [x] `/arak` továbbra is fullBleed PricesView  
