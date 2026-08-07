/**
 * Sajtómegjelenések — külső cikkek, ahol BauGenerál projektek szerepeltek.
 * Saját URL: /megjelenesek/[slug] (idézhető hub); külső URL = citation/forrás.
 */

import { COMPANY, ORGANIZATION_ID } from "@/lib/company"
import { absoluteUrl } from "@/lib/seo"

export type PressAppearance = {
  slug: string
  /** Rövid title/meta/breadcrumb (≤55–60 kar.), em dash nélkül */
  seoTitle: string
  /** Teljes sajtócím / H1 */
  title: string
  publisher: string
  /** ISO nap (YYYY-MM-DD) vagy csak év (YYYY), ha a pontos nap nem ismert */
  publishedAt: string
  /** Eredeti külső cikk URL (citation) */
  url: string
  /** 40–60 szó, lista + meta description */
  summary: string
  /** Detail oldal saját összefoglaló (2–3 bekezdés), nem cikk-másolat */
  body: readonly string[]
  place: string
  /** CSS gradient for placeholder media */
  placeholderGradient: string
  /** Optional local image under /public */
  imageSrc?: string
  imageAlt?: string
}

export const PRESS_APPEARANCES: readonly PressAppearance[] = [
  {
    slug: "okos-turisztikai-kozpont-toserdo-lakitelek",
    seoTitle: "Ökoturisztikai Központ, Lakitelek",
    title: "Augusztus 20-án ünnepélyesen átadták az Ökoturisztikai Központot a Tőserdőben",
    publisher: "Lakitelek Népfőiskola",
    publishedAt: "2023-08-24",
    url: "https://nepfolakitelek.hu/cikkek/hirek/augusztus-20-an-unnepelyesen-atadtak-a",
    summary:
      "Lakiteleken, a Tőserdőben átadták az Ökoturisztikai Központot. A létesítmény a BauGenerál Kft. kivitelezésében készült el; a helyi sajtó az államalapítási ünnepség keretében számolt be az átadásról.",
    body: [
      "A Tőserdőben átadott ökoturisztikai központ a BauGenerál Kft. kivitelezésében készült el. A helyi beszámoló az államalapítási ünnepséghez kötötte az átadást, és a létesítmény közösségi, turisztikai szerepét emelte ki.",
      "Ezen az oldalon a cég hivatalos, rövid összefoglalója olvasható. Az eredeti cikk a Lakitelek Népfőiskola oldalán érhető el; a forráslink alább található.",
      "Hasonló középület vagy turisztikai létesítmény kivitelezése érdekel? Írjon a Kapcsolat oldalon, és megbeszéljük a projekt körét.",
    ],
    place: "Lakitelek",
    placeholderGradient:
      "linear-gradient(135deg, #2F4A3C 0%, #A60C19 45%, #1C1A18 100%)",
    imageSrc: "/img/megjelenesek/okos-turisztikai-kozpont-toserdo.png",
    imageAlt: "Ökoturisztikai Központ a Tőserdőben, Lakitelek, BauGenerál kivitelezés",
  },
  {
    slug: "janoshalmi-jarasi-hivatal",
    seoTitle: "Jánoshalmi Járási Hivatal",
    title: "Átadták a Jánoshalmi Járási Hivatal új épületét",
    publisher: "Délalföld Info",
    publishedAt: "2019",
    url: "https://delalfoldinfo.hu/bacs-kiskun/janoshalmi-jaras/janoshalma/atadtak-a-janoshalmi-jarasi-hivatal-uj-epuletet/",
    summary:
      "Jánoshalmán átadták a járási hivatal új épületét. A középület generálkivitelezését a BauGenerál Kft. végezte; a beszámoló a hivatalos átadásról és a helyi jelentőségéről szól.",
    body: [
      "A Jánoshalmi Járási Hivatal új épületének generálkivitelezését a BauGenerál Kft. végezte. A Délalföld Info a hivatalos átadásról és a beruházás helyi jelentőségéről írt.",
      "Az oldal a cég összefoglalója: ki a kivitelező, hol volt a projekt, melyik forrás számolt be róla. A teljes cikk a kiadó oldalán olvasható.",
      "Középület vagy intézményi épület kivitelezését tervezi Bács-Kiskunban? Keressen minket a Kapcsolat oldalon.",
    ],
    place: "Jánoshalma",
    placeholderGradient:
      "linear-gradient(135deg, #A60C19 0%, #4A4640 50%, #E5E1D9 100%)",
    imageSrc: "/img/megjelenesek/janoshalmi-jarasi-hivatal.jpg",
    imageAlt: "Jánoshalmi Járási Hivatal új épülete, BauGenerál kivitelezés",
  },
  {
    slug: "arpadvarosi-ovoda-kecskemet",
    seoTitle: "Árpádvárosi óvoda, Kecskemét",
    title: "Befejeződött a kecskeméti Árpádvárosi óvoda infrastrukturális fejlesztése",
    publisher: "Hírös",
    publishedAt: "2018",
    url: "http://archiv.hiros.hu/hirek/befejezodott-a-kecskemeti-arpadvarosi-ovoda-infrastrukturalis-fejlesztese",
    summary:
      "Kecskeméten lezárult az Árpádvárosi óvoda infrastrukturális fejlesztése. A kivitelezést a BauGenerál Kft. végezte; a helyi hír a befejezésről és a fejlesztés céljáról ír.",
    body: [
      "Az Árpádvárosi óvoda infrastrukturális fejlesztésének kivitelezését Kecskeméten a BauGenerál Kft. végezte. A Hírös a befejezésről és a fejlesztés céljáról számolt be.",
      "Itt nem a teljes cikk másolata van, hanem a cég rövid, ellenőrizhető összefoglalója. Az eredeti forrás a Hírös archívumában elérhető.",
      "Óvoda, iskola vagy más közintézmény felújítása / építése érdekel? Írjon a Kapcsolat oldalon.",
    ],
    place: "Kecskemét",
    placeholderGradient:
      "linear-gradient(135deg, #6D0811 0%, #8A8478 55%, #1C1A18 100%)",
    imageSrc: "/img/megjelenesek/arpadvarosi-ovoda.jpg",
    imageAlt: "Árpádvárosi Csigabiga Óvoda, Kecskemét, BauGenerál kivitelezés",
  },
  {
    slug: "kefag-solti-kulcsoshaz",
    seoTitle: "KEFAG kulcsosház, Solt",
    title: "Felavatták a KEFAG Zrt. solti kulcsosházát",
    publisher: "KEOL",
    publishedAt: "2017-05-26",
    url: "https://keol.hu/kecskemet-bacs/felavattak-a-kefag-zrt-solti-kulcsoshazat",
    summary:
      "Solton felavatták a KEFAG Zrt. új kulcsosházát. A felújítást és bővítést a BauGenerál Kft. kivitelezte; a cikk az avatásról és a szálláshely rendeltetéséről számol be.",
    body: [
      "A KEFAG Zrt. solti kulcsosházának felújítását és bővítését a BauGenerál Kft. kivitelezte. A KEOL az avatásról és a szálláshely rendeltetéséről írt.",
      "Az összefoglaló a cég oldalán van; a részletes beszámoló a KEOL cikkben. Így ellenőrizhető, hogy nem önálló marketingállításról van szó.",
      "Hasonló felújítás vagy bővítés érdekel? Keressen minket a Kapcsolat oldalon.",
    ],
    place: "Solt",
    placeholderGradient:
      "linear-gradient(135deg, #3D5C45 0%, #A60C19 40%, #4A4640 100%)",
    imageSrc: "/img/megjelenesek/kefag-solti-kulcsoshaz.jpg",
    imageAlt: "KEFAG Zrt. solti kulcsosház átadás, BauGenerál kivitelezés",
  },
  {
    slug: "balloszogi-egeszseghaz",
    seoTitle: "Egészségház, Ballószög",
    title: "Megújult a ballószögi egészségház",
    publisher: "BAON",
    publishedAt: "2018-11-15",
    url: "https://www.baon.hu/helyi-kozelet/2018/11/megujult-a-balloszogi-egeszseghaz",
    summary:
      "Ballószögön átadták a megújult egészségházat és a felújított polgármesteri hivatalt. A BauGenerál Kft. volt a kivitelező; a BAON a szalagátvágásról és a beruházás részleteiről ír.",
    body: [
      "Ballószögön a megújult egészségház és a felújított polgármesteri hivatal kivitelezője a BauGenerál Kft. volt. A BAON a szalagátvágásról és a beruházás részleteiről számolt be.",
      "Ezen az oldalon a cég összefoglalója áll. Az eredeti helyi sajtócikk a BAON-on nyitható meg forrásként.",
      "Egészségügyi vagy önkormányzati épület felújítását tervezi? Írjon a Kapcsolat oldalon.",
    ],
    place: "Ballószög",
    placeholderGradient:
      "linear-gradient(135deg, #52060D 0%, #8A8478 50%, #E5E1D9 100%)",
    imageSrc: "/img/megjelenesek/balloszogi-egeszseghaz.jpg",
    imageAlt: "Ballószögi egészségház átadás, BauGenerál kivitelezés",
  },
  {
    slug: "fokusz-takarek-kecskemet",
    seoTitle: "Fókusz Takarék fiók, Kecskemét",
    title: "Megnyitott az új Fókusz Takarék fiók Kecskeméten",
    publisher: "BAON",
    publishedAt: "2019-03-15",
    url: "https://www.baon.hu/helyi-kozelet/2019/03/megnyitott-az-uj-fokusz-takarek-fiok-kecskemeten",
    summary:
      "Kecskeméten megnyílt a Fókusz Takarék új fiókja. A kereskedelmi / banki épület kivitelezésében a BauGenerál Kft. vett részt; a helyi sajtó a megnyitóról számolt be.",
    body: [
      "A kecskeméti Fókusz Takarék új fiókjának kivitelezésében a BauGenerál Kft. vett részt. A BAON a megnyitóról és a kereskedelmi / banki épület átadásáról írt.",
      "Az összefoglaló a cég hivatalos oldala; a teljes beszámoló a BAON cikkében érhető el. Így a megjelenés forrással ellenőrizhető.",
      "Kereskedelmi vagy szolgáltató épület kivitelezése érdekel? Keressen minket a Kapcsolat oldalon.",
    ],
    place: "Kecskemét",
    placeholderGradient:
      "linear-gradient(135deg, #1C1A18 0%, #A60C19 55%, #8A8478 100%)",
    imageSrc: "/img/megjelenesek/fokusz-takarek-kecskemet.jpg",
    imageAlt: "Fókusz Takarék fiók megnyitó, Kecskemét, BauGenerál kivitelezés",
  },
  {
    slug: "moricz-zsigmond-iskola",
    seoTitle: "Móricz Zsigmond iskola, Kecskemét",
    title: "Korszerűsítették a Móricz Zsigmond Általános Iskolát",
    publisher: "Hírös",
    publishedAt: "2017",
    url: "http://archiv.hiros.hu/hirek/korszerusitettek-a-moricz-zsigmond-altalanos-iskolat",
    summary:
      "A Móricz Zsigmond Általános Iskola korszerűsítéséről számolt be a kecskeméti Hírös. A felújítási munkákat a BauGenerál Kft. végezte.",
    body: [
      "A Móricz Zsigmond Általános Iskola korszerűsítésének felújítási munkáit a BauGenerál Kft. végezte. A Hírös a befejezésről és a fejlesztésről számolt be.",
      "Itt a cég rövid összefoglalója van; az eredeti hír a Hírös archívumában olvasható. A megjelenés célja az ellenőrizhető forrás, nem a cikk átvétele.",
      "Iskola vagy más oktatási intézmény felújítása érdekel? Írjon a Kapcsolat oldalon.",
    ],
    place: "Kecskemét",
    placeholderGradient:
      "linear-gradient(135deg, #4A4640 0%, #6D0811 45%, #E5E1D9 100%)",
    imageSrc: "/img/megjelenesek/moricz-zsigmond-iskola.jpg",
    imageAlt: "Móricz Zsigmond Általános Iskola, Kecskemét, BauGenerál kivitelezés",
  },
  {
    slug: "kamara-konferenciaterem",
    seoTitle: "Kamara konferenciaterem, Bács-Kiskun",
    title: "Ünnepélyes szakképzési konferencián avatták a kamara új konferenciatermét",
    publisher: "Civil Napló",
    publishedAt: "2018",
    url: "https://civilnaplo.hu/hirek/27559/unnepelyes-szakkepzesi-konferencian-avattak-a-kamara-uj-konferenciatermet",
    summary:
      "Ünnepélyes keretek között avatták fel a kamara új konferenciatermét. A kivitelezést a BauGenerál Kft. végezte; a Civil Napló a szakképzési konferenciáról és az átadásról ír.",
    body: [
      "A kamara új konferenciatermének kivitelezését a BauGenerál Kft. végezte. A Civil Napló a szakképzési konferenciáról és az ünnepélyes átadásról számolt be.",
      "Az oldalon a cég összefoglalója áll, forráslinkkel. A részletes cikk a Civil Napló oldalán érhető el.",
      "Intézményi vagy kamarai tér kialakítása érdekel? Keressen minket a Kapcsolat oldalon.",
    ],
    place: "Bács-Kiskun",
    placeholderGradient:
      "linear-gradient(135deg, #A60C19 0%, #1C1A18 50%, #8A8478 100%)",
    imageSrc: "/img/megjelenesek/kamara-konferenciaterem.jpg",
    imageAlt: "Kamara konferenciaterem avatás, Bács-Kiskun, BauGenerál kivitelezés",
  },
] as const

