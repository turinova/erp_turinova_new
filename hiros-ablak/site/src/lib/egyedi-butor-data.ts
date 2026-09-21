/** Egyedi bútor Budapesten: portfólió + felmérés CTA. */

export const SURVEY_PHONE = "+36309992800"
export const SURVEY_PHONE_DISPLAY = "+36 30 999 2800"

export const CANONICAL_PATH = "/szolgaltatasok/egyedi-butorgyartas"

export type FurnitureCategory = "konyha" | "gardrob" | "furdo" | "egyeb"

export type FurnitureType = {
  id: FurnitureCategory
  title: string
  description: string
}

export const FURNITURE_TYPES: readonly FurnitureType[] = [
  {
    id: "konyha",
    title: "Konyha",
    description: "Illeszkedik a falakhoz, a csatlakozókhoz és a nyílásokhoz.",
  },
  {
    id: "gardrob",
    title: "Gardrób vagy beépített szekrény",
    description: "Beépített tároló a meglévő térre szabva.",
  },
  {
    id: "furdo",
    title: "Fürdőszoba bútor",
    description: "Mosdószekrény és tároló, nedvességnek ellenálló anyagokból.",
  },
  {
    id: "egyeb",
    title: "Más egyedi bútor",
    description: "Könyvespolc, tv-szekrény, irodabútor.",
  },
] as const

export type GalleryItem = {
  src: string
  alt: string
  category: FurnitureCategory
  /** Valódi pixelméret: enélkül a masonry rossz arányt foglal le és ugrik a layout. */
  width: number
  height: number
}

/** Hand-picked hero shots for Ads first-fold (fullscreen left panel). */
export const HERO_IMAGES: readonly GalleryItem[] = [
  {
    src: "/img/egyedi-butor/BJP_3619.jpg",
    alt: "Fa frontos egyedi konyhasziget fekete munkalappal, Hírös-Ablak gyártásból",
    category: "konyha",
    width: 4128,
    height: 6192,
  },
] as const

export const HERO_CHIPS = [
  "Díjmentes helyszíni felmérés",
  "Pest, Bács-Kiskun, Balaton",
  "Saját üzem 1996 óta",
] as const

/** Form panel fölötti trust sor (Ads + mobil). */
export const FORM_TRUST = [
  "1996 óta",
  "Saját üzem",
  "Díjmentes felmérés",
  "Konyha 2 M Ft-tól",
] as const

/** Egyedi konyha alsó ár-sáv — csak konyhára, nem listaár. */
export const KONYHA_PRICE_FROM = {
  amount: 2_000_000,
  label: "2 millió Ft-tól",
  note: "Az alsó sáv egyszerűbb anyagválasztásra vonatkozik. A pontos ár a felmérés után, tételes ajánlatban szerepel.",
} as const

/**
 * Rövid, crawlable tények — LLM és kereső idézi. Nem marketingmondat,
 * hanem ellenőrizhető állítás.
 */
export const HUB_FACTS = [
  {
    label: "Ki",
    text: "Hírös-Ablak Kft., Kecskemét, saját faipari üzem 1996 óta.",
  },
  {
    label: "Mit",
    text: "Egyedi konyha, beépített gardrób, fürdőszoba bútor és más méretre gyártott bútor.",
  },
  {
    label: "Hol",
    text: "Felmérés és beépítés: Budapest, Pest megye, Bács-Kiskun megye, Balaton környéke. Gyártás: Kecskemét.",
  },
  {
    label: "Ár",
    text: `Egyedi konyha ${KONYHA_PRICE_FROM.label}. A felmérés díjmentes. Listaár nincs: a tételes ajánlat a felmérés után készül.`,
  },
  {
    label: "Hogyan",
    text: "Űrlap vagy telefon → helyszíni felmérés és inspiráció → látványterv és ajánlat → gyártás → beépítés.",
  },
] as const

