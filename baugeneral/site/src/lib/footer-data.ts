import type { FooterLink } from "@/lib/routes"

export const FOOTER_SERVICES: readonly FooterLink[] = [
  { href: "/szolgaltatasok/ipari-epuletek", label: "Ipari épületek" },
  { href: "/szolgaltatasok/tarshazak", label: "Társasházak" },
  { href: "/szolgaltatasok/csaladi-haz-epites", label: "Családi ház építés" },
  { href: "/szolgaltatasok/kozepuletek", label: "Középületek" },
  { href: "/szolgaltatasok/felujitas", label: "Felújítás" },
  { href: "/szolgaltatasok/szakagi-kivitelezes", label: "Szakági kivitelezés" },
  { href: "/szolgaltatasok/asztalos-munkak", label: "Asztalos munkák" },
]

export const FOOTER_COMPANY: readonly FooterLink[] = [
  { href: "/futo-projektek", label: "Futó projektek" },
  { href: "/referenciak", label: "Referenciák" },
  { href: "/megjelenesek", label: "Megjelenések" },
  { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
  { href: "/gyors-tenyek", label: "Gyors tények" },
  { href: "/kapcsolat", label: "Kapcsolat" },
]

export const LEGAL_LINKS: readonly FooterLink[] = [
  { href: "/adatkezelesi-tajekoztato", label: "Adatkezelés" },
  { href: "/cookie-tajekoztato", label: "Cookie" },
  { href: "/aszf", label: "ÁSZF" },
  { href: "/llms.txt", label: "LLM / AI összefoglaló" },
]

export const TRUST_STATS = [
  { number: "2010", label: "óta" },
  { number: "BKK", label: "fókusz" },
  { number: "1", label: "kapcsolattartó / projekt" },
] as const
