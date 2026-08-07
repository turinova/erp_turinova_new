import { getProjectTimelineState } from "@/lib/project-timeline"
import { REFERENCE_STOCK as S, stock } from "@/lib/reference-stock-images"

export type ProjectOwnership = "own-investment" | "commission"

export type ProjectCategory =
  | "industrial"
  | "condo"
  | "family"
  | "public"
  | "renovation"

export type ProjectPhase =
  | "planning"
  | "demolition"
  | "foundation"
  | "structure"
  | "mep"
  | "finishing"

export type ProjectImage = {
  src: string
  alt: string
}

export type ActiveProject = {
  slug: string
  title: string
  ownership: ProjectOwnership
  category: ProjectCategory
  city: string
  /** pl. „2025-03” — kezdő dátum */
  startedAt: string
  /** pl. „2026-09” — várható átadás */
  expectedCompletion: string
  areaSqm?: number
  scope: string
  tldr: string
  currentStatus: string
  /** Felülírja a dátum alapú fázist (pl. bontás) */
  currentPhase?: ProjectPhase
  heroImage: ProjectImage
  cardImage: ProjectImage
  gallery: ProjectImage[]
  published: boolean
}

export const PROJECT_OWNERSHIP_LABELS: Record<ProjectOwnership, string> = {
  "own-investment": "Saját beruházás",
  commission: "Megrendelésre",
}

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  industrial: "Ipari",
  condo: "Társasház",
  family: "Családi ház",
  public: "Középület",
  renovation: "Felújítás",
}

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  planning: "Tervezés",
  demolition: "Bontás",
  foundation: "Alapozás",
  structure: "Szerkezetépítés",
  mep: "Gépészet és villamos",
  finishing: "Befejezés és átadás",
}

export const PROJECT_PHASE_ORDER: ProjectPhase[] = [
  "planning",
  "demolition",
  "foundation",
  "structure",
  "mep",
  "finishing",
]

/**
 * MVP futó projektek — stock fotók (public/img).
 * Fázis és frissítés dátum automatikus: kezdő + végdátum alapján, mai naphoz.
 * TODO: cserélje friss helyszíni fotókra; ügyfél engedély ellenőrzése.
 */
