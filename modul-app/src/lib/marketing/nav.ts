import type { LucideIcon } from 'lucide-react'
import { Factory, UsersRound, ClipboardList } from 'lucide-react'

/** Marketing főnav — flat linkek + egyedi modulok csoport. */

export type MarketingNavLink = {
  title: string
  href: string
}

export type UniqueModule = {
  title: string
  href: string
  blurb: string
  Icon: LucideIcon
}

/** Top-level flat nav (Egyedi modulok külön kezelve a shellben). */
export const MARKETING_NAV_LINKS: MarketingNavLink[] = [
  { title: 'Funkciók', href: '/hogyan-mukodik' },
  { title: 'Árak', href: '/arak' },
  { title: 'Kapcsolat', href: '/kapcsolat' }
]

/** Dedikált landinggel rendelkező egyedi / hardveres modulok. */
export const UNIQUE_MODULES: UniqueModule[] = [
  {
    title: 'Lapszabászati modul',
    href: '/lapszabaszat',
    blurb: 'Partnerportál, Opti, gyártás, scan és SMS — a teljes zárt kör.',
    Icon: Factory
  },
  {
    title: 'Jelenléti ív',
    href: '/jelenleti-iv',
    blurb: 'Dolgozók, munkanapok, opcionális chipkártyás beléptető.',
    Icon: ClipboardList
  },
  {
    title: 'Belépőszámláló',
    href: '/beleposzamlalo',
    blurb: 'AI kamera a bejáraton: napi és óránkénti forgalom.',
    Icon: UsersRound
  }
]

/** Footer: story nélkül — funkciók, egyedi modulok, árak, kapcsolat. */
export const MARKETING_FOOTER_LINKS: MarketingNavLink[] = [
  { title: 'Funkciók', href: '/hogyan-mukodik' },
  { title: 'Egyedi modulok', href: '/egyedi-modulok' },
  { title: 'Árak', href: '/arak' },
  { title: 'Kapcsolat', href: '/kapcsolat' }
]

/** Egyedi modul path — nav aktív állapotához. */
export function isUniqueModulePath(pathname: string | undefined): boolean {
  if (!pathname) return false
  return (
    pathname === '/egyedi-modulok' ||
    UNIQUE_MODULES.some((m) => m.href === pathname)
  )
}
