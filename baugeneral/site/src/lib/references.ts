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
 * Referenciák — valós projektfotók (public/img/references + projects).
 * Stock placeholder-ek published: false; szöveg/kategória finomítás folyamatban.
 */
export const REFERENCES: Reference[] = [
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
    published: false,
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
    published: false,
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
    published: false,
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
      "Középületi generálkivitelezés, dokumentált átadás, közbeszerzési elvárásoknak megfelelően.",
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
      alt: "Stock fotó: középület, referencia helyőrző",
    },
    cardImage: {
      src: S.munka,
      alt: "Stock fotó: középület kivitelezés, referencia helyőrző",
    },
    gallery: [
      stock("telephelyPng", "Stock fotó: helyszín, referencia helyőrző"),
      stock("ipariNav", "Stock fotó: építési állapot, referencia helyőrző"),
      stock("munka", "Stock fotó: szerkezetlezárás, referencia helyőrző"),
      stock("kozepulet", "Stock fotó: homlokzat, referencia helyőrző"),
      stock("kapcsolatHero", "Stock fotó: belső terek, referencia helyőrző"),
      stock("telephely", "Stock fotó: környezet, referencia helyőrző"),
      stock("felujitas", "Stock fotó: burkolási fázis, referencia helyőrző"),
    ],
    published: false,
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
      alt: "Stock fotó: felújítás, referencia helyőrző",
    },
    cardImage: {
      src: S.csaladi,
      alt: "Stock fotó: felújított tér, referencia helyőrző",
    },
    gallery: [
      stock("kapcsolatHero", "Stock fotó: felújított nappali, referencia helyőrző"),
      stock("telephely", "Stock fotó: részlet, referencia helyőrző"),
      stock("felujitas", "Stock fotó: burkolatok, referencia helyőrző"),
      stock("csaladi", "Stock fotó: konyha, referencia helyőrző"),
      stock("munka", "Stock fotó: bontási fázis, referencia helyőrző"),
      stock("kozepulet", "Stock fotó: fürdőszoba, referencia helyőrző"),
      stock("telephelyPng", "Stock fotó: átadás előtt, referencia helyőrző"),
    ],
    published: false,
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
      "Önálló szakági megbízás: gépészet, egy kapcsolattartó, rögzített ütem.",
    tldr:
      "Önálló gépészeti kivitelezés meglévő épületben: tervezett szakági tartalom, anyagbeszerzés és átadás generálkivitelezés nélkül, egy felelős kapcsolattartóval.",
    challenge:
      "A megrendelőnek nem volt szüksége teljes generálra, csak a hiányzó gépészeti szakágra, szűk időablakban, lakott / működő környezet mellett.",
    solution:
      "Előre rögzített műszaki tartalom, napi művezetői egyeztetés és zárt munkaidő-ablakok. Az anyagokat az ütemhez igazítottuk, hogy ne legyen állásidő.",
    outcome:
      "A szakági munka a megbeszélt határidőre készült el. Az átadás dokumentált ellenőrzéssel történt.",
    heroImage: {
      src: S.munka,
      alt: "Stock fotó: szakági kivitelezés, referencia helyőrző",
    },
    cardImage: {
      src: S.munka,
      alt: "Stock fotó: gépészeti munka, referencia helyőrző",
    },
    gallery: [
      stock("telephely", "Stock fotó: helyszín, referencia helyőrző"),
      stock("ipariNav", "Stock fotó: szerelési fázis, referencia helyőrző"),
      stock("felujitas", "Stock fotó: belső munka, referencia helyőrző"),
      stock("kapcsolatHero", "Stock fotó: részlet, referencia helyőrző"),
      stock("kozepulet", "Stock fotó: átadás előkészítés, referencia helyőrző"),
      stock("telephelyPng", "Stock fotó: környezet, referencia helyőrző"),
      stock("ipariHero", "Stock fotó: épület, referencia helyőrző"),
    ],
    published: false,
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
      "Egyedi asztalos munka, beépített bútor és konyha, partner gyártással.",
    tldr:
      "Egyedi beépített bútor és konyhabútor: gyártás partnerüzemben, helyszíni beépítés és átadás egy ütemben, a kivitelezési projekthez igazítva.",
    challenge:
      "A bútorozás gyakran külön céghez kerül, más határidő, más minőség. Itt a beépített elemeknek a belső burkolatokkal kellett találkoznia.",
    solution:
      "Méretezés a szerkezetlezárás után, gyártás a Hírös-Ablak partnerüzemben, helyszíni beépítés a burkolási ütemhez igazítva.",
    outcome:
      "Az átadáskor a beépített bútorok a helyükön voltak. A megrendelő egy kapcsolattartón keresztül követte a gyártást és a beépítést.",
    heroImage: {
      src: S.houseHero,
      alt: "Stock fotó: asztalos / belső tér, referencia helyőrző",
    },
    cardImage: {
      src: S.houseHero,
      alt: "Stock fotó: beépített bútor, referencia helyőrző",
    },
    gallery: [
      stock("csaladi", "Stock fotó: belső tér, referencia helyőrző"),
      stock("felujitas", "Stock fotó: konyha részlet, referencia helyőrző"),
      stock("kapcsolatHero", "Stock fotó: beépítés, referencia helyőrző"),
      stock("telephely", "Stock fotó: gyártás / helyszín, referencia helyőrző"),
      stock("munka", "Stock fotó: szerelés, referencia helyőrző"),
      stock("kozepulet", "Stock fotó: felület, referencia helyőrző"),
      stock("telephelyPng", "Stock fotó: átadás, referencia helyőrző"),
    ],
    published: false,
  },
  {
    slug: "minimal-csaladihaz-butorozassal",
    title: "Minimál családiház, bútorozással",
    type: "family",
    city: "—",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/minimal-csaladihaz-butorozassal/01.jpg",
      alt: "Minimál családiház, bútorozással",
    },
    cardImage: {
      src: "/img/references/minimal-csaladihaz-butorozassal/01.jpg",
      alt: "Minimál családiház, bútorozással",
    },
    gallery: [
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/02.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/03.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/04.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/05.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/06.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/07.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/08.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/09.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/10.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/11.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/12.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/13.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/14.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/15.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/16.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/17.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/18.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/19.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/20.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/21.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/22.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/23.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/24.jpg",
        alt: "Minimál családiház, bútorozással",
      },
      {
        src: "/img/references/minimal-csaladihaz-butorozassal/25.jpg",
        alt: "Minimál családiház, bútorozással",
      }
    ],
    published: true,
  },
  {
    slug: "ikerhaz-butorozassal-a",
    title: "Ikerház generál kivitelezés bútorozással (A)",
    type: "family",
    city: "—",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/ikerhaz-butorozassal-a/01.jpg",
      alt: "Ikerház generál kivitelezés bútorozással (A)",
    },
    cardImage: {
      src: "/img/references/ikerhaz-butorozassal-a/01.jpg",
      alt: "Ikerház generál kivitelezés bútorozással (A)",
    },
    gallery: [
      {
        src: "/img/references/ikerhaz-butorozassal-a/02.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/03.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/04.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/05.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/06.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/07.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/08.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/09.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/10.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/11.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/12.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/13.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/14.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/15.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/16.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/17.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/18.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/19.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/20.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/21.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/22.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/23.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/24.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/25.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/26.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/27.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/28.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-a/29.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (A)",
      }
    ],
    published: true,
  },
  {
    slug: "ikerhaz-butorozassal-b",
    title: "Ikerház generál kivitelezés bútorozással (B)",
    type: "family",
    city: "—",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/ikerhaz-butorozassal-b/01.jpg",
      alt: "Ikerház generál kivitelezés bútorozással (B)",
    },
    cardImage: {
      src: "/img/references/ikerhaz-butorozassal-b/01.jpg",
      alt: "Ikerház generál kivitelezés bútorozással (B)",
    },
    gallery: [
      {
        src: "/img/references/ikerhaz-butorozassal-b/02.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/03.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/04.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/05.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/06.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/07.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/08.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/09.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/10.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/11.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/12.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/13.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/14.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/15.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/16.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/17.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/18.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/19.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/20.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/21.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/22.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/23.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
      {
        src: "/img/references/ikerhaz-butorozassal-b/24.jpg",
        alt: "Ikerház generál kivitelezés bútorozással (B)",
      },
    ],
    published: true,
  },
  {
    slug: "okoturisztikai-kozpont",
    title: "Ökoturisztikai Központ",
    type: "public",
    city: "Lakitelek",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/okoturisztikai-kozpont/01.jpg",
      alt: "Ökoturisztikai Központ",
    },
    cardImage: {
      src: "/img/references/okoturisztikai-kozpont/01.jpg",
      alt: "Ökoturisztikai Központ",
    },
    gallery: [
      {
        src: "/img/references/okoturisztikai-kozpont/02.jpg",
        alt: "Ökoturisztikai Központ",
      },
      {
        src: "/img/references/okoturisztikai-kozpont/03.jpg",
        alt: "Ökoturisztikai Központ",
      },
      {
        src: "/img/references/okoturisztikai-kozpont/04.jpg",
        alt: "Ökoturisztikai Központ",
      }
    ],
    published: true,
  },
  {
    slug: "janoshalma-jarasi-hivatal",
    title: "Jánoshalma Járási Hivatal",
    type: "public",
    city: "Jánoshalma",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/janoshalma-jarasi-hivatal/01.jpg",
      alt: "Jánoshalma Járási Hivatal",
    },
    cardImage: {
      src: "/img/references/janoshalma-jarasi-hivatal/01.jpg",
      alt: "Jánoshalma Járási Hivatal",
    },
    gallery: [
      {
        src: "/img/references/janoshalma-jarasi-hivatal/02.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
      {
        src: "/img/references/janoshalma-jarasi-hivatal/03.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
      {
        src: "/img/references/janoshalma-jarasi-hivatal/04.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
      {
        src: "/img/references/janoshalma-jarasi-hivatal/05.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
      {
        src: "/img/references/janoshalma-jarasi-hivatal/06.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
      {
        src: "/img/references/janoshalma-jarasi-hivatal/07.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
      {
        src: "/img/references/janoshalma-jarasi-hivatal/08.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
      {
        src: "/img/references/janoshalma-jarasi-hivatal/09.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
      {
        src: "/img/references/janoshalma-jarasi-hivatal/10.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
      {
        src: "/img/references/janoshalma-jarasi-hivatal/11.jpg",
        alt: "Jánoshalma Járási Hivatal",
      },
    ],
    published: true,
  },
  {
    slug: "kefag-kulcsoshaz",
    title: "KEFAG Kulcsosház",
    type: "public",
    city: "Solt",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/kefag-kulcsoshaz/01.jpg",
      alt: "KEFAG Kulcsosház",
    },
    cardImage: {
      src: "/img/references/kefag-kulcsoshaz/01.jpg",
      alt: "KEFAG Kulcsosház",
    },
    gallery: [
      {
        src: "/img/references/kefag-kulcsoshaz/02.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/03.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/04.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/05.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/06.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/07.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/08.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/09.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/10.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/11.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/12.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/13.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/14.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/15.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/16.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/17.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/18.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/19.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/20.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/21.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/22.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/23.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/24.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/25.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/26.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/27.jpg",
        alt: "KEFAG Kulcsosház",
      },
      {
        src: "/img/references/kefag-kulcsoshaz/28.jpg",
        alt: "KEFAG Kulcsosház",
      },
    ],
    published: true,
  },
  {
    slug: "fokusz-centrum",
    title: "Fókusz Centrum felújítás és bútorozás",
    type: "renovation",
    city: "Kecskemét",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/fokusz-centrum/01.jpg",
      alt: "Fókusz Centrum felújítás és bútorozás",
    },
    cardImage: {
      src: "/img/references/fokusz-centrum/01.jpg",
      alt: "Fókusz Centrum felújítás és bútorozás",
    },
    gallery: [
      {
        src: "/img/references/fokusz-centrum/02.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/03.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/04.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/05.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/06.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/07.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/08.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/09.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/10.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/11.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
      {
        src: "/img/references/fokusz-centrum/12.jpg",
        alt: "Fókusz Centrum felújítás és bútorozás",
      },
    ],
    published: true,
  },
  {
    slug: "csillagszem-ovoda",
    title: "Csillagszem óvoda",
    type: "public",
    city: "—",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/csillagszem-ovoda/01.jpg",
      alt: "Csillagszem óvoda",
    },
    cardImage: {
      src: "/img/references/csillagszem-ovoda/01.jpg",
      alt: "Csillagszem óvoda",
    },
    gallery: [
      {
        src: "/img/references/csillagszem-ovoda/02.jpg",
        alt: "Csillagszem óvoda",
      },
      {
        src: "/img/references/csillagszem-ovoda/03.jpg",
        alt: "Csillagszem óvoda",
      },
      {
        src: "/img/references/csillagszem-ovoda/04.jpg",
        alt: "Csillagszem óvoda",
      },
      {
        src: "/img/references/csillagszem-ovoda/05.jpg",
        alt: "Csillagszem óvoda",
      },
      {
        src: "/img/references/csillagszem-ovoda/06.jpg",
        alt: "Csillagszem óvoda",
      },
      {
        src: "/img/references/csillagszem-ovoda/07.jpg",
        alt: "Csillagszem óvoda",
      },
      {
        src: "/img/references/csillagszem-ovoda/08.jpg",
        alt: "Csillagszem óvoda",
      },
    ],
    published: true,
  },
  {
    slug: "ipari-csarnok",
    title: "Ipari csarnok, 500 m² · térkövezés 800 m²",
    type: "industrial",
    city: "Bács-Kiskun megye",
    yearCompleted: 2020,
    duration: "4 hónap",
    scope: "Acélszerkezet, szendvicspanel, térkövezés",
    areaSqm: 500,
    listTeaser:
      "500 m² ipari csarnok acélszerkezettel és szendvicspanellel, 800 m² térkövezéssel. Generálkivitelezés Bács-Kiskunban, 4 hónap alatt.",
    tldr:
      "Bács-Kiskun megyében, 2020-ban adtunk át egy kb. 500 négyzetméteres ipari csarnokot. Acélszerkezet, szendvicspanel burkolat, majd a telek járhatóvá tétele: kb. 800 négyzetméter térkövezés. A munkát generálkivitelezésben vittük, egy felelős csapattal, négy hónap alatt. A szerkezet, a homlokzat és a térkő egy ütemben zárult, hogy az épület és az udvar együtt legyen használható.",
    challenge:
      "Ipari csarnoknál a szerkezet, a szendvicspanel és a térkövezés könnyen szétcsúszik, ha külön kezekben fut. Négy hónapos ütem mellett nincs helye a várakozásnak a szakágak között.",
    solution:
      "Egy építésvezetés tartotta a sorrendet: acélszerkezet, szendvicspanel burkolat, nyílászárók, majd a térkövezés. A külső burkolatot úgy ütemeztük, hogy a nehézgép és a kész térkő ne ütközzön. A megrendelő egy kapcsolattartón keresztül követte a státuszt.",
    outcome:
      "2020-ban átadtuk a kb. 500 m² csarnokot és a kb. 800 m² térkövezett felületet. Használható ipari épület, járható udvarral, Bács-Kiskun megyében.",
    heroImage: {
      src: "/img/references/ipari-csarnok/01.jpg",
      alt: "500 m² ipari csarnok, acélszerkezet és szendvicspanel, Bács-Kiskun",
    },
    cardImage: {
      src: "/img/references/ipari-csarnok/01.jpg",
      alt: "500 m² ipari csarnok generálkivitelezés, Bács-Kiskun megye",
    },
    gallery: [
      {
        src: "/img/references/ipari-csarnok/02.jpg",
        alt: "Ipari csarnok kivitelezés, szendvicspanel burkolat",
      },
      {
        src: "/img/references/ipari-csarnok/03.jpg",
        alt: "Acélszerkezetű ipari csarnok építés közben",
      },
      {
        src: "/img/references/ipari-csarnok/04.jpg",
        alt: "Ipari csarnok homlokzat és nyílászárók",
      },
      {
        src: "/img/references/ipari-csarnok/05.jpg",
        alt: "Csarnoképítés Bács-Kiskun megyében",
      },
      {
        src: "/img/references/ipari-csarnok/06.jpg",
        alt: "Ipari épület szerkezetlezárás",
      },
      {
        src: "/img/references/ipari-csarnok/07.jpg",
        alt: "Szendvicspanel csarnok részlet",
      },
      {
        src: "/img/references/ipari-csarnok/08.jpg",
        alt: "Ipari csarnok belső / építési állapot",
      },
      {
        src: "/img/references/ipari-csarnok/09.jpg",
        alt: "Térkövezés előkészítés ipari csarnok telekén",
      },
      {
        src: "/img/references/ipari-csarnok/10.jpg",
        alt: "Térkövezett udvar ipari csarnok előtt, kb. 800 m²",
      },
      {
        src: "/img/references/ipari-csarnok/11.jpg",
        alt: "Ipari csarnok és térkő burkolat, átadás előtt",
      },
      {
        src: "/img/references/ipari-csarnok/12.jpg",
        alt: "Generálkivitelezés: csarnok és külső burkolat",
      },
      {
        src: "/img/references/ipari-csarnok/13.jpg",
        alt: "Ipari csarnok referencia, Bács-Kiskun",
      },
    ],
    published: true,
  },
  {
    slug: "irattarolo-csarnok",
    title: "Irattároló csarnok",
    type: "industrial",
    city: "—",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/irattarolo-csarnok/01.jpg",
      alt: "Irattároló csarnok",
    },
    cardImage: {
      src: "/img/references/irattarolo-csarnok/01.jpg",
      alt: "Irattároló csarnok",
    },
    gallery: [
      {
        src: "/img/references/irattarolo-csarnok/02.jpg",
        alt: "Irattároló csarnok",
      },
      {
        src: "/img/references/irattarolo-csarnok/03.jpg",
        alt: "Irattároló csarnok",
      },
      {
        src: "/img/references/irattarolo-csarnok/04.jpg",
        alt: "Irattároló csarnok",
      },
      {
        src: "/img/references/irattarolo-csarnok/05.jpg",
        alt: "Irattároló csarnok",
      },
      {
        src: "/img/references/irattarolo-csarnok/06.jpg",
        alt: "Irattároló csarnok",
      },
      {
        src: "/img/references/irattarolo-csarnok/07.jpg",
        alt: "Irattároló csarnok",
      }
    ],
    published: true,
  },
  {
    slug: "cupra-szalon",
    title: "Cupra szalon",
    type: "industrial",
    city: "Kecskemét",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    featured: true,
    heroImage: {
      src: "/img/nav/ipari-epuletek.jpg",
      alt: "Cupra szalon",
    },
    cardImage: {
      src: "/img/nav/ipari-epuletek.jpg",
      alt: "Cupra szalon",
    },
    gallery: [
      {
        src: "/img/references/cupra-szalon/01.jpg",
        alt: "Cupra szalon, sötét fémburkolatú ipari épület",
      },
      {
        src: "/img/references/cupra-szalon/02.jpg",
        alt: "Cupra szalon belső tér, üres showroom",
      },
      {
        src: "/img/references/cupra-szalon/03.jpg",
        alt: "Cupra szalon belső tér, fa burkolatú bemutatózóna",
      },
      {
        src: "/img/references/cupra-szalon/04.jpg",
        alt: "Cupra szalon belső tér, üveghomlokzat",
      },
      {
        src: "/img/references/cupra-szalon/05.jpg",
        alt: "Cupra szalon belső, szervizkapu és töltőpont",
      },
      {
        src: "/img/references/cupra-szalon/06.jpg",
        alt: "Cupra szalon lounge és pultzóna",
      },
      {
        src: "/img/references/cupra-szalon/07.jpg",
        alt: "Cupra szalon lounge, ipari mennyezet",
      },
      {
        src: "/img/references/cupra-szalon/08.jpg",
        alt: "Cupra szalon tárgyalóasztal",
      },
      {
        src: "/img/references/cupra-szalon/09.jpg",
        alt: "Cupra szalon showroom, átadás utáni állapot",
      },
    ],
    published: true,
  },
  {
    slug: "mentoallomas",
    title: "Mentőállomás",
    type: "public",
    city: "—",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/mentoallomas/01.jpg",
      alt: "Mentőállomás",
    },
    cardImage: {
      src: "/img/references/mentoallomas/01.jpg",
      alt: "Mentőállomás",
    },
    gallery: [
      {
        src: "/img/references/mentoallomas/02.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/03.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/04.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/05.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/06.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/07.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/08.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/09.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/10.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/11.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/12.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/13.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/14.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/15.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/16.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/17.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/18.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/19.jpg",
        alt: "Mentőállomás",
      },
      {
        src: "/img/references/mentoallomas/20.jpg",
        alt: "Mentőállomás",
      },
    ],
    published: true,
  },
  {
    slug: "vackor-var-kilato",
    title: "Vackor Vár kilátó",
    type: "public",
    city: "—",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/vackor-var-kilato/01.jpg",
      alt: "Vackor Vár kilátó",
    },
    cardImage: {
      src: "/img/references/vackor-var-kilato/01.jpg",
      alt: "Vackor Vár kilátó",
    },
    gallery: [
      {
        src: "/img/references/vackor-var-kilato/02.jpg",
        alt: "Vackor Vár kilátó",
      },
      {
        src: "/img/references/vackor-var-kilato/03.jpg",
        alt: "Vackor Vár kilátó",
      },
      {
        src: "/img/references/vackor-var-kilato/04.jpg",
        alt: "Vackor Vár kilátó",
      },
      {
        src: "/img/references/vackor-var-kilato/05.jpg",
        alt: "Vackor Vár kilátó",
      },
      {
        src: "/img/references/vackor-var-kilato/06.jpg",
        alt: "Vackor Vár kilátó",
      },
      {
        src: "/img/references/vackor-var-kilato/07.jpg",
        alt: "Vackor Vár kilátó",
      },
      {
        src: "/img/references/vackor-var-kilato/08.jpg",
        alt: "Vackor Vár kilátó",
      },
      {
        src: "/img/references/vackor-var-kilato/09.jpg",
        alt: "Vackor Vár kilátó",
      },
    ],
    published: true,
  },
  {
    slug: "autogyarto-sor-podec",
    title: "Autógyártó sor podec",
    type: "industrial",
    city: "—",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/autogyarto-sor-podec/01.jpg",
      alt: "Autógyártó sor podec",
    },
    cardImage: {
      src: "/img/references/autogyarto-sor-podec/01.jpg",
      alt: "Autógyártó sor podec",
    },
    gallery: [
      {
        src: "/img/references/autogyarto-sor-podec/02.jpg",
        alt: "Autógyártó sor podec",
      },
      {
        src: "/img/references/autogyarto-sor-podec/03.jpg",
        alt: "Autógyártó sor podec",
      }
    ],
    published: true,
  },
  {
    slug: "komplett-jurta",
    title: "Komplett jurta",
    type: "public",
    city: "—",
    yearCompleted: 0,
    duration: "—",
    scope: "—",
    listTeaser: "Szöveg hamarosan.",
    tldr: "Szöveg hamarosan.",
    challenge: "Szöveg hamarosan.",
    solution: "Szöveg hamarosan.",
    outcome: "Szöveg hamarosan.",
    heroImage: {
      src: "/img/references/komplett-jurta/01.jpg",
      alt: "Komplett jurta",
    },
    cardImage: {
      src: "/img/references/komplett-jurta/01.jpg",
      alt: "Komplett jurta",
    },
    gallery: [
      {
        src: "/img/references/komplett-jurta/02.jpg",
        alt: "Komplett jurta",
      },
      {
        src: "/img/references/komplett-jurta/03.jpg",
        alt: "Komplett jurta",
      },
      {
        src: "/img/references/komplett-jurta/04.jpg",
        alt: "Komplett jurta",
      },
      {
        src: "/img/references/komplett-jurta/05.jpg",
        alt: "Komplett jurta",
      },
      {
        src: "/img/references/komplett-jurta/06.jpg",
        alt: "Komplett jurta",
      },
      {
        src: "/img/references/komplett-jurta/07.jpg",
        alt: "Komplett jurta",
      },
      {
        src: "/img/references/komplett-jurta/08.jpg",
        alt: "Komplett jurta",
      },
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

const PLACEHOLDER_COPY = "Szöveg hamarosan."

export function isReferencePlaceholderText(value: string | undefined): boolean {
  if (!value) return true
  const trimmed = value.trim()
  return trimmed.length === 0 || trimmed === PLACEHOLDER_COPY || trimmed === "—"
}

/** Meta / JSON-LD description — soha ne legyen placeholder */
export function getReferenceSeoDescription(reference: Reference): string {
  if (!isReferencePlaceholderText(reference.listTeaser)) return reference.listTeaser
  if (!isReferencePlaceholderText(reference.tldr)) return reference.tldr
  return `${reference.title}. BauGenerál referencia, generálkivitelezés.`
}

export function hasReferenceLead(reference: Reference): boolean {
  return !isReferencePlaceholderText(reference.tldr)
}

export function hasReferenceNarrative(reference: Reference): boolean {
  return (
    !isReferencePlaceholderText(reference.challenge) &&
    !isReferencePlaceholderText(reference.solution) &&
    !isReferencePlaceholderText(reference.outcome)
  )
}

/** Egységes tények — üres / placeholder értékek kiszűrve (1. kör: cím + kép) */
export function getReferenceFactRows(reference: Reference): ReferenceFactRow[] {
  const rows: ReferenceFactRow[] = [
    { label: "Típus", value: REFERENCE_TYPE_LABELS[reference.type] },
  ]
  if (!isReferencePlaceholderText(reference.city)) {
    rows.push({ label: "Helyszín", value: reference.city })
  }
  if (reference.yearCompleted > 0) {
    rows.push({ label: "Átadás éve", value: String(reference.yearCompleted) })
  }
  if (!isReferencePlaceholderText(reference.duration)) {
    rows.push({ label: "Kivitelezés időtartama", value: reference.duration })
  }
  if (reference.areaSqm) {
    rows.push({
      label: "Alapterület",
      value: `${reference.areaSqm.toLocaleString("hu-HU")} m²`,
    })
  }
  if (!isReferencePlaceholderText(reference.scope)) {
    rows.push({ label: "Feladat", value: reference.scope })
  }
  return rows
}

/** Detail galéria — hero + galéria */
export function getReferenceDetailImages(reference: Reference): ReferenceImage[] {
  return [reference.heroImage, ...reference.gallery]
}