export const ACTIVE_PROJECTS: ActiveProject[] = [
  {
    slug: "zwack-rendezvenyhaz-kecskemet",
    title: "Zwack Rendezvényház, Kecskemét",
    ownership: "commission",
    category: "renovation",
    city: "Kecskemét",
    startedAt: "2026-07",
    expectedCompletion: "2027-01",
    scope: "Látogatói központ / rendezvényház kulcsrakész átalakítása",
    tldr:
      "Kecskeméten, a Zwack telephelyen a meglévő látogatói és rendezvény funkciójú épületet alakítjuk át. A megbízás generálkivitelezés: villamos hálózat felújítása, épületgépészet, a bontástól a kulcsrakész átadásig. Az épület történelmi karakterű, 1922-es. Belül sűrű, régi gépészeti és villamos állomány volt. A munkát 2026 júliusában indítottuk. A tervezett átadás 2027 eleje.",
    currentStatus:
      "Most a bontási fázisban vagyunk. A régi burkolatok, vezetékek és a felesleges belső állomány kiszedése zajlik. Ez adja meg a tiszta alapot az új villamos hálózatnak és az épületgépészetnek.",
    currentPhase: "demolition",
    heroImage: {
      src: "/img/projects/zwack-rendezvenyhaz-kecskemet/hero.jpg",
      alt: "Zwack Rendezvényház belső, bontás előtti gépészeti állapot",
    },
    cardImage: {
      src: "/img/projects/zwack-rendezvenyhaz-kecskemet/hero.jpg",
      alt: "Zwack Rendezvényház Kecskemét, bontás",
    },
    gallery: [
      {
        src: "/img/projects/zwack-rendezvenyhaz-kecskemet/exterior.jpg",
        alt: "Zwack Rendezvényház külső, Kecskemét",
      },
      {
        src: "/img/projects/zwack-rendezvenyhaz-kecskemet/interior-museum.jpg",
        alt: "Látogatói terek a felújítás előtt",
      },
    ],
    published: true,
  },
  {
    slug: "hyundai-szalon-kecskemet",
    title: "Hyundai szalon, Kecskemét belváros",
    ownership: "commission",
    category: "industrial",
    city: "Kecskemét",
    startedAt: "2025-03",
    expectedCompletion: "2026-08",
    scope: "Meglévő üzlethelyiség átalakítása márkaszalonná",
    tldr:
      "Kecskemét belvárosában egy meglévő üzlethelyiséget bontottunk vissza, és Hyundai szalonná alakítjuk. A munka a teljes belső kiürítéssel indult: nyílászárók, burkolatok, álmennyezetek eltávolítása. Erre épült az új gépészet, az új elektromos hálózat, az új burkolatok és a vizes helyiségek. A franchise által biztosított bútorokat a Hírös-Ablak közreműködésével építettük be. A homlokzati nyílászárók újak. 2025 márciusában kezdtük. Most, 2026 augusztusában adjuk át. A minőség itt nem opció: márkaszalonban a részlet ugyanolyan súllyal esik latba, mint a műszaki tartalom.",
    currentStatus:
      "A szalon még nincs átadva. A befejező munkák zajlanak. A homlokzat és a fő belső rendszer áll. Most a záró részletek, a beállítások és az átadási ellenőrzés van soron.",
    heroImage: {
      src: "/img/projects/hyundai-szalon-kecskemet/hero.jpg",
      alt: "Hyundai Centrum Kecskemét szalonhomlokzat, belváros",
    },
    cardImage: {
      src: "/img/projects/hyundai-szalon-kecskemet/hero.jpg",
      alt: "Hyundai szalon Kecskemét belváros",
    },
    gallery: [
      {
        src: "/img/projects/hyundai-szalon-kecskemet/hero.jpg",
        alt: "Hyundai Centrum Kecskemét, új homlokzati nyílászárók",
      },
    ],
    published: true,
  },
  {
    slug: "ipari-sajat-kecskemet",
    title: "Kereskedelmi létesítmény, Kecskemét",
    ownership: "own-investment",
    category: "industrial",
    city: "Kecskemét",
    startedAt: "2025-03",
    expectedCompletion: "2026-09",
    areaSqm: 1850,
    scope: "Teljes körű generálkivitelezés",
    tldr:
      "Saját beruházású kereskedelmi épület: szerkezetépítés fázisban, egy koordinált generálkivitelezői csapattal.",
    currentStatus:
      "A födémek és a fő szerkezeti elemek készülnek; a szakági csatlakozások ütemezése heti egyeztetésen zajlik.",
    heroImage: {
      src: S.ipariHero,
      alt: "Stock fotó: ipari épület kivitelezés, futó projekt helyőrző",
    },
    cardImage: {
      src: S.ipariNav,
      alt: "Stock fotó: kereskedelmi épület, futó projekt helyőrző",
    },
    gallery: [
      stock("munka", "Stock fotó: szerkezetépítés, futó projekt helyőrző"),
      stock("telephely", "Stock fotó: helyszín, futó projekt helyőrző"),
      stock("kozepulet", "Stock fotó: építési állapot, futó projekt helyőrző"),
      stock("kapcsolatHero", "Stock fotó: kivitelezés, futó projekt helyőrző"),
      stock("telephelyPng", "Stock fotó: projekt terület, futó projekt helyőrző"),
      stock("felujitas", "Stock fotó: belső előkészítés, futó projekt helyőrző"),
    ],
    published: true,
  },
  {
    slug: "tarshaz-megrendeles-bkk",
    title: "Lakópark, Bács-Kiskun megye",
    ownership: "commission",
    category: "condo",
    city: "Bács-Kiskun megye",
    startedAt: "2025-11",
    expectedCompletion: "2027-06",
    areaSqm: 4200,
    scope: "Lakópark, szerkezettől átadásig",
    tldr:
      "Megrendelésre épülő többlakásos lakópark: alapozási fázis, dokumentált heti státuszjelentéssel a megrendelő felé.",
    currentStatus:
      "Az alapozási munkák és a közmű-előkészítések párhuzamosan zajlanak; a szakági átadások írásban rögzítve.",
    heroImage: {
      src: S.munka,
      alt: "Stock fotó: társasház építés, futó projekt helyőrző",
    },
    cardImage: {
      src: S.telephely,
      alt: "Stock fotó: lakóépület, futó projekt helyőrző",
    },
    gallery: [
      stock("kozepulet", "Stock fotó: lakópark, futó projekt helyőrző"),
      stock("ipariHero", "Stock fotó: alapozás, futó projekt helyőrző"),
      stock("kapcsolatHero", "Stock fotó: helyszín, futó projekt helyőrző"),
      stock("csaladi", "Stock fotó: építési állapot, futó projekt helyőrző"),
      stock("telephelyPng", "Stock fotó: terület, futó projekt helyőrző"),
    ],
    published: true,
  },
  {
    slug: "ikerhaz-sajat-kecskemet",
    title: "Ikerház Kecskeméten",
    ownership: "own-investment",
    category: "family",
    city: "Kecskemét",
    startedAt: "2024-11",
    expectedCompletion: "2026-09",
    areaSqm: 379,
    scope: "Kétlakásos lakóház, saját beruházás",
    tldr:
      "Ezt az ikerházat Kecskeméten saját beruházásként vittük végig. Két önálló lakás, külön garázsokkal és teraszokkal, hagyományos téglaszerkezettel, földszint plusz részben emeletes kialakítással. A hasznos alapterület közel 379 négyzetméter. A generálkivitelezést egy ütemben vittük végig: szerkezetépítés, nyílászárók, homlokzat, belső burkolatok, gépészet, villamos, majd a külső lezárás: kerítés, kapuk, térkő. A fűtés hőszivattyús rendszerre épült, a napelemhez az előkészítés kész. A beépített bútorokat a Hírös-Ablak kecskeméti üzeme gyártotta, a ház üteméhez igazítva. Az épületet 2026-ban átadtuk. A lakások beköltözhetők. Ami még nyitva van a teleken, az a kertépítés.",
    currentStatus:
      "Az átadás lezárult. A ház áll, a kerítés és a térburkolat kész. Jelenleg a kert kialakítása van folyamatban. Ez az utolsó külső munka, ami a kész épületet a telekhez igazítja.",
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
    slug: "ovoda-megrendeles-kecskemet",
    title: "Óvoda, Kecskemét",
    ownership: "commission",
    category: "public",
    city: "Kecskemét",
    startedAt: "2024-09",
    expectedCompletion: "2026-01",
    areaSqm: 980,
    scope: "Óvoda, közbeszerzési kivitelezés",
    tldr:
      "Megrendelésre készülő óvoda — befejezési és átadási fázis, közbeszerzési dokumentáció szerint.",
    currentStatus:
      "A belső burkolatok és a közös terek készülnek; az átadási ellenőrzések ütemezése folyamatban.",
    heroImage: {
      src: S.kozepulet,
      alt: "Stock fotó: középület — futó projekt helyőrző",
    },
    cardImage: {
      src: S.munka,
      alt: "Stock fotó: óvoda kivitelezés — futó projekt helyőrző",
    },
    gallery: [
      stock("telephelyPng", "Stock fotó: helyszín — futó projekt helyőrző"),
      stock("ipariNav", "Stock fotó: homlokzat — futó projekt helyőrző"),
      stock("kapcsolatHero", "Stock fotó: belső terek — futó projekt helyőrző"),
      stock("felujitas", "Stock fotó: burkolatok — futó projekt helyőrző"),
    ],
    published: true,
  },
  {
    slug: "felujitas-megrendeles-kecskemet",
    title: "Lakásfelújítás, Kecskemét",
    ownership: "commission",
    category: "renovation",
    city: "Kecskemét",
    startedAt: "2026-04",
    expectedCompletion: "2026-07",
    areaSqm: 95,
    scope: "Teljes lakásfelújítás",
    tldr:
      "Megrendelésre zajló teljes lakásfelújítás — bontási és szerkezeti átalakítások fázisában, lakott környezetben.",
    currentStatus:
      "A bontási munkák és a faláttörések zajlanak; a szakágak sorrendje napi művezetői koordinációval fut.",
    heroImage: {
      src: S.felujitas,
      alt: "Stock fotó: felújítás — futó projekt helyőrző",
    },
    cardImage: {
      src: S.csaladi,
      alt: "Stock fotó: felújított tér, futó projekt helyőrző",
    },
    gallery: [
      stock("kapcsolatHero", "Stock fotó: lakás belső — futó projekt helyőrző"),
      stock("telephely", "Stock fotó: részlet — futó projekt helyőrző"),
      stock("munka", "Stock fotó: bontás — futó projekt helyőrző"),
      stock("kozepulet", "Stock fotó: állapot — futó projekt helyőrző"),
    ],
    published: true,
  },
]

