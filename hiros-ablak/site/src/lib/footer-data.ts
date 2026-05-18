/**
 * Footer-only content tables.
 *
 * Centralised here so the footer can stay declarative and the link-equity /
 * local-SEO surface area is easy to audit and edit in one place.
 *
 * Conventions:
 *  - Hungarian copy, formal "Önözés".
 *  Catalog panel brands: see `catalog-brands.ts` (Supabase).
 *  Showroom / hardware brands: see `showroom-brands.ts` (static).
 */

export type ServiceAreaGroup = {
  label: string
  cities: readonly string[]
}

export const SERVICE_AREAS: readonly ServiceAreaGroup[] = [
  {
    label: "Kecskemét és közvetlen környéke",
    cities: [
      "Kecskemét",
      "Helvécia",
      "Ballószög",
      "Nyárlőrinc",
      "Hetényegyháza",
      "Katonatelep",
    ],
  },
  {
    label: "Bács-Kiskun megye",
    cities: [
      "Lajosmizse",
      "Kerekegyháza",
      "Kiskunfélegyháza",
      "Kiskunhalas",
      "Nagykőrös",
      "Cegléd",
      "Tiszakécske",
      "Lakitelek",
      "Kalocsa",
      "Solt",
    ],
  },
]

export type FooterLink = {
  href: string
  label: string
  external?: boolean
}

export const FOOTER_SERVICES: readonly FooterLink[] = [
  {
    href: "/szolgaltatasok/lapszabaszat-es-elzaras",
    label: "Lapszabászat és élzárás",
  },
  {
    href: "/szolgaltatasok/online-lapszabaszat",
    label: "Online lapszabászat",
  },
  { href: "/butorlap", label: "Bútorlap katalógus" },
  { href: "/munkalap", label: "Munkalap katalógus" },
  {
    href: "/szolgaltatasok/lapszabaszat-es-elzaras",
    label: "ABS élzárás",
  },
  {
    href: "/szolgaltatasok/lapszabaszat-es-elzaras",
    label: "Duplungolás",
  },
  {
    href: "/szolgaltatasok/lapszabaszat-es-elzaras",
    label: "Pánthelyfúrás",
  },
  {
    href: "/szolgaltatasok/lapszabaszat-es-elzaras",
    label: "Szögvágás, íves vágás",
  },
]

export const FOOTER_PRODUCTS: readonly FooterLink[] = [
  { href: "/butorlap", label: "Bútorlap" },
  { href: "/munkalap", label: "Munkalap és asztallap" },
  { href: "/barkacsaruhaz-kecskemet", label: "ABS és melamin élzáró" },
  { href: "/barkacsaruhaz-kecskemet", label: "Vasalat, fiókrendszer" },
  { href: "/barkacsaruhaz-kecskemet", label: "Mosogatótálca, csaptelep" },
  { href: "/barkacsaruhaz-kecskemet", label: "Fogantyú, gola profil" },
  { href: "/barkacsaruhaz-kecskemet", label: "LED bútorvilágítás" },
  { href: "/barkacsaruhaz-kecskemet", label: "Szerszám, ragasztó, szilikon" },
]

export const TURINOVA_REGISTER_URL = "https://www.turinova.hu/register"
export const VASALATMESTER_URL = "https://www.vasalatmester.hu"
export const TURINOVA_HOME_URL = "https://www.turinova.hu"

export const FOOTER_PARTNERS: readonly FooterLink[] = [
  { href: "/asztalos-partner", label: "Asztalos partner program" },
  {
    href: TURINOVA_REGISTER_URL,
    label: "Online rendelési felület",
    external: true,
  },
  {
    href: VASALATMESTER_URL,
    label: "Vasalatmester.hu webáruház",
    external: true,
  },
  {
    href: "/szolgaltatasok/ipari-megoldasok/szallitolada-keszites",
    label: "Szállítóláda, kaloda gyártás",
  },
  { href: "/asztalos-partner", label: "Hitelkeret, projektszámlázás" },
  { href: "/asztalos-partner", label: "Elsőbbségi gyártás" },
]

export type TrustStat = { number: string; label: string }

export const TRUST_STATS: readonly TrustStat[] = [
  { number: "1996", label: "óta a Mindszenti krt. 10." },
  { number: "1500 m²", label: "saját üzem" },
  { number: "500 m²", label: "bemutatóterem" },
  { number: "800+", label: "bútorlap online katalógusban" },
  { number: "30+", label: "márka raktáron" },
]

export type PaymentMethod = { label: string }

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  { label: "Készpénz" },
  { label: "Bankkártya" },
  { label: "Átutalás" },
]

export type LegalLink = { href: string; label: string }

export const LEGAL_LINKS: readonly LegalLink[] = [
  { href: "/adatkezelesi-tajekoztato", label: "Adatkezelési tájékoztató" },
  { href: "/aszf", label: "ÁSZF" },
  { href: "/cookie-tajekoztato", label: "Cookie kezelés" },
  { href: "/llms.txt", label: "LLM / AI összefoglaló" },
]

/* ──────────────────────────────────────────────────────────────────────────
 * Visual placeholders
 * --------------------------------------------------------------------------
 * The four showcase cards in the footer use existing site photos as a
 * temporary placeholder. Once curated footer-specific images are ready,
 * drop them at /public/img/footer/<name>.webp and update the paths below.
 * Recommended target sizes:
 *   - showcase cards: 800×600 (4:3) WebP
 *   - storefront photo: 800×450 (16:9) WebP
 * ─────────────────────────────────────────────────────────────────────── */

export type ShowcaseCard = {
  image: string
  alt: string
  label: string
  caption: string
  href: string
}

export const FOOTER_SHOWCASE: readonly ShowcaseCard[] = [
  {
    image: "/img/BIESSE_SELCO_10660_oriz.jpg",
    alt: "Lapszabászat és élzárás, üzemi lapszabászat Hírös-Ablaknál",
    label: "Lapszabászat és élzárás",
    caption: "1500 m²-es üzem",
    href: "/szolgaltatasok/lapszabaszat-es-elzaras",
  },
  {
    image: "/img/bemutatot_terem.jpg",
    alt: "Hírös-Ablak bemutatóterem és barkácsáruház Kecskeméten",
    label: "Bemutatóterem",
    caption: "500 m²-es bemutatóterem és barkácsáruház",
    href: "/barkacsaruhaz-kecskemet",
  },
  {
    image: "/img/egger_edc2020_heroshot.webp",
    alt: "Bútorlap és munkalap választék a raktárról",
    label: "30+ márka",
    caption: "Több száz tétel raktáron vagy beszerezhetőként",
    href: "/butorlap",
  },
  {
    image: "/img/szallitolada-szallitas.webp",
    alt: "Szállítóláda készítés, ipari faládák",
    label: "Szállítóláda készítés",
    caption: "Egyedi vagy sorozat gyártás",
    href: "/szolgaltatasok/ipari-megoldasok/szallitolada-keszites",
  },
]

// TODO: replace with /img/footer/uzlet.webp (~800×450, 16:9)
export const STOREFRONT_PHOTO = {
  src: "/img/kapcsolat_hero.jpg",
  alt: "Hírös-Ablak üzletünk Kecskeméten, Mindszenti krt. 10.",
}
