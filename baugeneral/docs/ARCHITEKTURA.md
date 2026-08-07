# Oldal-architektúra — baugeneral.hu

**Nyelvek:** `/` magyar, `/en/` angol (MVP: fő, ipari, folyamat, 3 ref, kapcsolat).

---

## 1. Oldalfák

```
baugeneral.hu/
│
├── /                                    Főoldal
├── /gyors-tenyek                        AI fact sheet (ajánlott)
│
├── /szolgaltatasok/
│   ├── /ipari-epuletek                  ★ fő pillér
│   ├── /tarshazak
│   ├── /csaladi-haz-epites
│   ├── /kozepuletek
│   └── /felujitas
│
├── /folyamat                            HowTo schema, 7 lépés
├── /garancia-es-felelosseg              Folyamat, nem fix év
│
├── /futo-projektek/
│   └── /[slug]                          Építés alatt, dateModified
│
├── /referenciak/
│   └── /[slug]                          Kész: autószalon, társasház, családi ház
│
├── /rolunk
├── /kapcsolat
│
├── /tudastar/                           Fázis 2
│   └── /[slug]
│
├── /en/                                 Angol tükör (MVP részhalmaz)
│   ├── /
│   ├── /services/industrial-buildings
│   ├── /process
│   ├── /projects/...
│   └── /contact
│
├── /llms.txt
├── /sitemap.xml
├── /robots.txt
│
└── Jogi (később): adatkezelés, cookie, ászf
```

---

## 2. Navigáció (javasolt)

**Főmenü:**

- Szolgáltatások (dropdown)
- Futó projektek
- Referenciák
- Folyamat
- Rólunk
- Kapcsolat
- EN / HU váltó

**Footer:**

- Szolgáltatások listája
- NAP
- `/llms.txt` link
- Jogi oldalak

---

## 3. Oldaltípus sablon — „7 blokk” (GEO + pszichológia)

Minden pénzoldal (szolgáltatás, ref, futó):

| # | Blokk | Tartalom |
|---|-------|----------|
| 1 | TL;DR | 40–60 szó összefoglaló |
| 2 | Hero | Érzelmi hook + CTA |
| 3 | H2 szekciók | Kérdés + válasz kapszula |
| 4 | Táblázat/lista | Fázisok, típusok, összehasonlítás |
| 5 | FAQ | 5–10 + schema |
| 6 | Key takeaways | 4–6 bullet |
| 7 | CTA + kapcsolódó linkek | Űrlap vagy /kapcsolat |

---

## 4. Futó projekt kártya (lista)

| Mező | Példa |
|------|-------|
| Cím | „Kereskedelmi épület, Kecskemét” |
| Típus | Ipari |
| Fázis | Szerkezetépítés |
| Időablak | 2025.03 – 2026.09 |
| Fotó | 1 friss |
| Utolsó frissítés | 2026.07.13 |
| Link | `/futo-projektek/...` |

**Nem:** ügyfélnév, pontos cím, összeg.

---

## 5. Referencia oldal (kész)

| Szekció | Tartalom |
|---------|----------|
| Hero | Fotó + cím + típus |
| TL;DR | 40–60 szó |
| Kihívás | Mi volt nehéz? |
| Megoldás | Mit csinált a BauGeneral? |
| Eredmény | Határidő, minőség |
| Adatok | Város, év, m² (ha ok) |
| CTA | Hasonló projekt? |
| Schema | CreativeWork / Project + Breadcrumb |

**MVP slugs (tervezett):**

- `autoszalon-...`
- `tarshaz-...`
- `csaladi-haz-...`

---

## 6. Ipari oldal — szegmens hookok

| Szegmens | Hero alcím érzelme |
|----------|-------------------|
| Tulajdonos | „Az üzeme nem várhat — időben kész legyen.” |
| Fejlesztő | „Egy felelős partner az egész kivitelezésre.” |
| Önkormányzat | „Közbeszerzési elvárásoknak megfelelően, dokumentálva.” |
| Franchise | „A standardnak megfelelően, elsőre jól.” |

(Egy hero MVP-ben; szegmens szöveg FAQ-ban vagy későbbi landingeken.)

---

## 7. Adatmodell (MVP — fájl alapú vagy TS)

Később Supabase opcionális; induláskor elég:

```ts
// src/lib/projects.ts — példa struktúra
type ProjectBase = {
  slug: string
  title: string
  type: "industrial" | "condo" | "family" | "public" | "renovation"
  city: string
  yearStarted?: number
  yearCompleted?: number
  areaSqm?: number
  challenge: string
  solution: string
  outcome: string
  images: { src: string; alt: string }[]
  published: boolean
}

type ActiveProject = ProjectBase & {
  status: "planning" | "foundation" | "structure" | "mep" | "finishing"
  expectedCompletion?: string // pl. "2026-09"
  lastUpdated: string // ISO date
}
```

---

## 8. Belső linkháló (AI + SEO)

Minden szolgáltatás oldal linkeljen:

- `/folyamat`
- `/futo-projektek` (ha van releváns típus)
- 1–2 `/referenciak/[slug]`
- `/kapcsolat`

Főoldal linkel minden pillérre.

---

## 9. Képek

| Típus | Forrás |
|-------|--------|
| Hero | Saját projekt / drón |
| Futó | Heti-havi frissítés |
| Ref | Befejezett állapot |
| **Nem** | Stock „mosolygó munkás”, mű csapatfotó |

Szerkesztés: sRGB JPEG (hiros DEPLOY.md: iPhone P3 → sRGB).
