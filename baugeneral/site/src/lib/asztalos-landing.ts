/**
 * Asztalos landing: single source of truth for cinematic page copy + images.
 */

export const ASZTALOS_HERO = {
  eyebrow: "BauGenerál",
  title: "Beköltözhetően adjuk át.",
  lead:
    "Nem csak egy konyhát csinálunk. Teljes házat be tudunk bútorozni: konyhától a hálóig, fürdőig. A bútor a saját kecskeméti üzemben készül.",
  image: "/img/asztalos/portfolio/hero-kitchen-island.jpg",
  imageAlt: "Egyedi konyha tölgy bútorral és kőszigettel",
  ctaPrimary: { href: "/kapcsolat", label: "Írjon nekünk" },
  ctaSecondary: { href: "#galeria", label: "Munkáink" },
} as const

export const ASZTALOS_FACTS = [
  { value: "1996", label: "óta gyártunk" },
  { value: "1500 m²", label: "saját üzem" },
  { value: "500 m²", label: "bemutatóterem" },
  { value: "1 felelős", label: "építéstől bútorig" },
] as const

export const ASZTALOS_STORY = {
  label: "Miért más",
  title: "Nem üres falakat adunk át.",
  body: [
    "Sokszor az építés kész, a bútor még nincs. Új ember, új határidő, új viták.",
    "Nálunk a bútor az építéssel megy. Nem kell külön asztalost keresned, amikor már be szeretnél költözni.",
    "Egy házban ez lehet konyha, gardrób, nappali tároló, fürdő, amit a projekt kér. Egy ütem, egy felelős.",
  ],
  image: "/img/asztalos/portfolio/kitchen-panorama.jpg",
  imageAlt: "Nyitott konyha panorámával, egyedi bútor",
} as const

export type AsztalosGalleryItem = {
  src: string
  alt: string
  category: "konyha" | "beepitett" | "belso" | "furdo" | "egyeb"
  span?: "tall" | "wide" | "normal"
}

export const ASZTALOS_GALLERY: readonly AsztalosGalleryItem[] = [
  {
    src: "/img/asztalos/portfolio/kitchen-l-shape.jpg",
    alt: "L-alakú konyha fehér és tölgy frontokkal",
    category: "konyha",
    span: "wide",
  },
  {
    src: "/img/asztalos/portfolio/kitchen-white-oak.jpg",
    alt: "Konyha tölgy felsőszekrénnyel és fehér alsóval",
    category: "konyha",
  },
  {
    src: "/img/asztalos/portfolio/kitchen-island-wide.jpg",
    alt: "Konyhasziget beton hatású munkalappal",
    category: "konyha",
  },
  {
    src: "/img/asztalos/portfolio/kitchen-detail.jpg",
    alt: "Konyharészlet, egyedi frontok",
    category: "konyha",
  },
  {
    src: "/img/asztalos/portfolio/bedroom-wardrobe.jpg",
    alt: "Mennyezetig érő beépített gardrób hálószobában",
    category: "beepitett",
    span: "tall",
  },
  {
    src: "/img/asztalos/portfolio/wardrobe-wall.jpg",
    alt: "Beépített tároló fal padlótól a mennyezetig",
    category: "beepitett",
  },
  {
    src: "/img/asztalos/portfolio/cabinet-tower.jpg",
    alt: "Egyedi szekrénysor a térhez igazítva",
    category: "beepitett",
  },
  {
    src: "/img/asztalos/portfolio/dining-table.jpg",
    alt: "Tölgy étkezőasztal és beépített panelek",
    category: "belso",
    span: "wide",
  },
  {
    src: "/img/asztalos/portfolio/living-dining.jpg",
    alt: "Nappali és étkező beépített bútorral",
    category: "belso",
  },
  {
    src: "/img/asztalos/portfolio/living-tv.jpg",
    alt: "Nappali tölgy bútorokkal",
    category: "belso",
  },
  {
    src: "/img/asztalos/portfolio/stair-wood.jpg",
    alt: "Tölgy lépcső feszített kábelkorláttal",
    category: "egyeb",
  },
  {
    src: "/img/asztalos/portfolio/bath-sauna.jpg",
    alt: "Fürdő lebegő mosdóval és beépített szaunával",
    category: "furdo",
  },
  {
    src: "/img/asztalos/portfolio/bath-vanity.jpg",
    alt: "Fürdőszobai mosdószekrény",
    category: "furdo",
  },
  {
    src: "/img/asztalos/portfolio/bath-vanity-2.jpg",
    alt: "Lebegő tölgy mosdószekrény fürdőben",
    category: "furdo",
  },
  {
    src: "/img/asztalos/portfolio/kitchen-white-oak-2.jpg",
    alt: "Konyha fehér és tölgy felületekkel",
    category: "konyha",
  },
  {
    src: "/img/asztalos/portfolio/kitchen-white-oak-alt.jpg",
    alt: "Konyharészlet frontokkal és munkalappal",
    category: "konyha",
  },
] as const