/**
 * A címsor a kampány ?tipus= paraméterét követi, hogy egyezzen a hirdetés
 * szövegével. Ismeretlen vagy hiányzó paraméter esetén az általános változat.
 */
export const HERO_HEADLINE_DEFAULT = "Olyan bútor, amit nem lehet megvásárolni"

export const HERO_HEADLINES: Record<FurnitureCategory, string> = {
  konyha: "Olyan konyha, amit nem lehet megvásárolni",
  gardrob: "Olyan gardrób, amit nem lehet megvásárolni",
  furdo: "Olyan fürdőszoba, amit nem lehet megvásárolni",
  egyeb: HERO_HEADLINE_DEFAULT,
}

export function heroHeadline(type?: string): string {
  if (!type) return HERO_HEADLINE_DEFAULT
  return HERO_HEADLINES[type as FurnitureCategory] ?? HERO_HEADLINE_DEFAULT
}

/* ──────────────────────────────────────────────────────────────────────────
 * Aloldalak (spoke): saját URL, saját szöveg, a hub galériájának egy szelete.
 * ─────────────────────────────────────────────────────────────────────── */

export type SpokePage = {
  category: Exclude<FurnitureCategory, "egyeb">
  path: string
  /** Rövid link-cím a hubon és a testvéroldalakon. */
  navLabel: string
  /** Egy sor arról, mit talál az oldalon. */
  navSummary: string
}

export const SPOKE_PAGES: readonly SpokePage[] = [
  {
    category: "konyha",
    path: `${CANONICAL_PATH}/egyedi-konyha-budapest`,
    navLabel: "Egyedi konyha",
    navSummary: "Sarkok, gépek, munkalap és a fal dőlése egy tervben.",
  },
  {
    category: "gardrob",
    path: `${CANONICAL_PATH}/beepitett-gardrob-budapest`,
    navLabel: "Beépített gardrób",
    navSummary: "Előszoba, tetőtér, lépcső alatt: ahol nincs kész méret.",
  },
  {
    category: "furdo",
    path: `${CANONICAL_PATH}/furdoszoba-butor-budapest`,
    navLabel: "Fürdőszoba bútor",
    navSummary: "Mosdószekrény és tároló, párának való anyagokból.",
  },
] as const

export function spokeFor(category: FurnitureCategory): SpokePage | undefined {
  return SPOKE_PAGES.find((s) => s.category === category)
}

/* ──────────────────────────────────────────────────────────────────────────
 * Felmérés → beépítés. A HowTo JSON-LD és a látható lépéslista ugyanebből
 * a listából készül, hogy a kettő ne csúszhasson el egymástól.
 * ─────────────────────────────────────────────────────────────────────── */

export type SurveyStep = {
  title: string
  text: string
}

export const SURVEY_STEPS: readonly SurveyStep[] = [
  {
    title: "Jelezze, hogy hol mérjünk fel",
    text: "Az űrlapon a nevét, a telefonszámát és a helyszín címét kérjük. Egy munkanapon belül hívjuk, és egyeztetünk egy időpontot.",
  },
  {
    title: "Kimegyünk és felmérünk",
    text: "Felvesszük a méreteket, megnézzük a csatlakozókat és a tér adottságait. Az inspirációs képeket is elkérjük, és ezek alapján elkezdjük a látványterveket.",
  },
  {
    title: "Részletes ajánlat és látványterv",
    text: "Elküldjük a tételes ajánlatot, és véglegesítjük a látványterveket. Amíg nincs megrendelés, szabadon alakítható.",
  },
  {
    title: "Legyártjuk és beépítjük",
    text: "A bútor a kecskeméti üzemünkben készül el, a beépítést a mi csapatunk végzi a helyszínen.",
  },
] as const

/* ──────────────────────────────────────────────────────────────────────────
 * Hova járunk ki felmérni. A gyártás Kecskeméten van; a felmérés és a
 * beépítés Pest megyében, Bács-Kiskun megyében és a Balaton környékén is.
 * ─────────────────────────────────────────────────────────────────────── */

