/** NettFront product range, Inomat colors + FAQ. Shared by page and JSON-LD. */

export const AI_ELEVATOR_PITCH =
  "A HÍRÖS-Ablak Kecskeméten NettFront-partner. Festett, fóliás, Inomat és Linea frontokat rendelhet nálunk. Az Inomatot a Turinovában online is leadhatja, azonnali árral; a pánthelyfúrást mi végezzük."

export type ProductCard = {
  id: string
  title: string
  subtitle: string
  status: "available" | "soon"
  statusLabel: string
  image: string
  imageAlt: string
}

export const NETTFRONT_PRODUCTS: ProductCard[] = [
  {
    id: "inomat",
    title: "Inomat",
    subtitle: "Szín, méret, azonnal ár",
    status: "available",
    statusLabel: "Online",
    image: "/img/nettfront/inomat.png",
    imageAlt: "NettFront Inomat bútorfrontok Kecskemét",
  },
  {
    id: "festett",
    title: "Festett front",
    subtitle: "RAL, NCS, egyedi szín",
    status: "soon",
    statusLabel: "Személyesen",
    image: "/img/nettfront/festett.png",
    imageAlt: "NettFront festett bútorfrontok",
  },
  {
    id: "folias",
    title: "Fóliás front",
    subtitle: "Faerezetes és uni dekor",
    status: "soon",
    statusLabel: "Személyesen",
    image: "/img/nettfront/folias.png",
    imageAlt: "NettFront fóliás bútorfrontok",
  },
  {
    id: "linea",
    title: "Linea bordázott",
    subtitle: "Falpanel és front",
    status: "soon",
    statusLabel: "Személyesen",
    image: "/img/nettfront/linea.png",
    imageAlt: "NettFront Linea bordázott falpanel",
  },
]

export type InomatColor = {
  id: string
  name: string
  line: "basic" | "pro-hg" | "pro-matt"
  lineLabel: string
  dims: "1D" | "1D-3D"
  image: string
}

export const INOMAT_COLORS: InomatColor[] = [
  {
    id: "polar-white",
    name: "Polar White",
    line: "basic",
    lineLabel: "Basic",
    dims: "1D",
    image: "/img/nettfront/inomat-colors/polar-white.png",
  },
  {
    id: "oyster-beige",
    name: "Oyster Beige",
    line: "basic",
    lineLabel: "Basic",
    dims: "1D",
    image: "/img/nettfront/inomat-colors/oyster-beige.png",
  },
  {
    id: "hg-pure-white",
    name: "HG Pure White",
    line: "pro-hg",
    lineLabel: "Pro High Gloss",
    dims: "1D",
    image: "/img/nettfront/inomat-colors/hg-pure-white.png",
  },
  {
    id: "hg-ivory-white",
    name: "HG Ivory White",
    line: "pro-hg",
    lineLabel: "Pro High Gloss",
    dims: "1D",
    image: "/img/nettfront/inomat-colors/hg-ivory-white.png",
  },
  {
    id: "hg-palo-santo-beige",
    name: "HG Palo Santo Beige",
    line: "pro-hg",
    lineLabel: "Pro High Gloss",
    dims: "1D",
    image: "/img/nettfront/inomat-colors/hg-palo-santo-beige.png",
  },
  {
    id: "hg-dune-beige",
    name: "HG Dune Beige",
    line: "pro-hg",
    lineLabel: "Pro High Gloss",
    dims: "1D",
    image: "/img/nettfront/inomat-colors/hg-dune-beige.png",
  },
  {
    id: "pure-white",
    name: "Pure White",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/pure-white.png",
  },
  {
    id: "ivory-white",
    name: "Ivory White",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/ivory-white.png",
  },
  {
    id: "palo-santo-beige",
    name: "Palo Santo Beige",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/palo-santo-beige.png",
  },
  {
    id: "dune-beige",
    name: "Dune Beige",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/dune-beige.png",
  },
  {
    id: "pearl",
    name: "Pearl",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/pearl.png",
  },
  {
    id: "cedar-green",
    name: "Cedar Green",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/cedar-green.png",
  },
  {
    id: "storm-grey",
    name: "Storm Grey",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/storm-grey.png",
  },
  {
    id: "gold",
    name: "Gold",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/gold.png",
  },
  {
    id: "mist-grey",
    name: "Mist Grey",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/mist-grey.png",
  },
  {
    id: "midnight-blue",
    name: "Midnight Blue",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/midnight-blue.png",
  },
  {
    id: "bronze",
    name: "Bronze",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/bronze.png",
  },
  {
    id: "lava-black",
    name: "Lava Black",
    line: "pro-matt",
    lineLabel: "Pro Matt",
    dims: "1D-3D",
    image: "/img/nettfront/inomat-colors/lava-black.png",
  },
]

