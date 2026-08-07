import { REFERENCE_STOCK as S, stock } from "@/lib/reference-stock-images"

export type ReferenceType =
  | "industrial"
  | "condo"
  | "family"
  | "public"
  | "renovation"
  | "trades"
  | "carpentry"

export type ReferenceImage = {
  src: string
  alt: string
}

export type Reference = {
  slug: string
  title: string
  type: ReferenceType
  city: string
  yearCompleted: number
  /** pl. „14 hónap” */
  duration: string
  /** pl. „Teljes körű generálkivitelezés” */
  scope: string
  areaSqm?: number
  featured?: boolean
  tldr: string
  challenge: string
  solution: string
  outcome: string
  listTeaser: string
  heroImage: ReferenceImage
  cardImage: ReferenceImage
  gallery: ReferenceImage[]
  published: boolean
}

export const REFERENCE_TYPE_LABELS: Record<ReferenceType, string> = {
  industrial: "Ipari",
  condo: "Társasház",
  family: "Családi ház",
  public: "Középület",
  renovation: "Felújítás",
  trades: "Szakági",
  carpentry: "Asztalos",
}

/** Sorrend = szolgáltatás menü — filter + listázás */
export const REFERENCE_TYPE_ORDER: ReferenceType[] = [
  "industrial",
  "condo",
  "family",
  "public",
  "renovation",
  "trades",
  "carpentry",
]

/** Nav ServiceIconKey mapping a típuschiphez */
export const REFERENCE_TYPE_ICON: Record<
  ReferenceType,
  "industrial" | "condo" | "house" | "public" | "reno" | "trades" | "carpentry"
> = {
  industrial: "industrial",
  condo: "condo",
  family: "house",
  public: "public",
  renovation: "reno",
  trades: "trades",
  carpentry: "carpentry",
}

/**
 * MVP referenciák — stock fotók (public/img).
 * TODO: cserélje valódi projektfotókra go-live előtt.
 */