/** Látható entitássor a listaoldalon + CollectionPage description (schema = HTML). */
export const PRESS_PAGE_ENTITY_LINE =
  "BauGenerál Kft. · középület-átadások · Bács-Kiskun megye"

export type PressFaqItem = { id: string; q: string; a: string }

export const PRESS_FAQ: readonly PressFaqItem[] = [
  {
    id: "szerep",
    q: "A sajtóban említett projekteknél ti voltatok a kivitelezők?",
    a: "Igen. A felsorolt átadásoknál a BauGenerál Kft. a kivitelező. A helyi sajtó általában az átadásról és a létesítményről ír, nem a szerződés minden sorát idézi.\n\nHa döntéselőkészítéshez kell a pontos kör (mit vittünk, milyen szerepben), a forráscikk mellett írjon: megmondjuk projektenként.",
  },
  {
    id: "intezmenyi",
    q: "Közbeszerzéses vagy önkormányzati projektnél miben vagytok gyakorlottak?",
    a: "A megjelenések főleg intézményi és középület-átadások: óvoda, járáshivatal, egészségház, iskola, bankfiók és hasonló. Ez a környezet más ritmusú, mint egy magánlakás: megrendelői elvárás, átadás, nyilvánosság.\n\nNem azt állítjuk, hogy minden közbeszerzést mi nyertünk. Azt mutatják a cikkek: ilyen megrendelői körben, konkrét helyszíneken dolgoztunk, és a projekt eljutott a nyilvános átadásig.",
  },
  {
    id: "mit-mond",
    q: "Mit mond egy sajtócikk a kivitelező minőségéről?",
    a: "Annyit, hogy a projekt eljutott a nyilvános átadásig, és a BauGenerál névvel szerepel. Ez külső, ellenőrizhető proof, nem helyszínbejárás és nem műszaki audit.\n\nKomoly döntéshez a sajtó mellett ajánlás, referencia és egyeztetés kell. A megjelenés az a réteg, amit kívülről is meg lehet nézni.",
  },
  {
    id: "friss",
    q: "A régebbi cikkek mellett mi mutatja, hogy most is így dolgoztok?",
    a: "A megjelenések dokumentált átadások. A mai ütemet, kapacitást és projektösszetételt a futó projektek és a referenciák mutatják jobban.\n\nDöntéshez érdemes a kettőt együtt nézni: a sajtó a külső bizonyíték, a futó munka a jelenlegi működés.",
  },
  {
    id: "kovetkezo",
    q: "Ha hasonló intézményi vagy középület-projektet tervezek, hol folytassam?",
    a: "Ha a megjelenések alapján egyeztetne, írjon a Kapcsolat oldalon: milyen épület, hol van a helyszín, és hol tart most a projekt.\n\nKözépületi generálkörhöz a Középületek oldal, a szélesebb portfólióhoz a Referenciák és a Futó projektek adnak további példákat.",
  },
]

