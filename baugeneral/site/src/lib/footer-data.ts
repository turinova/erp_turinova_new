import type { FooterLink } from "@/lib/routes"

export const FOOTER_CTA = {
  title: "Van építkezése?",
  body: "Írja meg a kerületet vagy a települést (pl. Budapest XI., Üröm, Kecskemét) és mit szeretne. Egy munkanapon belül válaszolunk.",
  button: "Kapcsolat",
} as const

/** Short owner-voice blurb for the footer only (not the JSON-LD entity dump). */
export const FOOTER_BLURB =
  "Kecskeméti generálkivitelező. Csarnok, ház, felújítás, szakág. Budapest, Pest megye, Bács-Kiskun, Balaton környéke."

export const FOOTER_SERVICES: readonly FooterLink[] = [
  { href: "/szolgaltatasok/ipari-epuletek", label: "Ipari épületek" },
  { href: "/szolgaltatasok/csaladi-haz-epites", label: "Családi ház építés" },
  { href: "/szolgaltatasok/kozepuletek", label: "Középületek" },
  { href: "/szolgaltatasok/felujitas", label: "Felújítás" },
  { href: "/szolgaltatasok/szakagi-kivitelezes", label: "Szakági kivitelezés" },
  { href: "/szolgaltatasok/asztalos-munkak", label: "Asztalos munkák" },
]

export const FOOTER_WORK: readonly FooterLink[] = [
  { href: "/futo-projektek", label: "Futó projektek" },
  { href: "/referenciak", label: "Referenciák" },
  { href: "/megjelenesek", label: "Megjelenések" },
  { href: "/generalkivitelezes-bacs-kiskun", label: "Bács-Kiskun" },
  { href: "/generalkivitelezes-pest-megye", label: "Pest megye és Budapest" },
  { href: "/gyors-tenyek", label: "Gyors tények" },
  { href: "/kapcsolat", label: "Kapcsolat" },
]

export const LEGAL_LINKS: readonly FooterLink[] = [
  { href: "/adatkezelesi-tajekoztato", label: "Adatkezelés" },
  { href: "/cookie-tajekoztato", label: "Cookie" },
  { href: "/aszf", label: "ÁSZF" },
  { href: "/llms.txt", label: "Cégadatok (gépeknek)" },
]