export const ASZTALOS_GALLERY_HEAD = {
  label: "Munkáink",
  title: "Amit legutóbb adtunk át",
} as const

/** Egy folyamat-szekció: laikus nyelven. */
export const ASZTALOS_PROCESS_HEAD = {
  label: "Így megy",
  title: "A tervtől a beépített bútorig",
  intro:
    "Először megnézzük, mire van szükséged. Utána anyag, gyártás, szerelés. Amíg kész nincs, nem engedjük el.",
} as const

export const ASZTALOS_PROCESS = [
  {
    step: "01",
    title: "Hol mi legyen",
    description:
      "Végigmegyünk a helyiségeken. Megbeszéljük, mi kell a konyhába, a hálóba, a tárolókhoz, és mit nem.",
    image: "/img/asztalos/portfolio/kitchen-island-wide.jpg",
    imageAlt: "Konyha a térben, ahogy a helyhez igazítottuk",
  },
  {
    step: "02",
    title: "Mit válassz",
    description:
      "Bemutatóteremben: front, szín, fogantyú. Nem katalógusból tippelsz, hanem amit meg is foghatsz.",
    image: "/img/asztalos/bemutato.jpg",
    imageAlt: "Bemutatóterem, ahol az anyagokat ki lehet próbálni",
  },
  {
    step: "03",
    title: "Amíg készül",
    description:
      "A bútort a saját üzemben csináljuk meg. Te közben az építéssel foglalkozhatsz; mi jelezzük, mikor jövünk.",
    image: "/img/asztalos/lapszabaszat-biesse.jpg",
    imageAlt: "Gyártás a kecskeméti üzemben",
  },
  {
    step: "04",
    title: "Beépítjük",
    description:
      "A helyszínen felszereljük. Amikor átadjuk, használható. Nem úgy, hogy majd az asztalos.",
    image: "/img/asztalos/portfolio/bedroom-wardrobe.jpg",
    imageAlt: "Beépített gardrób a helyszínen",
  },
] as const

export const ASZTALOS_PARTNER = {
  eyebrow: "Ahol készül",
  title: "Hírös-Ablak, Kecskemét",
  body: "A bútorokat a Hírös-Ablak Kft. készíti a Mindszenti körúti üzemben. Nagyjából 1500 négyzetméter gyártás, 500 négyzetméter bemutató, 1996 óta. Külön cég, közös tulajdonosi háttér.",
  facts: [
    { label: "Üzem", value: "kb. 1500 m²" },
    { label: "Bemutató", value: "500 m²" },
    { label: "Mióta", value: "1996" },
    { label: "Cím", value: "Mindszenti krt. 10." },
  ],
  image: "/img/asztalos/telephely-drone.jpg",
  imageAlt: "Hírös-Ablak faipari üzem és áruház Kecskeméten, drónfelvétel",
  website: "https://www.hirosablak.hu",
  lapszabaszat: "https://www.hirosablak.hu/lapszabaszat-kecskemet",
} as const