export function getPublishedActiveProjects(now: Date = new Date()): ActiveProject[] {
  return ACTIVE_PROJECTS.filter((p) => p.published).sort(
    (a, b) =>
      getProjectTimelineState(b, now).progressPercent -
      getProjectTimelineState(a, now).progressPercent,
  )
}

export function getActiveProjectCount(): number {
  return getPublishedActiveProjects().length
}

export function getActiveProjectBySlug(slug: string): ActiveProject | undefined {
  return ACTIVE_PROJECTS.find((p) => p.slug === slug && p.published)
}

export function getActiveProjectSlugs(): string[] {
  return getPublishedActiveProjects().map((p) => p.slug)
}

export function getRelatedActiveProjects(
  current: ActiveProject,
  limit = 4,
): ActiveProject[] {
  return getPublishedActiveProjects()
    .filter((p) => p.slug !== current.slug)
    .slice(0, limit)
}

export function activeProjectDetailPath(slug: string): string {
  return `/futo-projektek/${slug}`
}

export type ProjectFactRow = {
  label: string
  value: string
}

export function formatProjectMonth(value: string): string {
  const [year, month] = value.split("-")
  return `${year}. ${month}.`
}

export function getProjectFactRows(
  project: ActiveProject,
  now: Date = new Date(),
): ProjectFactRow[] {
  const timeline = getProjectTimelineState(project, now)

  return [
    { label: "Típus", value: PROJECT_CATEGORY_LABELS[project.category] },
    { label: "Beruházás", value: PROJECT_OWNERSHIP_LABELS[project.ownership] },
    { label: "Helyszín", value: project.city },
    { label: "Aktuális fázis", value: PROJECT_PHASE_LABELS[timeline.phase] },
    {
      label: "Kezdés",
      value: formatProjectMonth(project.startedAt),
    },
    {
      label: "Várható átadás",
      value: formatProjectMonth(project.expectedCompletion),
    },
  ]
}

export function getProjectDetailImages(project: ActiveProject): ProjectImage[] {
  return [project.heroImage, ...project.gallery]
}

export function getProjectPhaseIndex(phase: ProjectPhase): number {
  return PROJECT_PHASE_ORDER.indexOf(phase)
}
