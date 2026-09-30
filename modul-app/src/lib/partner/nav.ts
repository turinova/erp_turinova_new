import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  FileText,
  Home,
  ScanSearch,
  Search,
  Settings
} from 'lucide-react'

import {
  PARTNER_HOME_PATH,
  PARTNER_OPTI_PATH,
  PARTNER_ORDERS_PATH,
  PARTNER_QUOTES_PATH,
  PARTNER_SEARCH_PATH,
  PARTNER_SETTINGS_PATH,
  partnerHref,
  type partnerHrefModeFromPathname
} from '@/lib/auth/surface'
import type { NavAccent } from '@/lib/nav-accent'

export type PartnerNavItem = {
  /** Clean path (/home, /ajanlatok, …) */
  href: string
  label: string
  icon: LucideIcon
  accent: NavAccent
  comingSoon?: boolean
}

export const partnerNavItems: PartnerNavItem[] = [
  { href: PARTNER_HOME_PATH, label: 'Kezdőlap', icon: Home, accent: 'slate' },
  {
    href: PARTNER_SEARCH_PATH,
    label: 'Anyagkereső',
    icon: Search,
    accent: 'teal'
  },
  {
    href: PARTNER_OPTI_PATH,
    label: 'Opti rendelés',
    icon: ScanSearch,
    accent: 'blue'
  },
  {
    href: PARTNER_QUOTES_PATH,
    label: 'Ajánlataim',
    icon: FileText,
    accent: 'violet'
  },
  {
    href: PARTNER_ORDERS_PATH,
    label: 'Beküldött rendeléseim',
    icon: ClipboardList,
    accent: 'emerald'
  },
  {
    href: PARTNER_SETTINGS_PATH,
    label: 'Beállítások',
    icon: Settings,
    accent: 'slate'
  }
]

export function partnerPathIsActive(
  pathname: string,
  cleanHref: string,
  mode: ReturnType<typeof partnerHrefModeFromPathname>
): boolean {
  const href = partnerHref(cleanHref, mode)
  if (pathname === href || pathname === cleanHref) return true
  if (
    cleanHref !== PARTNER_HOME_PATH &&
    (pathname.startsWith(`${href}/`) || pathname.startsWith(`${cleanHref}/`))
  ) {
    return true
  }
  // Prefixed path while comparing clean (after rewrite browser may show clean)
  const prefixed = partnerHref(cleanHref, 'prefixed')
  if (pathname === prefixed || pathname.startsWith(`${prefixed}/`)) return true
  return false
}
