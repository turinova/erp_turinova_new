import { COMPANY } from "@/lib/company"

const FOUNDING_YEAR = new Date(COMPANY.foundingDate).getFullYear()
const YEARS_ON_MARKET = new Date().getFullYear() - FOUNDING_YEAR

export const ABOUT_PROFILE = {
  title: "Ipari és összetett építési projektek kivitelezése tervezéstől kulcsátadásig.",
  paragraphs: [
    "A BauGenerál Kft.-t 2010-ben alapítottuk Kecskeméten. Generálkivitelezőként egyetlen partnerként vállaljuk a teljes folyamatot: a szakágaktól az átadásig. A megrendelő egy kapcsolattartóval tárgyal, egy csapat koordinálja a kivitelezést.",
    "Elsősorban fejlesztőkkel, tulajdonosokkal, önkormányzatokkal és franchise-partnerekkel dolgozunk Bács-Kiskun és Pest megyében, valamint a Balaton környékén. Szándékosan nem vállalunk dokumentáció nélküli munkákat; ha a projekt nem illeszkedik a csapatunk kapacitásához, ezt őszintén megmondjuk.",
  ],
  stats: [
    { value: String(YEARS_ON_MARKET), label: "év a piacon" },
    { value: String(COMPANY.headcount), label: "fős csapat" },
    { value: String(COMPANY.serviceArea.length), label: "régió" },
    { value: "1", label: "felelős modell" },
  ],
  links: [
    {
      href: "/kapcsolat",
      label: "Kapcsolat",
      description: "Csapat, elérhetőség, üzenet írása",
    },
    {
      href: "/futo-projektek",
      label: "Futó projektek",
      description: "Aktív kivitelezéseink, fázissal",
    },
    {
      href: "/referenciak",
      label: "Referenciák",
      description: "Kivitelezett projektek és munkáink",
    },
  ],
} as const

/** OG image for /rolunk */
export const ABOUT_OG_IMAGE = "/img/rolunk/hero-work.jpg"