export const INOMAT_COLOR_GROUPS = [
  {
    id: "basic",
    title: "Inomat Basic",
    lead: "2 szupermatt szín. PP felület MDF-en. Gyártói kínálatban táblában.",
  },
  {
    id: "pro-hg",
    title: "Inomat Pro High Gloss",
    lead: "4 magasfényű szín. PET felület. Táblában és nullfugás élzárással méretre.",
  },
  {
    id: "pro-matt",
    title: "Inomat Pro Matt",
    lead: "12 szupermatt szín, 1D–3D. PET felület; a matt színek mart fóliás fronttal is kombinálhatók.",
  },
] as const

export const INOMAT_SECTION_LEAD =
  "Az Inomat a NettFront dekorfront-családja: Basic (PP, matt) és Pro (PET, matt vagy High Gloss). Nálunk az Inomatot a Turinovában méretre, azonnali árral rendelheti; a pánthelyfúrást mi végezzük."

export const INOMAT_FACTS = [
  "MDF hordozó; táblaméret 2800×1300 mm (Basic ~18,3 mm, Pro ~18,6 mm)",
  "Pro: nullfugás élzárással méretre is rendelhető",
  "Pro Matt: 1D–3D (sík és mart fóliás fronttal kombinálható)",
  "Front / korpusz; nem munkalapnak",
] as const

export const FAQ_ITEMS = [
  {
    q: "Milyen NettFront frontot lehet nálatok rendelni?",
    a: "A HÍRÖS-Ablak Kecskeméti áruházában festett, fóliás, Inomat és Linea bordázott frontot rendelhet.",
  },
  {
    q: "Mit lehet már online rendelni?",
    a: "Jelenleg csak az Inomatot: a Turinova rendszerben, azonnali árral. Regisztráció után kb. 5 perc.",
  },
  {
    q: "Mi a különbség az Inomat Basic és Pro között?",
    a: "A Basic PP felületű, szupermatt, két színnel, gyártói kínálatban táblában. A Pro PET felületű, matt vagy High Gloss, bővebb színválasztékkal; táblában és nullfugás élzárással méretre is rendelhető.",
  },
  {
    q: "Milyen Inomat színek vannak?",
    a: "Basic: 2 szín. Pro High Gloss: 4 szín. Pro Matt: 12 szín. A minták az oldalon tájékoztató jellegűek.",
  },
  {
    q: "Mit jelent az 1D és a 3D az Inomatnál?",
    a: "Az 1D síklapot jelent. A 3D azt jelzi, hogy az Inomat Pro matt szín mart, fóliás NettFront fronttal is kombinálható.",
  },
  {
    q: "A többi típus hogyan rendelhető?",
    a: "A festett, fóliás és Linea frontot személyesen az áruházban adhatja le. A Turinova felületen „Hamarosan” felirattal szerepelnek.",
  },
  {
    q: "Ki fúrja a pánthelyet?",
    a: "A HÍRÖS-Ablak. A Turinova rendelésnél bejelölheti, ha pánthelyfúrást kér.",
  },
  {
    q: "Kell asztalos a méretekhez?",
    a: "A méreteket érdemes pontosan leadni. A pánthelyfúrást nálunk kérheti.",
  },
  {
    q: "Hol veszem át?",
    a: "Kecskeméten, a HÍRÖS-Ablak áruházában (Mindszenti krt. 10.). Jelenleg csak átvétel lehetséges.",
  },
  {
    q: "Van minta az üzletben?",
    a: "Igen, NettFront felületek ki vannak állítva. Linea mintát jelenleg nem tartunk.",
  },
  {
    q: "Van minimum rendelés?",
    a: "Nincs minimális rendelési mennyiség.",
  },
] as const

export const HOWTO_STEPS = [
  {
    name: "Regisztráció",
    text: "Ingyenes regisztráció a Turinova ügyfélportálon.",
  },
  {
    name: "Inomat választás",
    text: "A Nettfront menüben válassza az Inomat frontot. A többi típus „Hamarosan” felirattal van.",
  },
  {
    name: "Szín és méret",
    text: "Válasszon Inomat színt, adja meg a magasságot és a szélességet. Pánthelyfúrást igény szerint kérhet.",
  },
  {
    name: "Ajánlat és rendelés",
    text: "Generáljon ajánlatot, mentse, majd küldje be a megrendelést. Átvétel Kecskeméten.",
  },
] as const

export const GALLERY_IMAGES = [
  {
    src: "/img/nettfront/inomat.png",
    alt: "NettFront Inomat frontok modern konyhában Kecskemét",
  },
  {
    src: "/img/nettfront/festett.png",
    alt: "NettFront festett konyhafrontok",
  },
  {
    src: "/img/nettfront/folias.png",
    alt: "NettFront fóliás konyhafrontok",
  },
  {
    src: "/img/nettfront/linea.png",
    alt: "NettFront Linea bordázott falpanel",
  },
] as const

export const OG_NETTFRONT_PATH = "/og/og-nettfront.png"