export const REFERENCES: Reference[] = [
  {
    slug: "ikerhaz-sajat-kecskemet",
    title: "Ikerház Kecskeméten, saját beruházás",
    type: "family",
    city: "Kecskemét",
    yearCompleted: 2026,
    duration: "14 hónap körül",
    scope: "Kétlakásos lakóház, kulcsrakész átadás",
    areaSqm: 379,
    featured: true,
    listTeaser:
      "Kecskeméti ikerház saját beruházásban. Teljes kivitelezés a szerkezettől a bútorig, hőszivattyúval és napelem-előkészítéssel.",
    tldr:
      "Kecskeméten, saját beruházásként készült el ez a kétlakásos lakóház. Két lakás, egyenként négy szobával, nappalival és dupla garázzsal, teraszokkal. A hasznos alapterület közel 379 négyzetméter. A munkát a szerkezettől vezettük végig: nyílászárók, burkolatok, gépészet, villamos, kerítés. Hőszivattyú, napelem-előkészítés, Hírös-Ablak beépített bútor. Átadás 2026-ban. A kertépítés még tart.",
    challenge:
      "Ikerháznál két lakás fut párhuzamosan. Ha a szakágak nincsenek egy ütemben, a ház késik, és a minőség is megsínyli. Saját beruházásként a felelősség nálunk maradt végig.",
    solution:
      "Egy építésvezetés, egy ütemterv, egy kapcsolattartás. A belső szakágakat a szerkezet és a nyílászárók után vezettük be, a bútor a ház készültségéhez igazodott, nem utólagos toldalékként érkezett.",
    outcome:
      "2026-ban átadtuk a házat. Kerítés és térkő kész. A kertépítés zárja a telek kialakítását.",
    heroImage: {
      src: "/img/projects/ikerhaz-sajat-kecskemet/hero.jpg",
      alt: "Ikerház Kecskeméten, teraszos homlokzat",
    },
    cardImage: {
      src: "/img/projects/ikerhaz-sajat-kecskemet/hero.jpg",
      alt: "Ikerház Kecskeméten, saját beruházás",
    },
    gallery: [
      {
        src: "/img/projects/ikerhaz-sajat-kecskemet/gate.jpg",
        alt: "Kapu és térkő, Kecskemét",
      },
      {
        src: "/img/projects/ikerhaz-sajat-kecskemet/courtyard.jpg",
        alt: "Udvar és garázsok",
      },
      {
        src: "/img/projects/ikerhaz-sajat-kecskemet/yard.jpg",
        alt: "Kert a kialakítás előtt",
      },
    ],
    published: true,
  },
  {
    slug: "autoszalon-kecskemet",
    title: "Autószalon / kereskedelmi épület · Kecskemét",
    type: "industrial",
    city: "Kecskemét",
    yearCompleted: 2023,
    duration: "14 hónap",
    scope: "Teljes körű generálkivitelezés",
    areaSqm: 1850,
    featured: true,
    tldr:
      "Új kereskedelmi létesítmény teljes körű generálkivitelezéssel: szerkezet, burkolatok, gépészeti előkészítés és átadás egy felelős csapattal, ütemezett bontási ütemmel.",
    listTeaser:
      "Kereskedelmi épület teljes körű kivitelezése: egy felelős csapat, rögzített átadási ütem.",
    challenge:
      "A megrendelő szoros nyitási határidővel indult, miközben a gépészeti és villamos előkészítések párhuzamosan kellett hogy zajljanak. A kivitelezés nem engedett hosszú állásidőt a szakágak között.",
    solution:
      "Heti építésvezetői egyeztetés, helyszíni művezetés és előre egyeztetett szakági sorrend. A kritikus szerkezeti és burkolási munkákat úgy ütemeztük, hogy a belső szakágak azonnal tudjanak csatlakozni.",
    outcome:
      "Az épület átadása a tervezett időablakon belül történt. A megrendelő egy kapcsolattartón keresztül kapta a státuszjelentéseket, a helyszíni minőség-ellenőrzés dokumentáltan zajlott.",
    heroImage: {
      src: S.ipariHero,
      alt: "Stock fotó: kereskedelmi épület, referencia helyőrző",
    },
    cardImage: {
      src: S.ipariNav,
      alt: "Stock fotó: ipari kereskedelmi épület, referencia helyőrző",
    },
    gallery: [
      stock("munka", "Stock fotó: kivitelezés folyamat, referencia helyőrző"),
      stock("telephely", "Stock fotó: projekt helyszín, referencia helyőrző"),
      stock("ipariNav", "Stock fotó: homlokzat részlet, referencia helyőrző"),
      stock("kozepulet", "Stock fotó: belső tér előkészítés, referencia helyőrző"),
      stock("kapcsolatHero", "Stock fotó: szerkezeti állapot, referencia helyőrző"),
      stock("telephelyPng", "Stock fotó: átadás előtti állapot, referencia helyőrző"),
      stock("felujitas", "Stock fotó: burkolási munkák, referencia helyőrző"),
    ],
    published: true,
  },
  {
    slug: "tarshaz-lakopark",
    title: "Lakópark, 4200 m² · Bács-Kiskun",
    type: "condo",
    city: "Bács-Kiskun megye",
    yearCompleted: 2022,
    duration: "18 hónap",
    scope: "Lakópark, szerkezettől átadásig",
    areaSqm: 4200,
    listTeaser:
      "Lakópark építése generálkivitelezéssel: párhuzamos szakágak, dokumentált átadás.",
    tldr:
      "Több lakásos társasház teljes körű kivitelezése: szerkezetépítés, szerkezetlezárás, gépészeti és villamos előkészítés, közös terekkel együtt, egy koordinált ütemezésben.",
    challenge:
      "A projekt több épület-résszel és párhuzamos szakági csatlakozással indult. A kivitelezői felelősség határain belül több alvállalkozói csoportot kellett összehangolni anélkül, hogy az ütemezés szétesett volna.",
    solution:
      "Központi építésvezetés, heti ütemezési felülvizsgálat és helyszíni művezetői jelenlét a kritikus csomópontokon. A szakági átadásokat írásban rögzítettük, mielőtt a következő fázis indulhatott.",
    outcome:
      "A közös terek és a lakások kivitelezési fázisai egymáshoz igazítva zárultak. A fejlesztő egy helyről kapta a projektállapot-visszajelzéseket.",
    heroImage: {
      src: S.munka,
      alt: "Stock fotó: társasház építés, referencia helyőrző",
    },
    cardImage: {
      src: S.telephely,
      alt: "Stock fotó: lakóépület, referencia helyőrző",
    },
    gallery: [
      stock("kozepulet", "Stock fotó: lakóépület homlokzat, referencia helyőrző"),
      stock("kapcsolatHero", "Stock fotó: közös terek, referencia helyőrző"),
      stock("telephelyPng", "Stock fotó: helyszín, drón, referencia helyőrző"),
      stock("ipariHero", "Stock fotó: szerkezetépítés, referencia helyőrző"),
      stock("telephely", "Stock fotó: környezet, referencia helyőrző"),
      stock("csaladi", "Stock fotó: lakás belső tér, referencia helyőrző"),
      stock("munka", "Stock fotó: kivitelezés állapot, referencia helyőrző"),
    ],
    published: true,
  },
  {
    slug: "csaladi-haz-bacs-kiskun",
    title: "Kulcsrakész családi ház · 185 m²",
    type: "family",
    city: "Bács-Kiskun megye",
    yearCompleted: 2024,
    duration: "9 hónap",
    scope: "Kulcsrakész családi ház",
    areaSqm: 185,
    listTeaser:
      "Kulcsrakész családi ház meglévő terv alapján, egy felelős generálkivitelezővel, az átadásig.",
    tldr:
      "Egyedi családi ház teljes körű kivitelezése: alapozás, szerkezet, nyílászárók, burkolatok és átadás. A megrendelő egy kapcsolattartón keresztül követte a munkát.",
    challenge:
      "A telek adottságai és a megrendelői igények miatt több technikai döntést kellett helyben, a kivitelezés közben meghozni. A minőség és az ütemezés nem sérülhetett a módosítások miatt.",
    solution:
      "Heti státusz egyeztetés, helyszíni művezetői jelenlét és előzetes jóváhagyás minden lényeges változtatás előtt. A szakágak sorrendje úgy lett felépítve, hogy a visszabontás minimalizálódjon.",
    outcome:
      "A ház átadása a megbeszélt ütemben történt. A megrendelő dokumentált átadási körben vette át az épületet.",
    heroImage: {
      src: S.kapcsolatHero,
      alt: "Stock fotó: családi ház, referencia helyőrző",
    },
    cardImage: {
      src: S.csaladi,
      alt: "Stock fotó: családi ház homlokzat, referencia helyőrző",
    },
    gallery: [
      stock("felujitas", "Stock fotó: belső kivitelezés, referencia helyőrző"),
      stock("telephely", "Stock fotó: telek környezet, referencia helyőrző"),
      stock("csaladi", "Stock fotó: homlokzat, referencia helyőrző"),
      stock("munka", "Stock fotó: szerkezet állapot, referencia helyőrző"),
      stock("kapcsolatHero", "Stock fotó: burkolatok, referencia helyőrző"),
      stock("kozepulet", "Stock fotó: nyílászárók, referencia helyőrző"),
      stock("telephelyPng", "Stock fotó: átadás, referencia helyőrző"),
    ],
    published: true,
  },
  {
    slug: "kozepulet-ovoda",
    title: "Óvoda, közbeszerzési kivitelezés",
    type: "public",
    city: "Bács-Kiskun megye",
    yearCompleted: 2021,
    duration: "12 hónap",
    scope: "Óvoda, közbeszerzési kivitelezés",
    areaSqm: 980,
    listTeaser:
      "Középületi generálkivitelezés — dokumentált átadás, közbeszerzési elvárásoknak megfelelően.",
    tldr:
      "Óvoda teljes körű kivitelezése: szerkezet, szerkezetlezárás, belső szakágak és közös terek átadása egy koordinált ütemezésben, a közbeszerzési dokumentáció szerint.",
    challenge:
      "A középületi projekt szigorú dokumentációs és átadási elvárásokkal indult, miközben a használatba vételi határidő fix volt. A szakágak csatlakozása nem tolódhatott.",
    solution:
      "Előre rögzített mérföldkövek, heti építésvezetői jelentés és helyszíni ellenőrzés minden átadási ponton. Az eltérések azonnal, írásban kerültek egyeztetésre.",
    outcome:
      "Az épület átadása a szerződésben rögzített ütemben történt. A dokumentáció és a helyszíni minőség-ellenőrzés végig követhető volt.",
    heroImage: {
      src: S.kozepulet,
      alt: "Stock fotó: középület — referencia helyőrző",
    },
    cardImage: {
      src: S.munka,
      alt: "Stock fotó: középület kivitelezés — referencia helyőrző",
    },
    gallery: [
      stock("telephelyPng", "Stock fotó: helyszín — referencia helyőrző"),
      stock("ipariNav", "Stock fotó: építési állapot — referencia helyőrző"),
      stock("munka", "Stock fotó: szerkezetlezárás — referencia helyőrző"),
      stock("kozepulet", "Stock fotó: homlokzat — referencia helyőrző"),
      stock("kapcsolatHero", "Stock fotó: belső terek — referencia helyőrző"),
      stock("telephely", "Stock fotó: környezet — referencia helyőrző"),
      stock("felujitas", "Stock fotó: burkolási fázis — referencia helyőrző"),
    ],
    published: true,
  },
  {
    slug: "felujitas-lakas",
    title: "Teljes lakásfelújítás · 95 m², Kecskemét",
    type: "renovation",
    city: "Kecskemét",
    yearCompleted: 2024,
    duration: "3 hónap",
    scope: "Teljes lakásfelújítás",
    areaSqm: 95,
    listTeaser:
      "Teljes lakásfelújítás generálkivitelezéssel: burkolatok, gépészet, villamos, egy kézben.",
    tldr:
      "Lakás teljes körű felújítása: bontás, burkolatok, gépészeti és villamos munkák, festés és átadás. A megrendelő egy kapcsolattartón keresztül követte az ütemezést.",
    challenge:
      "A lakás lakott környezetben, szűk időablakban kellett újuljon meg. A zaj, a szállítás és a szakágak párhuzamos munkája ütközött a háztársi és ütemezési korlátokkal.",
    solution:
      "Napi művezetői koordináció, előre egyeztetett szakági sorrend és zárt bontási időablakok. A kritikus anyagbeszerzéseket az ütemezéshez igazítottuk.",
    outcome:
      "A felújítás a megbeszélt határidőre készült el. Az átadás dokumentált ellenőrzéssel történt.",
    heroImage: {
      src: S.felujitas,
      alt: "Stock fotó: felújítás — referencia helyőrző",
    },
    cardImage: {
      src: S.csaladi,
      alt: "Stock fotó: felújított tér, referencia helyőrző",
    },
    gallery: [
      stock("kapcsolatHero", "Stock fotó: felújított nappali — referencia helyőrző"),
      stock("telephely", "Stock fotó: részlet — referencia helyőrző"),
      stock("felujitas", "Stock fotó: burkolatok — referencia helyőrző"),
      stock("csaladi", "Stock fotó: konyha — referencia helyőrző"),
      stock("munka", "Stock fotó: bontási fázis — referencia helyőrző"),
      stock("kozepulet", "Stock fotó: fürdőszoba — referencia helyőrző"),
      stock("telephelyPng", "Stock fotó: átadás előtt — referencia helyőrző"),
    ],
    published: true,
  },
  {
    slug: "szakagi-gepeszet-kecskemet",
    title: "Gépészeti szakági munka · Kecskemét",
    type: "trades",
    city: "Kecskemét",
    yearCompleted: 2024,
    duration: "6 hét",
    scope: "Önálló gépészeti kivitelezés",
    areaSqm: 420,
    listTeaser:
      "Önálló szakági megbízás — gépészet, egy kapcsolattartó, rögzített ütem.",
    tldr:
      "Önálló gépészeti kivitelezés meglévő épületben: tervezett szakági tartalom, anyagbeszerzés és átadás generálkivitelezés nélkül, egy felelős kapcsolattartóval.",
    challenge:
      "A megrendelőnek nem volt szüksége teljes generálra — csak a hiányzó gépészeti szakágra, szűk időablakban, lakott / működő környezet mellett.",
    solution:
      "Előre rögzített műszaki tartalom, napi művezetői egyeztetés és zárt munkaidő-ablakok. Az anyagokat az ütemhez igazítottuk, hogy ne legyen állásidő.",
    outcome:
      "A szakági munka a megbeszélt határidőre készült el. Az átadás dokumentált ellenőrzéssel történt.",
    heroImage: {
      src: S.munka,
      alt: "Stock fotó: szakági kivitelezés — referencia helyőrző",
    },
    cardImage: {
      src: S.munka,
      alt: "Stock fotó: gépészeti munka — referencia helyőrző",
    },
    gallery: [
      stock("telephely", "Stock fotó: helyszín — referencia helyőrző"),
      stock("ipariNav", "Stock fotó: szerelési fázis — referencia helyőrző"),
      stock("felujitas", "Stock fotó: belső munka — referencia helyőrző"),
      stock("kapcsolatHero", "Stock fotó: részlet — referencia helyőrző"),
      stock("kozepulet", "Stock fotó: átadás előkészítés — referencia helyőrző"),
      stock("telephelyPng", "Stock fotó: környezet — referencia helyőrző"),
      stock("ipariHero", "Stock fotó: épület — referencia helyőrző"),
    ],
    published: true,
  },
  {
    slug: "asztalos-beepitett-butor",
    title: "Egyedi beépített bútor · Kecskemét",
    type: "carpentry",
    city: "Kecskemét",
    yearCompleted: 2024,
    duration: "5 hét",
    scope: "Beépített bútor és konyha",
    listTeaser:
      "Egyedi asztalos munka — beépített bútor és konyha, partner gyártással.",
    tldr:
      "Egyedi beépített bútor és konyhabútor: gyártás partnerüzemben, helyszíni beépítés és átadás egy ütemben, a kivitelezési projekthez igazítva.",
    challenge:
      "A bútorozás gyakran külön céghez kerül — más határidő, más minőség. Itt a beépített elemeknek a belső burkolatokkal kellett találkoznia.",
    solution:
      "Méretezés a szerkezetlezárás után, gyártás a Hírös-Ablak partnerüzemben, helyszíni beépítés a burkolási ütemhez igazítva.",
    outcome:
      "Az átadáskor a beépített bútorok a helyükön voltak. A megrendelő egy kapcsolattartón keresztül követte a gyártást és a beépítést.",
    heroImage: {
      src: S.houseHero,
      alt: "Stock fotó: asztalos / belső tér — referencia helyőrző",
    },
    cardImage: {
      src: S.houseHero,
      alt: "Stock fotó: beépített bútor — referencia helyőrző",
    },
    gallery: [
      stock("csaladi", "Stock fotó: belső tér — referencia helyőrző"),
      stock("felujitas", "Stock fotó: konyha részlet — referencia helyőrző"),
      stock("kapcsolatHero", "Stock fotó: beépítés — referencia helyőrző"),
      stock("telephely", "Stock fotó: gyártás / helyszín — referencia helyőrző"),
      stock("munka", "Stock fotó: szerelés — referencia helyőrző"),
      stock("kozepulet", "Stock fotó: felület — referencia helyőrző"),
      stock("telephelyPng", "Stock fotó: átadás — referencia helyőrző"),
    ],
    published: true,
  },
]