export function pressDetailPath(slug: string): string {
  return `/megjelenesek/${slug}`
}

export function getPressAppearances(): readonly PressAppearance[] {
  return [...PRESS_APPEARANCES].sort((a, b) =>
    pressSortKey(b).localeCompare(pressSortKey(a)),
  )
}

/** Sort key: year-only → YYYY-12-31 so year sorts within that year. */
function pressSortKey(item: PressAppearance): string {
  if (/^\d{4}$/.test(item.publishedAt)) return `${item.publishedAt}-12-31`
  return item.publishedAt
}

export function getPressSlugs(): string[] {
  return PRESS_APPEARANCES.map((item) => item.slug)
}

export function getPressBySlug(slug: string): PressAppearance | undefined {
  return PRESS_APPEARANCES.find((item) => item.slug === slug)
}

/** Meta / breadcrumb title: always short seoTitle. */
export function pressMetaTitle(item: PressAppearance): string {
  return item.seoTitle
}

export function formatPressDateHu(iso: string): string {
  if (/^\d{4}$/.test(iso)) return iso
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/** Schema.org datePublished: year or full day. */
export function pressDatePublished(iso: string): string {
  if (/^\d{4}$/.test(iso)) return iso
  return iso
}

/** Index: CollectionPage + ItemList — tételek saját URL-re mutatnak; külső = citation. */
export function buildPressCollectionJsonLd(
  items: readonly PressAppearance[],
  pageUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "BauGenerál Kft. sajtómegjelenések Bács-Kiskunban",
    description: PRESS_PAGE_ENTITY_LINE,
    url: pageUrl,
    about: { "@id": ORGANIZATION_ID },
    mainEntity: {
      "@type": "ItemList",
      name: "BauGenerál Kft. sajtómegjelenések",
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(pressDetailPath(item.slug)),
        item: {
          "@type": "WebPage",
          "@id": absoluteUrl(pressDetailPath(item.slug)),
          name: item.seoTitle,
          description: item.summary,
          url: absoluteUrl(pressDetailPath(item.slug)),
          datePublished: pressDatePublished(item.publishedAt),
          ...(item.imageSrc
            ? { image: absoluteUrl(item.imageSrc) }
            : {}),
          about: { "@id": ORGANIZATION_ID },
          contentLocation: {
            "@type": "Place",
            name: item.place,
          },
          citation: {
            "@type": "CreativeWork",
            name: item.title,
            url: item.url,
            publisher: {
              "@type": "Organization",
              name: item.publisher,
            },
          },
        },
      })),
    },
  }
}

export function buildPressDetailJsonLd(item: PressAppearance) {
  const pageUrl = absoluteUrl(pressDetailPath(item.slug))
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": pageUrl,
    name: item.seoTitle,
    headline: item.title,
    description: item.summary,
    url: pageUrl,
    datePublished: pressDatePublished(item.publishedAt),
    ...(item.imageSrc ? { image: absoluteUrl(item.imageSrc) } : {}),
    about: { "@id": ORGANIZATION_ID },
    contentLocation: {
      "@type": "Place",
      name: item.place,
      address: {
        "@type": "PostalAddress",
        addressLocality: item.place,
        addressCountry: "HU",
      },
    },
    citation: {
      "@type": "CreativeWork",
      name: item.title,
      url: item.url,
      datePublished: pressDatePublished(item.publishedAt),
      publisher: {
        "@type": "Organization",
        name: item.publisher,
      },
    },
    isPartOf: {
      "@type": "CollectionPage",
      name: "BauGenerál Kft. sajtómegjelenések Bács-Kiskunban",
      url: absoluteUrl("/megjelenesek"),
    },
    publisher: {
      "@type": "Organization",
      name: COMPANY.shortName,
      url: COMPANY.website,
    },
  }
}

export function buildPressFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRESS_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}
