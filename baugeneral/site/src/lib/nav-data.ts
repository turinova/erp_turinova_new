/**
 * Header navigation — single source of truth (desktop mega menu + mobile overlay).
 */

export type ServiceIconKey =
  | "industrial"
  | "condo"
  | "house"
  | "public"
  | "reno"
  | "trades"
  | "carpentry"

export type ServiceNavChild = {
  href: string
  label: string
  description: string
  icon: ServiceIconKey
  /** Primary revenue focus — larger card in mega menu */
  featured?: boolean
  /** Nav preview image (replace with project photo when available) */
  previewImage: string
  /** Fallback tint when image loads */
  previewGradient: string
}

export type NavChild = { href: string; label: string }

export type NavItem =
  | { href: string; label: string; children?: undefined }
  | {
      href: string
      label: string
      children: readonly ServiceNavChild[]
    }

export const SERVICE_NAV_ITEMS: readonly ServiceNavChild[] = [
  {
    href: "/szolgaltatasok/ipari-epuletek",
    label: "Ipari épületek",
    description: "Csarnokok, autószalonok, gyártóüzemek Bács-Kiskun és Pest megyében.",
    icon: "industrial",
    featured: true,
    previewImage: "/img/nav/ipari-epuletek.jpg",
    previewGradient:
      "linear-gradient(135deg, #A60C19 0%, #6D0811 50%, #1C1A18 100%)",
  },
  {
    href: "/szolgaltatasok/tarshazak",
    label: "Társasházak",
    description: "Társasházak és lakóparkok Bács-Kiskun és Pest megyében, dokumentált átadással.",
    icon: "condo",
    previewImage: "/img/nav/kozepuletek.jpg",
    previewGradient:
      "linear-gradient(135deg, #8A0A15 0%, #A60C19 45%, #4A4640 100%)",
  },
  {
    href: "/szolgaltatasok/csaladi-haz-epites",
    label: "Családi ház építés",
    description: "Egyedi családi ház Bács-Kiskun és Pest megyében, beköltözhető állapotig.",
    icon: "house",
    previewImage: "/img/nav/csaladi-haz.jpg",
    previewGradient:
      "linear-gradient(135deg, #6D0811 0%, #8A8478 50%, #E5E1D9 100%)",
  },
  {
    href: "/szolgaltatasok/kozepuletek",
    label: "Középületek",
    description: "Bölcsődék, óvodák, hivatalok — középületi generálkivitelezés.",
    icon: "public",
    previewImage: "/img/szolgaltatasok/ipari-epuletek.jpg",
    previewGradient:
      "linear-gradient(135deg, #A60C19 0%, #52060D 55%, #8A8478 100%)",
  },
  {
    href: "/szolgaltatasok/felujitas",
    label: "Felújítás",
    description: "Lakás- és házfelújítás Bács-Kiskun és Pest megyében.",
    icon: "reno",
    previewImage: "/img/nav/felujitas.jpg",
    previewGradient:
      "linear-gradient(135deg, #4A4640 0%, #8A8478 50%, #E5E1D9 100%)",
  },
  {
    href: "/szolgaltatasok/szakagi-kivitelezes",
    label: "Szakági kivitelezés",
    description:
      "Gépészet, villanyszerelés, napelem, térkövezés — önállóan is vállaljuk.",
    icon: "trades",
    previewImage: "/img/nav/szakagi-kivitelezes.jpg",
    previewGradient:
      "linear-gradient(135deg, #1C1A18 0%, #4A4640 50%, #A60C19 100%)",
  },
  {
    href: "/szolgaltatasok/asztalos-munkak",
    label: "Asztalos munkák",
    description: "Egyedi asztalos munkák: beépített bútor, konyhabútor, belső terek.",
    icon: "carpentry",
    previewImage: "/img/asztalos/portfolio/kitchen-panorama.jpg",
    previewGradient:
      "linear-gradient(135deg, #6D4A2F 0%, #8A6A48 50%, #E5E1D9 100%)",
  },
] as const

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/szolgaltatasok/ipari-epuletek",
    label: "Szolgáltatások",
    children: SERVICE_NAV_ITEMS,
  },
  { href: "/futo-projektek", label: "Futó projektek" },
  { href: "/referenciak", label: "Referenciák" },
  { href: "/megjelenesek", label: "Megjelenések" },
  { href: "/kapcsolat", label: "Kapcsolat" },
] as const

export const HEADER_CTA = {
  href: "/kapcsolat",
  label: "Írjon nekünk",
  labelEn: "Get in touch",
  labelDe: "Kontakt",
} as const

import { getActiveProjectCount } from "@/lib/projects"

/** Header status chip — aktív projektek száma */
export const HEADER_STATUS = {
  label: `${getActiveProjectCount()} aktív projekt`,
  href: "/futo-projektek",
} as const

export const LOCALE_SWITCH = {
  hu: { href: "/", label: "HU" },
  en: { href: "/en", label: "EN" },
  de: { href: "/de", label: "DE" },
} as const
