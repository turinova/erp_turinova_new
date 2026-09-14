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
  PARTNER_SETTINGS_PATH
} from '@/lib/auth/surface'

export type PartnerNavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** true = megjelenik, de még nem használható */
  comingSoon?: boolean
}

export const partnerNavItems: PartnerNavItem[] = [
  { href: PARTNER_HOME_PATH, label: 'Kezdőlap', icon: Home },
  { href: PARTNER_SEARCH_PATH, label: 'Kereső', icon: Search },
  { href: PARTNER_OPTI_PATH, label: 'Opti', icon: ScanSearch },
  { href: PARTNER_QUOTES_PATH, label: 'Ajánlatok', icon: FileText },
  {
    href: PARTNER_ORDERS_PATH,
    label: 'Megrendelések',
    icon: ClipboardList
  },
  { href: PARTNER_SETTINGS_PATH, label: 'Beállítások', icon: Settings }
]

export function partnerPathIsActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  if (href !== PARTNER_HOME_PATH && pathname.startsWith(`${href}/`)) return true
  return false
}
