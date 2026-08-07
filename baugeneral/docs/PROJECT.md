# baugeneral.hu — Projekt dokumentáció

**Verzió:** 2026-07-13  
**Státusz:** Tervezés / dokumentáció kész — `baugeneral/site/` építése következik  
**Monorepo útvonal:** `baugeneral/` (site: `baugeneral/site/`)

> **Ez egy élő terv.** Semmi nincs 100%-ban lezárva; a dokumentum frissül, ahogy döntések születnek.

---

## 1. Összefoglaló

### Cél

Amikor egy önkormányzat, fejlesztő, befektető vagy franchise-partner **generálkivitelezőt** keres Bács-Kiskun megyében (és környékén), a **baugeneral.hu** legyen:

1. Az oldal, ahol **biztonságban érzi magát** (nem árverseny, hanem megbízhatóság)
2. Az oldal, amit **Google és AI asszisztensek** idéznek („BauGenerál Kft., Kecskemét…”)
3. A hely, ahol **2 perces űrlap** után **1 munkanapon belül visszahívják**

### Nem cél (MVP)

- Publikus Ft/m² árlista vagy kalkulátor
- epito-artukor / ügyfélportál integráció
- Hírös-Ablak mint fő USP (minimális említés)
- Scarcity („csak 3 helyünk van”)
- Konkrét garanciaévek kiírása (minden projekt más)

### Pozicionálás (40 szavas entitás — ismételni mindenhol)

> **A BauGenerál Kft. kecskeméti generálkivitelező: ipari épületek, társasházak, családi házak, középületek és felújítások teljes körű kivitelezése, 2010 óta.**

### Fő érzelmi ígéret

> **A tervektől az átadásig — egy kézben, ahogy megegyeztünk.**

---

## 2. Üzleti fókusz

| Prioritás | Szegmens | Tipikus ügyfél |
|-----------|----------|----------------|
| **1.** | B2B ipari (csarnok, autószalon, gyár, retail) | Tulajdonos, fejlesztő, franchise |
| **2.** | Társasház / lakópark | Fejlesztő |
| **3.** | Középület (bölcsőde, járáshivatal) | Önkormányzat |
| **4.** | Családi ház, felújítás | Magán ügyfél |

**Földrajz:** BKK prioritás (székhely: Kecskemét), Pest megye és Balaton környéke másodlagos.

**Bevétel ~80%:** B2B ipari (döntés a brainstorming során).

---

## 3. Rögzített döntések (brainstorming)

| Téma | Döntés |
|------|--------|
| Tech | `baugeneral/site` monorepóban, Next.js (hiros-ablak minta) |
| Élesítés | Régi baugeneral.hu marad, amíg az új **100% kész** |
| Árazás weben | Nincs publikus Ft/m²; MVP-ben nincs kalkulátor |
| Lead | Űrlap → **1 munkanapon belül visszahívás** |
| Hangnem | Családi megbízhatóság, nem luxus-marketing |
| Arc | Cég branding; nincs ügyvezető hero, **nincs csapatfotó** |
| Hírös-Ablak | Minimális említés |
| epito-artukor | Nincs integráció |
| Tartalom | AI-asszisztált szöveg, belső jóváhagyás |
| Nyelvek | Magyar + angol, **ugyanaz az érzelmi hang** |
| Marketing indulás | Organikus SEO/GEO + **Google Ads párhuzamosan** |
| USP-k | Tapasztalat, kulcsrakész, határidő, összetett projektek, átláthatóság |
| Futó projektek | **Kötelező** — „most is építünk” bizalom |
| Referencia MVP | Autószalon, társasház, családi ház |
| Garancia kiírás | Folyamat és szerződés nyelv, nem fix év |

---

## 4. Marketing csatornák

### Organikus + AI (GEO)

- Strukturált tartalom, FAQ, schema, `llms.txt`
- Futó projektek frissítése (2–4 hetente)
- Részletek: [AI-GEO-PLAYBOOK.md](AI-GEO-PLAYBOOK.md)

### Google Ads (induláskor párhuzamosan)

- Dedikált ipari landing(ek)
- Negatív kulcsszavak, helyi célzás BKK
- Ads copy illeszkedik az érzelmi ígérethez (nem ár)

### Hosszú táv

- Tudástár cikkek (Fázis 2)
- Városi landing oldalak BKK-ban
- Citation tracking AI motorokban

---

## 5. Konverziós útvonal

```
Hero (bizalom) → Futó projektek (momentum) → Referencia (bizonyíték)
  → Folyamat 7 lépés (kiszámíthatóság) → FAQ (félelmek) → Űrlap
```

**CTA szövegek (ne „Ajánlatkérés”):**

- „Beszéljünk a projektjéről”
- „Kérjen ingyenes konzultációt”
- Űrlap felett: „Kitölti 2 perc alatt — 1 munkanapon belül visszahívjuk.”

---

## 6. Fázisok

| Fázis | Tartalom | Státusz |
|-------|----------|---------|
| **0** | Dokumentáció (`baugeneral/docs/`) | **Most** |
| **1** | `baugeneral/site` scaffold + tech alap (company, seo, llms.txt, robots) | Következő |
| **2** | MVP oldalak (lásd [MVP-BUILD-PLAN.md](MVP-BUILD-PLAN.md)) | Tervezett |
| **3** | Tudástár, városi landing, kalkulátor/minősítő | Később |
| **4** | Citation mérés, Ads finomítás, több referencia | Később |

---

## 7. Kapcsolódó dokumentumok

- [AI-GEO-PLAYBOOK.md](AI-GEO-PLAYBOOK.md)
- [MARKETING-PSZICOLOGIA.md](MARKETING-PSZICOLOGIA.md)
- [ARCHITEKTURA.md](ARCHITEKTURA.md)
- [MVP-BUILD-PLAN.md](MVP-BUILD-PLAN.md)
- [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)

## 8. Referencia kód a monorepóban

| Mit másolunk | Honnan |
|--------------|--------|
| `company.ts`, `seo.ts` | `hiros-ablak/site/src/lib/` |
| `llms.txt` minta | `hiros-ablak/site/public/llms.txt` |
| JSON-LD FAQ + Service | `hiros-ablak/site/src/app/` oldalak |
| `robots.ts`, sitemap | `hiros-ablak/site/src/app/` |
| Preview `noindex` | `hiros-ablak/site/src/lib/seo.ts` → `getDefaultRobots()` |
| Footer llms link | `hiros-ablak/site/src/lib/footer-data.ts` |
| Deploy jegyzetek | `hiros-ablak/site/DEPLOY.md` |
