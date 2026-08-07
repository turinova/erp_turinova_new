/**
 * All marketing routes — metadata, breadcrumbs, sitemap.
 */

export type FooterLink = { href: string; label: string }

export type RouteKey =
  | "home"
  | "gyorsTenyek"
  | "ipari"
  | "tarshazak"
  | "csaladiHaz"
  | "kozepuletek"
  | "felujitas"
  | "szakagi"
  | "asztalos"
  | "pestMegye"
  | "garancia"
  | "futoProjektek"
  | "referenciak"
  | "megjelenesek"
  | "rolunk"
  | "kapcsolat"
  | "adatkezeles"
  | "cookie"
  | "aszf"
  | "enHome"
  | "enIndustrial"
  | "enContact"
  | "deHome"
  | "deIndustrial"
  | "deContact"

export type SiteRoute = {
  path: string
  title: string
  description: string
  label: string
  breadcrumbs: readonly { name: string; path: string }[]
  locale?: "hu" | "en" | "de"
  /** Optional hero / showcase image on stub service pages */
  heroImage?: string
  heroImageAlt?: string
}

export const ROUTES: Record<RouteKey, SiteRoute> = {
  home: {
    path: "/",
    title: "Generálkivitelezés Bács-Kiskun és Pest megyében",
    description:
      "BauGenerál Kft.: ipari épületek, társasházak, családi házak, szakági és asztalos munkák. Kecskemét, Bács-Kiskun és Pest megye (Üröm, Solymár). Egy felelős csapat, a tervektől az átadásig, ahogy megegyeztünk.",
    label: "Főoldal",
    breadcrumbs: [{ name: "Főoldal", path: "/" }],
  },
  gyorsTenyek: {
    path: "/gyors-tenyek",
    title: "Gyors tények",
    description:
      "BauGenerál Kft. rövid összefoglalója AI asszisztenseknek és gyors tájékozódáshoz.",
    label: "Gyors tények",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Gyors tények", path: "/gyors-tenyek" },
    ],
  },
  ipari: {
    path: "/szolgaltatasok/ipari-epuletek",
    title: "Ipari épületek generálkivitelezése Bács-Kiskun és Pest megyében",
    description:
      "Csarnokok, autószalonok, gyártóüzemek és kereskedelmi épületek Bács-Kiskun és Pest megyében. Egy felelős csapat, heti státusz, átadás a nyitáshoz igazítva.",
    label: "Ipari épületek",
    heroImage: "/img/szolgaltatasok/ipari-epuletek.jpg",
    heroImageAlt: "Modern kereskedelmi épület zöld homlokzattal, BauGenerál ipari referencia",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Ipari épületek", path: "/szolgaltatasok/ipari-epuletek" },
    ],
  },
  tarshazak: {
    path: "/szolgaltatasok/tarshazak",
    title: "Társasház generálkivitelezés Bács-Kiskun és Pest megyében",
    description:
      "Társasházak és lakóparkok kivitelezése Bács-Kiskun és Pest megyében (Üröm, Solymár és környéke is). Szerkezettől a dokumentált lakásátadásig, egy felelős csapattal.",
    label: "Társasházak",
    heroImage: "/img/rolunk/hero-work.jpg",
    heroImageAlt: "Társasház építés közben, BauGenerál",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Társasházak", path: "/szolgaltatasok/tarshazak" },
    ],
  },
  csaladiHaz: {
    path: "/szolgaltatasok/csaladi-haz-epites",
    title: "Családi ház építés Bács-Kiskun és Pest megyében",
    description:
      "Egyedi családi ház kivitelezés Bács-Kiskun és Pest megyében (Üröm, Solymár és környéke is). Meglévő terv alapján, beköltözhető állapotig. Igény szerint beépített bútor.",
    label: "Családi ház",
    heroImage: "/img/nav/csaladi-haz.jpg",
    heroImageAlt: "Családi ház, BauGenerál referencia helyőrző",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Családi ház építés", path: "/szolgaltatasok/csaladi-haz-epites" },
    ],
  },
  kozepuletek: {
    path: "/szolgaltatasok/kozepuletek",
    title: "Középületek építése Bács-Kiskun és Pest megyében",
    description:
      "Óvodák, bölcsődék, hivatalok és más középületek generálkivitelezése Bács-Kiskun és Pest megyében, dokumentált átadással.",
    label: "Középületek",
    heroImage: "/img/nav/kozepuletek.jpg",
    heroImageAlt: "Középület, BauGenerál referencia helyőrző",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Középületek", path: "/szolgaltatasok/kozepuletek" },
    ],
  },
  felujitas: {
    path: "/szolgaltatasok/felujitas",
    title: "Lakás- és házfelújítás Bács-Kiskun és Pest megyében",
    description:
      "Teljes lakás- és házfelújítás összehangolt szakágakkal. Bontástól a befejezésig, Bács-Kiskun, Pest megye és a Balaton környéke. Írjon, emailben jelentkezünk.",
    label: "Felújítás",
    heroImage: "/img/nav/felujitas.jpg",
    heroImageAlt: "Lakásfelújítás, BauGenerál kivitelezés",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Felújítás", path: "/szolgaltatasok/felujitas" },
    ],
  },
  szakagi: {
    path: "/szolgaltatasok/szakagi-kivitelezes",
    title: "Szakági kivitelezés Bács-Kiskun és Pest megyében",
    description:
      "Villanyszerelő, burkoló, gépész, térkövezés, hőszigetelés, kerítés, festés, gipszkarton, napelem. Szakáganként, generál nélkül. Kecskemét, Bács-Kiskun és Pest megye.",
    label: "Szakági kivitelezés",
    heroImage: "/img/rolunk/hero-work.jpg",
    heroImageAlt: "Szakági kivitelezés helyszínen, BauGenerál",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Szakági kivitelezés", path: "/szolgaltatasok/szakagi-kivitelezes" },
    ],
  },
  asztalos: {
    path: "/szolgaltatasok/asztalos-munkak",
    title: "Asztalos munkák",
    description:
      "Teljes ház bútorozás Kecskeméten: konyhától a hálóig. A bútor a saját üzemben készül, beépítés és átadás a BauGenerállal.",
    label: "Asztalos munkák",
    heroImage: "/img/asztalos/portfolio/hero-kitchen-island.jpg",
    heroImageAlt: "Egyedi konyha tölgy bútorral és kőszigettel",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Asztalos munkák", path: "/szolgaltatasok/asztalos-munkak" },
    ],
  },
  pestMegye: {
    path: "/generalkivitelezes-pest-megye",
    title: "Generálkivitelezés Pest megyében",
    description:
      "BauGenerál Kft. generálkivitelezés Pest megyében és a budai agglomerációban — Üröm, Solymár, Pilisvörösvár, Budakalász, Nagykovácsi. Ipari, társasház, családi ház.",
    label: "Pest megye",
    heroImage: "/img/hero/house.jpg",
    heroImageAlt: "Generálkivitelezés Pest megyében — BauGenerál",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Pest megye", path: "/generalkivitelezes-pest-megye" },
    ],
  },
  garancia: {
    path: "/garancia-es-felelosseg",
    title: "Garancia és felelősség",
    description:
      "Hogyan vállalunk felelősséget projektjeiért — minden megállapodás egyedi, a szerződésben rögzítve.",
    label: "Garancia",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Garancia és felelősség", path: "/garancia-es-felelosseg" },
    ],
  },
  futoProjektek: {
    path: "/futo-projektek",
    title: "Futó projektek",
    description:
      "Jelenleg is építünk — aktív projektjeink frissítve, ügyfél-jóváhagyással.",
    label: "Futó projektek",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Futó projektek", path: "/futo-projektek" },
    ],
  },
  referenciak: {
    path: "/referenciak",
    title: "Referenciák",
    description:
      "Befejezett projektjeink — ipari, társasház, családi ház, középület és felújítás.",
    label: "Referenciák",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Referenciák", path: "/referenciak" },
    ],
  },
  megjelenesek: {
    path: "/megjelenesek",
    title: "BauGenerál sajtómegjelenések Bács-Kiskunban",
    description:
      "BauGenerál Kft. ellenőrizhető sajtómegjelenések Bács-Kiskunban: óvoda, járáshivatal, egészségház, bankfiók, iskola. Saját összefoglaló és eredeti forráslink.",
    label: "Megjelenések",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Megjelenések", path: "/megjelenesek" },
    ],
  },
  rolunk: {
    path: "/rolunk",
    title: "Rólunk",
    description:
      "A BauGenerál Kft. generálkivitelező Kecskeméten: ipari épületek, társasházak, családi házak, középületek és felújítások Bács-Kiskun és Pest megyében, 2010 óta.",
    label: "Rólunk",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Rólunk", path: "/rolunk" },
    ],
  },
  kapcsolat: {
    path: "/kapcsolat",
    title: "Kapcsolat",
    description:
      "BauGenerál Kft. kapcsolat: űrlap, e-mail, térkép, csapat. Generálkivitelező Bács-Kiskun és Pest megyében; válasz e-mailben. Székhely: Kecskemét.",
    label: "Kapcsolat",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Kapcsolat", path: "/kapcsolat" },
    ],
  },
  adatkezeles: {
    path: "/adatkezelesi-tajekoztato",
    title: "Adatkezelési tájékoztató",
    description:
      "BauGenerál Kft. adatkezelési tájékoztató: kapcsolatfelvételi űrlap, jogalap, érintetti jogok.",
    label: "Adatkezelés",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Adatkezelés", path: "/adatkezelesi-tajekoztato" },
    ],
  },
  cookie: {
    path: "/cookie-tajekoztato",
    title: "Cookie tájékoztató",
    description: "BauGenerál Kft. cookie tájékoztató.",
    label: "Cookie",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "Cookie", path: "/cookie-tajekoztato" },
    ],
  },
  aszf: {
    path: "/aszf",
    title: "Általános szerződési feltételek",
    description: "BauGenerál Kft. általános szerződési feltételek.",
    label: "ÁSZF",
    breadcrumbs: [
      { name: "Főoldal", path: "/" },
      { name: "ÁSZF", path: "/aszf" },
    ],
  },
  enHome: {
    path: "/en",
    title: "General contracting in Bács-Kiskun and Pest counties, Hungary",
    description:
      "BauGenerál Kft. — industrial buildings, condominiums, family homes and renovations in Bács-Kiskun and Pest counties. One team, start to finish. Based in Kecskemét.",
    label: "Home",
    locale: "en",
    breadcrumbs: [
      { name: "Home", path: "/en" },
    ],
  },
  enIndustrial: {
    path: "/en/services/industrial-buildings",
    title: "Industrial building construction",
    description:
      "Warehouses, car dealerships and commercial facilities — general contracting in Bács-Kiskun and Pest counties, Hungary.",
    label: "Industrial",
    locale: "en",
    heroImage: "/img/szolgaltatasok/ipari-epuletek.jpg",
    heroImageAlt: "Modern commercial building with green facade — BauGenerál industrial reference",
    breadcrumbs: [
      { name: "Home", path: "/en" },
      { name: "Industrial buildings", path: "/en/services/industrial-buildings" },
    ],
  },
  enContact: {
    path: "/en/contact",
    title: "Contact",
    description:
      "Tell us about your project — we call you back within one business day.",
    label: "Contact",
    locale: "en",
    breadcrumbs: [
      { name: "Home", path: "/en" },
      { name: "Contact", path: "/en/contact" },
    ],
  },
  deHome: {
    path: "/de",
    title: "Generalunternehmer in Bács-Kiskun und Pest, Ungarn",
    description:
      "BauGenerál Kft. — Industriebauten, Wohnanlagen, Einfamilienhäuser, öffentliche Gebäude und Sanierungen in den Komitaten Bács-Kiskun und Pest. Ein Team von Anfang bis Übergabe. Sitz: Kecskemét.",
    label: "Start",
    locale: "de",
    breadcrumbs: [{ name: "Start", path: "/de" }],
  },
  deIndustrial: {
    path: "/de/services/industrial-buildings",
    title: "Industriebauten (Generalunternehmer)",
    description:
      "Hallen, Autohäuser und Gewerbeimmobilien — Generalunternehmer in Bács-Kiskun und Pest, Ungarn.",
    label: "Industriebauten",
    locale: "de",
    heroImage: "/img/szolgaltatasok/ipari-epuletek.jpg",
    heroImageAlt: "Modernes Gewerbegebäude mit grüner Fassade — BauGenerál Industriereferenz",
    breadcrumbs: [
      { name: "Start", path: "/de" },
      { name: "Industriebauten", path: "/de/services/industrial-buildings" },
    ],
  },
  deContact: {
    path: "/de/contact",
    title: "Kontakt",
    description:
      "Schreiben Sie uns zu Ihrem Projekt — wir antworten per E‑Mail innerhalb eines Werktags.",
    label: "Kontakt",
    locale: "de",
    breadcrumbs: [
      { name: "Start", path: "/de" },
      { name: "Kontakt", path: "/de/contact" },
    ],
  },
}

/** Paths included in sitemap.xml */
export const SITEMAP_ROUTE_KEYS: readonly RouteKey[] = [
  "home",
  "gyorsTenyek",
  "ipari",
  "tarshazak",
  "csaladiHaz",
  "kozepuletek",
  "felujitas",
  "szakagi",
  "asztalos",
  "pestMegye",
  "garancia",
  "futoProjektek",
  "referenciak",
  "megjelenesek",
  "rolunk",
  "kapcsolat",
  "enHome",
  "enIndustrial",
  "enContact",
  "deHome",
  "deIndustrial",
  "deContact",
]
