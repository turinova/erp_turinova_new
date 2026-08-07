/**
 * Homepage below-fold content.
 * Hero copy lives in HomeHero.tsx and must stay untouched.
 * Structure: offer → promises → works → FAQ → CTA.
 * Never use "prémium", "olcsó", or "legolcsóbb". No em dashes.
 */

/** Front-facing service grid — bento sizes so 7 cards fill without a lonely last tile */
export const HOME_OFFER = {
  label: "Amit vállalunk",
  title: "Generálkivitelezés. Egy felelős csapat.",
  lead:
    "Ipari épületek, társasházak, családi házak és felújítások. Bács-Kiskun és Pest megyében, a tervektől az átadásig.",
  cards: [
    {
      href: "/szolgaltatasok/ipari-epuletek",
      label: "Ipari épületek",
      text: "Csarnokok, autószalonok, gyártóüzemek. Határidőre, egy kézben.",
      image: "/img/nav/ipari-epuletek.jpg",
      size: "feature",
    },
    {
      href: "/szolgaltatasok/tarshazak",
      label: "Társasházak",
      text: "Lakóparkok és társasházak. Ütem egy kézben, dokumentált átadás.",
      image: "/img/nav/kozepuletek.jpg",
      size: "md",
    },
    {
      href: "/szolgaltatasok/csaladi-haz-epites",
      label: "Családi ház",
      text: "Meglévő terv alapján, beköltözhető állapotig.",
      image: "/img/nav/csaladi-haz.jpg",
      size: "md",
    },
    {
      href: "/szolgaltatasok/kozepuletek",
      label: "Középületek",
      text: "Óvodák, bölcsődék, hivatalok. Dokumentált átadással.",
      image: "/img/szolgaltatasok/ipari-epuletek.jpg",
      size: "lg",
    },
    {
      href: "/szolgaltatasok/felujitas",
      label: "Felújítás",
      text: "Lakás- és házfelújítás összehangolt szakágakkal.",
      image: "/img/nav/felujitas.jpg",
      size: "lg",
    },
    {
      href: "/szolgaltatasok/szakagi-kivitelezes",
      label: "Szakági kivitelezés",
      text: "Villany, gépészet, burkolás, térkő. Generál nélkül is.",
      image: "/img/nav/szakagi-kivitelezes.jpg",
      size: "lg",
    },
    {
      href: "/szolgaltatasok/asztalos-munkak",
      label: "Asztalos munkák",
      text: "Beépített bútor a Hírös-Ablak kecskeméti üzeméből.",
      image: "/img/asztalos/portfolio/kitchen-panorama.jpg",
      size: "lg",
    },
  ],
} as const

/** Full service list for JSON-LD ItemList (SEO) — mirrors HOME_OFFER.cards */
export const HOME_SERVICES = {
  items: HOME_OFFER.cards.map(({ href, label, text }) => ({
    href,
    label,
    text,
  })),
} as const

export const HOME_PROMISES = {
  label: "Amire számíthat",
  title: "Amit végig tartunk.",
  items: [
    {
      index: "01",
      title: "Egy felelős kapcsolattartó",
      body: "Egy ember viszi a projektet. Nem a szakágakat kergeti.",
    },
    {
      index: "02",
      title: "Írásos keretek",
      body: "Műszaki tartalom és ütem leírva. Ami nincs bent, az nem vállalás.",
    },
    {
      index: "03",
      title: "Dokumentált átadás",
      body: "Átadáskor az derül ki, amiben előtte megegyeztünk.",
    },
  ],
} as const

/** Simple project grid — not fullscreen scrub */
export const HOME_WORKS = {
  label: "Válogatott munkák",
  title: "Amit már átadtunk.",
  cta: "Összes referencia",
  ctaHref: "/referenciak",
  secondaryCta: "Futó projektek",
  secondaryCtaHref: "/futo-projektek",
  panelCta: "Megnézem",
  slugs: [
    "ikerhaz-sajat-kecskemet",
    "autoszalon-kecskemet",
    "kozepulet-ovoda",
  ],
} as const

/** Visible FAQ + FAQPage JSON-LD source (must match) */
export const HOME_FAQ = {
  title: "Gyakori kérdések",
  items: [
    {
      q: "Kinek érdemes a BauGenerállal dolgoznia?",
      a: "Annak, akinek a határidő, az átlátható felelősség és a dokumentált átadás a döntő. A tervektől az átadásig egy felelős csapattal dolgozunk, írásos műszaki tartalommal.",
    },
    {
      q: "Mit vállal a BauGenerál Kft.?",
      a: "Generálkivitelezést: ipari épületek, társasházak, családi házak, középületek, felújítások. Emellett szakági munkákat és asztalos munkákat. A tervektől az átadásig, egy felelős csapattal. Tervezést és engedélyezést nem vállalunk.",
    },
    {
      q: "Hol vállalnak munkát?",
      a: "Bács-Kiskun megyében (Kecskemét és környéke), Pest megyében (kiemelten a budai agglomeráció: Üröm, Solymár, Pilisvörösvár, Budakalász, Nagykovácsi térsége), valamint a Balaton környékén. A székhelyünk Kecskeméten van.",
    },
    {
      q: "Vállalnak szakági munkákat generálkivitelezés nélkül?",
      a: "Igen: villanyszerelés, gépészet, burkolás, térkövezés és további szakágak önálló megbízásként is. Ha több szakág fut párhuzamosan, a generálkivitelezés általában nyugodtabb.",
    },
    {
      q: "Készítenek egyedi bútort is?",
      a: "Igen. Az egyedi beépített bútorokat és konyhákat a Hírös-Ablak Kft. gyártja Kecskeméten, saját üzemben. Így a kulcsrakész átadás beköltözhető otthont jelenthet.",
    },
    {
      q: "Van publikus ár vagy négyzetméterár a honlapon?",
      a: "Nincs publikus négyzetméterár. Az ajánlat a helyszín és a műszaki tartalom alapján, írásban készül. A kapcsolat oldalon hagyhat üzenetet; hamarosan emailben jelentkezünk.",
    },
  ],
} as const

export const HOME_OUTRO = {
  title: "Beszéljünk a projektjéről.",
  note: "Írja meg a helyszínt és a projekt jellegét. Hamarosan emailben jelentkezünk.",
  cta: "Kapcsolat",
  ctaHref: "/kapcsolat",
  image: "/img/hero/house.jpg",
} as const