export type SurveyArea = {
  label: string
  places: readonly string[]
}

export const SURVEY_AREAS: readonly SurveyArea[] = [
  {
    label: "Budapest",
    places: [
      "I–XII. kerület",
      "XIII–XVI. kerület",
      "XVII–XXIII. kerület",
    ],
  },
  {
    label: "Pest megye",
    places: [
      "Érd",
      "Budaörs",
      "Budakeszi",
      "Szentendre",
      "Gödöllő",
      "Dunakeszi",
      "Vác",
      "Cegléd",
      "Nagykőrös",
      "Szigetszentmiklós",
      "Gyál",
      "Vecsés",
      "Monor",
      "Dabas",
      "Pilisvörösvár",
      "Pomáz",
      "Fót",
      "Dunaharaszti",
    ],
  },
  {
    label: "Bács-Kiskun megye",
    places: [
      "Kecskemét",
      "Kiskunfélegyháza",
      "Kiskunhalas",
      "Baja",
      "Kalocsa",
      "Lajosmizse",
      "Kiskőrös",
      "Tiszakécske",
      "Kerekegyháza",
      "Solt",
      "Kiskunmajsa",
      "Jánoshalma",
    ],
  },
  {
    label: "Balaton és környéke",
    places: [
      "Siófok",
      "Balatonfüred",
      "Balatonalmádi",
      "Fonyód",
      "Balatonlelle",
      "Balatonboglár",
      "Zamárdi",
      "Keszthely",
      "Tapolca",
      "Veszprém",
      "Székesfehérvár",
    ],
  },
] as const

/* ──────────────────────────────────────────────────────────────────────────
 * GYIK. A válaszok sima szövegek, mert ugyanez a szöveg megy a FAQPage
 * JSON-LD-be is: ha itt link vagy jelölés lenne, a kettő elcsúszna.
 * ─────────────────────────────────────────────────────────────────────── */

export type FaqEntry = { q: string; a: string }

export const HUB_FAQ: readonly FaqEntry[] = [
  {
    q: "Budapesten is vállalnak egyedi bútort, ha Kecskeméten van az üzem?",
    a: "Igen. A felmérés és a beépítés a helyszínen zajlik, a bútor a kecskeméti üzemünkben készül. Nem adjuk tovább alvállalkozónak.",
  },
  {
    q: "Mennyibe kerül a helyszíni felmérés?",
    a: "Díjmentes. Nem kell előtte megrendelnie semmit: kimegyünk, felvesszük a méreteket, és elmondjuk, mi fér bele a térbe.",
  },
  {
    q: "Mitől függ egy egyedi konyha vagy gardrób ára?",
    a: `Egyedi konyha ${KONYHA_PRICE_FROM.label}. Négy dolog mozgatja az árat: a bútor mérete, a frontanyag, a munkalap és a vasalat. Ugyanaz a konyha kétszer annyiba is kerülhet festett fronttal és kompakt munkalappal, mint bútorlappal és laminált munkalappal. ${KONYHA_PRICE_FROM.note}`,
  },
  {
    q: "Mennyi idővel előbb kell szólni?",
    a: "A határidő a szabad kapacitásunktól, a választott anyagtól és a helyszín állapotától függ. A felmérés után az ajánlatban vállaljuk a konkrét időt.",
  },
  {
    q: "Még építkezünk. Mikor érdemes bútorost hívni?",
    a: "Minél előbb. A legtöbb utólagos kompromisszum abból jön, hogy a konnektor, a gázcsonk, a szellőző vagy a lefolyó nem oda került, ahol a bútor miatt jó lett volna. Ha a villanyszerelés előtt találkozunk, ezeket még papíron el tudjuk rendezni. Kész, vakolt falnál is dolgozunk, csak ott már az adottságokhoz mérünk.",
  },
  {
    q: "Kell hozzá belsőépítész vagy kész látványterv?",
    a: "Nem kötelező. Ha van tervezője, az ő rajza alapján gyártunk. Ha nincs, a látványtervezésben is tudunk segíteni: a felmérésen együtt alakítjuk ki a megoldást.",
  },
  {
    q: "A gépeket, a mosogatót és a vasalatot Önök szerzik be?",
    a: "Ahogy szeretné. Mosogatót, csaptelepet, fogantyút, pántot és fiókrendszert a kecskeméti áruházunkból is tudunk adni. A beépíthető gépeket sokan maguk vásárolják meg; ilyenkor a típusszámokat kérjük a felmérésen, mert a beépítési méretek gépenként eltérnek.",
  },
  {
    q: "Csak teljes konyhát vállalnak, vagy kisebb munkát is?",
    a: "Egy gardróbot, egy mosdószekrényt vagy egy előszobai szekrénysort is legyártunk. Ha pedig maga szeretné összeállítani a bútort, akkor a bútorlap méretre szabása és az élzárás önmagában is megrendelhető nálunk.",
  },
  {
    q: "Budapesten kívül hova mennek ki felmérni?",
    a: "Pest megyébe, Bács-Kiskun megyébe és a Balaton környékére is. Ha a települését nem találja a listában, hívjon fel minket.",
  },
] as const