export const ASZTALOS_FAQ = [
  {
    id: "one-hand",
    q: "Miért érdemes a bútort a kivitelezővel egyben vinni, nem külön asztalossal?",
    a: "A legtöbb késés és vita ott szokott kialakulni, ahol az építés és a bútor két külön szerződés. Az egyik azt mondja, a fal kész, a másik azt, hogy a méret más, mint a terv. Önnek közben két határidő, két kapcsolattartó, és gyakran kétféle minőségi elvárás marad.\n\nHa a beépített bútor a BauGenerál kivitelezési üteméhez kapcsolódik, egy felelős marad a helyszíni illesztésért és az átadásért. A gyártás Kecskeméten, a Hírös-Ablak üzemben történik; a beépítést és az átadást mi visszük. Két cég, de közös tulajdonosi háttér, tehát nem két idegen partnert kell egymáshoz igazítania.\n\nEz nem azt jelenti, hogy minden projektet kötelezően teljes bútorcsomaggal kell vinni. Azt jelenti: ha bútor is kell, nem kell külön cégek között egyeztetnie.",
  },
  {
    id: "timing",
    q: "Az építéshez képest mikor érdemes a bútorról dönteni?",
    a: "Jó, ha a bútor már akkor szóba kerül, amikor a helyiségek funkciója és a gépészet fő vonalai tiszták: hol a konyha, hol a víz, hol a villany, hol a tárolók. Ha csak a burkolatok után kezdődik a bútortervezés, gyakran kényszermegoldások születnek, vagy a beköltözés csúszik.\n\nÚj építésnél és nagyobb felújításnál ezért a bútor egyeztetését a szerkezet és a szakágak üteméhez igazítjuk, nem a beköltözés hetére. Pontos dátumot projekt nélkül nem ígérünk. Az első beszélgetés célja éppen az, hogy a bútor ne maradjon az utolsó, megoldatlan tétel.",
  },
  {
    id: "duration",
    q: "Mennyi idő, amíg a konyha vagy a beépített bútor a helyén van?",
    a: "Ez anyagtól, mennyiségtől, egyediségtől és attól függ, mennyire kész a helyszín. Egy egyszerűbb konyha más ütem, mint egy teljes ház beépített tárolói. A gyártás a kecskeméti üzemben fut; a beépítés csak akkor kezdhető, ha a helyiség erre alkalmas.\n\nAmit írásban vállalunk, azt az ajánlatban leírjuk: mit gyártunk, mikor várható a szerelés, és mi számít átadott állapotnak. Általános „X hét” ígéretet a weben azért nem teszünk, mert egy félkész helyszín vagy egy későbbi módosítás azonnal felülírja.",
  },
  {
    id: "responsibility",
    q: "Ha a fal, a padló vagy a méret nem stimmel, ki felel?",
    a: "Beépített bútornál a kritikus pont a helyszíni méret és az illesztés. Ha a bútor a mi ütemünkben készül és nálunk szerelődik, a helyszíni felmérés, a gyártási méret és a beépítés egy folyamat. Nem az a cél, hogy utólag eldöntsük, a fal vagy a bútor „hibázott”.\n\nHa a megbízás csak bútorgyártás, és a helyszín más kivitelezőnél készül, az ajánlatban és a szerződésben rögzítjük: mi alapján gyártunk, mikor kell a végleges méret, mit vállalunk a szerelésnél. A lényeg, hogy ez előre legyen tiszta, ne a beépítés napján.",
  },
  {
    id: "scope",
    q: "Csak konyhát, teljes házat, vagy önálló bútormegbízást is vállalnak?",
    a: "Mindhárom előfordul. Van, aki csak konyhát kér. Van, aki családi házban a konyhát, a gardróbokat, a nappali tárolókat és a fürdőszekrényt egy ütemben szeretné. És van, aki építés nélkül, önálló bútormegbízással keres meg minket.\n\nA közös pont: a bútor a Hírös-Ablak üzemben készül, a beépítés megegyezés szerint. Ha a BauGenerál a kivitelező is, a bútor könnyebben illeszkedik a határidőhöz. Ha csak bútor kell, írásos ajánlathoz általában alaprajz, helyszínfotók vagy pontos méretek kellenek.",
  },
  {
    id: "workshop",
    q: "Hol készül a bútor, és meg lehet nézni az anyagot előtte?",
    a: "A bútor Kecskeméten készül, a Hírös-Ablak Kft. Mindszenti körúti üzemében. Van bemutatótér, ahol a frontokat, színeket és fogantyúkat élőben lehet nézni, nem csak képernyőn. Az üzem és a bemutató 1996 óta ugyanazon a telephelyen működik; a BauGenerál székhelye is ugyanott van.\n\nA Hírös-Ablak külön cég, nem a BauGenerál márkaneve. A kapcsolat a közös tulajdonosi háttér és a gyakorlati együttműködés: ha nálunk épít vagy tőlünk rendel bútort, a gyártás ott fut. Részletek lentebb, a partner szekcióban, illetve a hirosablak.hu oldalon.",
  },
  {
    id: "price",
    q: "Hogyan alakul az ár, ha nincs publikus listaár?",
    a: "Egyedi bútorra nincs értelmes netes listaár. Az árat az anyag, a front, a vasalat, a méret, a darabszám, a beépítés nehézsége és a helyszín együtt határozzák meg. Ugyanaz a „konyha” két házban teljesen más összeg lehet.\n\nEzért először azt tisztázzuk, mit kér, milyen helyiségekben, milyen minőségi sávban. Utána írásos ajánlatot adunk. Ha változik, amit kér, az ár is változhat; ezt az ajánlatban és a szerződésben követjük. Árajánlatot a Kapcsolat oldalon tud kérni.",
  },
  {
    id: "area",
    q: "Melyik területeken vállalják a beépítést?",
    a: "A BauGenerál elsősorban Bács-Kiskun megyében, Pest megyében és a Balaton környékén dolgozik. A bútor gyártása Kecskeméten van; a beépítés a projekt helyszínén történik.\n\nHa az ingatlan ettől távolabb esik, a kapcsolatfelvételnél jelezze. Megnézzük, és megmondjuk, vállalható-e.",
  },
] as const

export const ASZTALOS_CTA = {
  title: "Beszéljünk a bútorról",
  body: "Írj pár mondatot a házról vagy a konyháról. Emailben válaszolunk.",
  image: "/img/asztalos/portfolio/living-dining.jpg",
  imageAlt: "Nappali és étkező beépített bútorral",
} as const
