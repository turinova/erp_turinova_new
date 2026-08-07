# BauGeneral.hu — marketing web

**Domain:** [baugeneral.hu](https://baugeneral.hu)  
**Monorepo útvonal:** `baugeneral/site/` (mint `hiros-ablak/site/`)  
**Státusz:** Phase A+B kész — web váz (header, footer, stub oldalak, SEO alapok). Tartalom oldalanként következik.

---

## Mi ez a projekt?

A BauGenerál Kft. új marketing weboldala: **B2B ipari generálkivitelezés** fókusszal (BKK / Kecskemét), de minden szolgáltatás megjelenik. A web **emberi bizalomra** és **AI keresőkben való idézhetőségre** (GEO) épül — a [hiros-ablak](../hiros-ablak/site/) projekt bevált mintáira támaszkodva.

## Dokumentáció

| Dokumentum | Tartalom |
|------------|----------|
| [docs/PROJECT.md](docs/PROJECT.md) | Fő projekt brief: cél, döntések, pozicionálás, ütemterv |
| [docs/AI-GEO-PLAYBOOK.md](docs/AI-GEO-PLAYBOOK.md) | AI kereső optimalizálás: llms.txt, schema, crawler, hiros-ablak minták |
| [docs/MARKETING-PSZICOLOGIA.md](docs/MARKETING-PSZICOLOGIA.md) | Érzelmi útvonal, copy szabályok, konverzió |
| [docs/ARCHITEKTURA.md](docs/ARCHITEKTURA.md) | Oldalfák, URL-ek, tartalmi sablonok |
| [docs/MVP-BUILD-PLAN.md](docs/MVP-BUILD-PLAN.md) | Lépésről lépésre építési sorrend (következő fázis) |
| [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md) | Még nem végleges döntések és hiányzó adatok |

## Kapcsolódó projektek a monorepóban

- **hiros-ablak/site** — technikai és AI/SEO referencia (Next.js, `company.ts`, `llms.txt`, JSON-LD)
- **customer-portal** — marketing landing minták (ROI kalkulátor UX, ha később kell)
- **epito-artukor** — nincs integráció az MVP-ben; külön B2B app

## Következő lépés

1. `cd baugeneral/site && npm run dev` — **http://localhost:3011**
2. Tartalom: [MVP-BUILD-PLAN.md](docs/MVP-BUILD-PLAN.md) Phase C — főoldal teljes tartalom, majd ipari → folyamat → kapcsolat…
3. Hiányzó adatok: [OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md)