/** Sorrend megegyezik a szolgáltatás menüvel */
const SERVICE_ORDER = REFERENCE_TYPE_ORDER

export function getPublishedReferences(): Reference[] {
  return REFERENCES.filter((r) => r.published).sort(
    (a, b) => SERVICE_ORDER.indexOf(a.type) - SERVICE_ORDER.indexOf(b.type),
  )
}

export function getPublishedReferencesByType(
  type?: ReferenceType | null,
): Reference[] {
  const all = getPublishedReferences()
  if (!type) return all
  return all.filter((r) => r.type === type)
}

export function getReferenceTypeCounts(): Record<ReferenceType, number> {
  const counts = Object.fromEntries(
    REFERENCE_TYPE_ORDER.map((t) => [t, 0]),
  ) as Record<ReferenceType, number>
  for (const r of getPublishedReferences()) {
    counts[r.type] += 1
  }
  return counts
}

export function isReferenceType(value: string): value is ReferenceType {
  return REFERENCE_TYPE_ORDER.includes(value as ReferenceType)
}

export function getReferenceBySlug(slug: string): Reference | undefined {
  return REFERENCES.find((r) => r.slug === slug && r.published)
}

export function getReferenceSlugs(): string[] {
  return getPublishedReferences().map((r) => r.slug)
}

export function getRelatedReferences(
  current: Reference,
  limit = 4,
): Reference[] {
  return getPublishedReferences()
    .filter((r) => r.slug !== current.slug)
    .slice(0, limit)
}

export function referenceDetailPath(slug: string): string {
  return `/referenciak/${slug}`
}

export type ReferenceFactRow = {
  label: string
  value: string
}

/** Egységes tények — minden detail oldalon ugyanaz a sorrend */
export function getReferenceFactRows(reference: Reference): ReferenceFactRow[] {
  return [
    { label: "Típus", value: REFERENCE_TYPE_LABELS[reference.type] },
    { label: "Helyszín", value: reference.city },
    { label: "Átadás éve", value: String(reference.yearCompleted) },
    { label: "Kivitelezés időtartama", value: reference.duration },
    {
      label: "Alapterület",
      value: reference.areaSqm
        ? `${reference.areaSqm.toLocaleString("hu-HU")} m²`
        : "—",
    },
    { label: "Feladat", value: reference.scope },
  ]
}

/** Detail galéria — hero + galéria (8 kép összesen: 1 hero + 7 galéria) */
export function getReferenceDetailImages(reference: Reference): ReferenceImage[] {
  return [reference.heroImage, ...reference.gallery]
}