/** Auto-generated from public/img/egyedi-butor/ (48 photos). */
export const GALLERY: readonly GalleryItem[] = [
  {
    src: "/img/egyedi-butor/20230425_095251.jpeg",
    alt: "Nappali fekete márványmintás kandallófallal, a háttérben a konyhával",
    category: "egyeb",
    width: 4608,
    height: 2592,
  },
  {
    src: "/img/egyedi-butor/20230425_095751.jpeg",
    alt: "Sötét tónusú konyha szigettel, a nappaliból nézve",
    category: "konyha",
    width: 4608,
    height: 2592,
  },
  {
    src: "/img/egyedi-butor/20230425_102020.jpeg",
    alt: "Fürdőszoba márványmintás falburkolattal és fa mosdószekrénnyel",
    category: "furdo",
    width: 2268,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/5D31F322-60C6-446A-9AE0-47DB6CBAEE2B.JPEG",
    alt: "Fehér frontos beépített szekrény az előtérben, fa polccal",
    category: "gardrob",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/BJP_3576.jpg",
    alt: "Hálószoba fa szekrényfallal és nagy üvegfelülettel",
    category: "gardrob",
    width: 4128,
    height: 6192,
  },
  {
    src: "/img/egyedi-butor/BJP_3583.jpg",
    alt: "Étkező fa beépített szekrénysorral, panorámás ablakkal",
    category: "konyha",
    width: 6192,
    height: 4128,
  },
  {
    src: "/img/egyedi-butor/BJP_3587.jpg",
    alt: "Konyhasziget és étkező panorámás tetőtérben",
    category: "konyha",
    width: 6192,
    height: 4128,
  },
  {
    src: "/img/egyedi-butor/BJP_3592 +tv.jpg",
    alt: "Nappali beépített tv-fallal, a háttérben a konyhapulttal",
    category: "egyeb",
    width: 6192,
    height: 4128,
  },
  {
    src: "/img/egyedi-butor/BJP_3608.jpg",
    alt: "Konyhasziget fekete munkalappal és beépített sütővel",
    category: "konyha",
    width: 6192,
    height: 4128,
  },
  {
    src: "/img/egyedi-butor/BJP_3619.jpg",
    alt: "Fa frontos konyhasziget fekete munkalappal és mosogatóval",
    category: "konyha",
    width: 4128,
    height: 6192,
  },
  {
    src: "/img/egyedi-butor/BJP_3641.jpg",
    alt: "Étkező fa falburkolattal és rejtett szekrényajtókkal",
    category: "egyeb",
    width: 4128,
    height: 6192,
  },
  {
    src: "/img/egyedi-butor/BJP_3645.jpg",
    alt: "Fa szekrényfront rejtett ajtóval az étkező mellett",
    category: "gardrob",
    width: 4128,
    height: 6192,
  },
  {
    src: "/img/egyedi-butor/BJP_3650.jpg",
    alt: "Padlótól mennyezetig érő fa gardróbszekrény",
    category: "gardrob",
    width: 4128,
    height: 6192,
  },
  {
    src: "/img/egyedi-butor/BJP_3653.jpg",
    alt: "Fa szekrénysor a lépcső mellett, méretre gyártva",
    category: "gardrob",
    width: 4128,
    height: 6192,
  },
  {
    src: "/img/egyedi-butor/BJP_3663.jpg",
    alt: "Fa lépcsőburkolat és a lépcső alatti tároló",
    category: "egyeb",
    width: 4128,
    height: 6192,
  },
  {
    src: "/img/egyedi-butor/BJP_3739.jpg",
    alt: "Fürdőszoba üvegfallal, fa mosdószekrénnyel és szaunával",
    category: "furdo",
    width: 6192,
    height: 4128,
  },
  {
    src: "/img/egyedi-butor/BJP_3747.jpg",
    alt: "Fürdőszoba fa mosdószekrénnyel és üvegfalú zuhanyzóval",
    category: "furdo",
    width: 4128,
    height: 6192,
  },
  {
    src: "/img/egyedi-butor/BJP_3751.jpg",
    alt: "Fürdőszoba fa mosdószekrénnyel és fa falburkolattal",
    category: "furdo",
    width: 4128,
    height: 6192,
  },
  {
    src: "/img/egyedi-butor/FCE758A7-CF3B-4B02-B926-77ED5CC8ECE1.JPG",
    alt: "Fehér és fa frontos konyha szigettel",
    category: "konyha",
    width: 3024,
    height: 3780,
  },
  {
    src: "/img/egyedi-butor/IMG_0867.JPG",
    alt: "Konyha fehér munkalappal és fa magasszekrénnyel",
    category: "konyha",
    width: 4032,
    height: 3024,
  },
  {
    src: "/img/egyedi-butor/IMG_0883.JPG",
    alt: "Fehér frontos beépített szekrény fa belső fülkével",
    category: "gardrob",
    width: 4032,
    height: 3024,
  },
  {
    src: "/img/egyedi-butor/IMG_0885 2.JPG",
    alt: "Beépített szekrény fehér frontokkal és fa nyitott polccal",
    category: "gardrob",
    width: 4032,
    height: 3024,
  },
  {
    src: "/img/egyedi-butor/IMG_0894.JPG",
    alt: "Előtéri beépített szekrény fehér és fa felületekkel",
    category: "gardrob",
    width: 4032,
    height: 3024,
  },
  {
    src: "/img/egyedi-butor/IMG_0936.JPG",
    alt: "Fehér fiókos beépített komód fa nyitott résszel",
    category: "gardrob",
    width: 4032,
    height: 3024,
  },
  {
    src: "/img/egyedi-butor/IMG_0938.JPG",
    alt: "Fogantyú nélküli fehér szekrényfront fa nyitott polccal",
    category: "gardrob",
    width: 4032,
    height: 3024,
  },
  {
    src: "/img/egyedi-butor/IMG_0939.JPG",
    alt: "Fehér szekrénysor ferde fa betétpolccal",
    category: "gardrob",
    width: 4032,
    height: 3024,
  },
  {
    src: "/img/egyedi-butor/IMG_0943.JPG",
    alt: "Beépített fiókos szekrény fehér fronttal és fa betéttel",
    category: "gardrob",
    width: 4032,
    height: 3024,
  },
  {
    src: "/img/egyedi-butor/IMG_5037.JPG",
    alt: "L alakú konyha fehér és fa frontokkal, beépített sütővel",
    category: "konyha",
    width: 958,
    height: 1280,
  },
  {
    src: "/img/egyedi-butor/IMG_5038 2.JPG",
    alt: "U alakú fehér konyha páraelszívóval",
    category: "konyha",
    width: 958,
    height: 1280,
  },
  {
    src: "/img/egyedi-butor/IMG_5039 2.JPG",
    alt: "Fehér konyha fa felsőszekrényekkel és beépített sütővel",
    category: "konyha",
    width: 1280,
    height: 958,
  },
  {
    src: "/img/egyedi-butor/IMG_5460.jpeg",
    alt: "Fürdőszoba dupla mosdóval és háttérvilágított tükörrel",
    category: "furdo",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5464.jpeg",
    alt: "Fürdőszobai fa szekrény kihúzható szennyestartóval",
    category: "furdo",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5478.jpeg",
    alt: "Szabadon álló kád egyedi fa falburkolat előtt",
    category: "furdo",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5505.jpeg",
    alt: "Fa frontos konyha fekete munkalappal és páraelszívóval",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5506.jpeg",
    alt: "Fa konyha fekete munkalappal és fogantyú nélküli fiókokkal",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5509.jpeg",
    alt: "Fa frontos konyhasor fekete kőmintás hátfallal",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5520.jpeg",
    alt: "Fekete kőmintás hátfal és rejtett világítás a konyhában",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5521.jpeg",
    alt: "Konyhasarok kihúzható sarokelemmel",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5522.jpeg",
    alt: "Konyhafiók belső kialakítása fa elválasztókkal",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5523.jpeg",
    alt: "Konyhaszekrény kihúzható fiókokkal, fa fronttal",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5527.jpeg",
    alt: "Beépített hűtő és sütő fa szekrénysorban",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5537.jpeg",
    alt: "Fürdőszobai mosdószekrény két mosdóval és kihúzható fiókkal",
    category: "furdo",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5556.jpeg",
    alt: "Fa frontos konyha beépített sütővel és fekete munkalappal",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/IMG_5557.jpeg",
    alt: "Fa konyha fekete munkalappal, sarokba építve",
    category: "konyha",
    width: 3024,
    height: 4032,
  },
  {
    src: "/img/egyedi-butor/Zsani_konyha_2.jpg",
    alt: "Magasfényű fehér konyha szürke munkalappal",
    category: "konyha",
    width: 3024,
    height: 3780,
  },
  {
    src: "/img/egyedi-butor/Zsani_konyha_3.jpg",
    alt: "Magasfényű fehér konyha beépített sütővel és mosogatógéppel",
    category: "konyha",
    width: 3024,
    height: 3780,
  },
  {
    src: "/img/egyedi-butor/zsani_konyha_1 2.jpg",
    alt: "Fehér konyha bárpulttal és három bárszékkel",
    category: "konyha",
    width: 3024,
    height: 3780,
  },
  {
    src: "/img/egyedi-butor/zsani_konyha_1.jpg",
    alt: "Fehér konyha félszigetes bárpulttal",
    category: "konyha",
    width: 3024,
    height: 3780,
  },
] as const

/** A hub galériája a hero képét nem ismétli meg. */
export function galleryWithoutHero(): GalleryItem[] {
  const heroSrc = new Set(HERO_IMAGES.map((h) => h.src))
  return GALLERY.filter((g) => !heroSrc.has(g.src))
}

/** Aloldalak galériája: csak az adott kategória fotói. */
export function galleryFor(category: FurnitureCategory): GalleryItem[] {
  return GALLERY.filter((g) => g.category === category)
}

/**
 * Aloldali hero kép kiválasztása fájlnév szerint. Ha a fotó eltűnik a
 * galériából, itt derül ki azonnal, nem néma 404-ként a hirdetésben.
 */
export function galleryItemBySrc(src: string): GalleryItem {
  const item = GALLERY.find((g) => g.src === src)
  if (!item) throw new Error(`Nincs ilyen galériakép: ${src}`)
  return item
}
