import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Banknote,
  BookMarked,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Cog,
  Factory,
  FileText,
  Handshake,
  History,
  Home,
  ImageIcon,
  Layers,
  CalendarDays,
  CalendarRange,
  MessageSquare,
  Percent,
  Ruler,
  ScanBarcode,
  ScanSearch,
  Search,
  Settings,
  Settings2,
  ShoppingCart,
  SquareStack,
  RectangleHorizontal,
  Package,
  PackageCheck,
  Tags,
  Truck,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  Wrench
} from 'lucide-react'

import type { NavAccent } from '@/lib/nav-accent'

export type { NavAccent }

export type NavLink = {
  type: 'link'
  label: string
  href: string
  icon: LucideIcon
  accent: NavAccent
}

export type NavGroup = {
  type: 'group'
  label: string
  icon: LucideIcon
  accent: NavAccent
  /** Path prefix — aktív / alapból nyitva, ha a pathname ezzel kezdődik */
  matchPrefix: string
  children: NavNode[]
}

export type NavNode = NavLink | NavGroup

/**
 * Top-level IA (használat-first):
 * 1) Linkek (egy katt) elöl — Home, Kereső, Opti, Scanner, POS, Ügyfelek, Belépők
 * 2) Groupok utána — Értékesítés → … → Beállítások
 * Addon nélkül a sorok entitlement filterrel eltűnnek; a mag sorrendje stabil.
 */
export const mainNavItems: NavNode[] = [
  {
    type: 'link',
    label: 'Kezdőlap',
    href: '/home',
    icon: Home,
    accent: 'slate'
  },
  {
    type: 'link',
    label: 'Kereső',
    href: '/kereso',
    icon: Search,
    accent: 'slate'
  },
  {
    type: 'link',
    label: 'Opti',
    href: '/opti',
    icon: ScanSearch,
    accent: 'slate'
  },
  {
    type: 'link',
    label: 'Scanner',
    href: '/scanner',
    icon: ScanBarcode,
    accent: 'slate'
  },
  {
    type: 'link',
    label: 'POS',
    href: '/pos',
    icon: Banknote,
    accent: 'slate'
  },
  {
    type: 'link',
    label: 'Ügyfelek',
    href: '/ugyfelek',
    icon: Users,
    accent: 'slate'
  },
  {
    type: 'link',
    label: 'Belépők',
    href: '/belepok',
    icon: UsersRound,
    accent: 'slate'
  },
  {
    type: 'group',
    label: 'Értékesítés',
    icon: ShoppingCart,
    accent: 'slate',
    matchPrefix: '/ertekesitesek',
    children: [
      {
        type: 'link',
        label: 'Értékesítések',
        href: '/ertekesitesek',
        icon: ShoppingCart,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Árajánlatok',
        href: '/ertekesitesek/arajanlatok',
        icon: FileText,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Műszakok',
        href: '/ertekesitesek/muszakok',
        icon: History,
        accent: 'slate'
      }
    ]
  },
  {
    type: 'group',
    label: 'Beszerzés',
    icon: Truck,
    accent: 'slate',
    matchPrefix: '/beszallitoi-rendelesek',
    children: [
      {
        type: 'link',
        label: 'Beszállítói rendelések',
        href: '/beszallitoi-rendelesek',
        icon: ClipboardList,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Beérkezések',
        href: '/beerkezesek',
        icon: PackageCheck,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Beszállítók',
        href: '/beszallitok',
        icon: Building2,
        accent: 'slate'
      }
    ]
  },
  {
    type: 'group',
    label: 'Készlet',
    icon: Warehouse,
    accent: 'slate',
    matchPrefix: '/keszlet',
    children: [
      {
        type: 'link',
        label: 'Áttárolások',
        href: '/keszlet/atadasok',
        icon: ArrowLeftRight,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Mozgások',
        href: '/keszlet/mozgasok',
        icon: History,
        accent: 'slate'
      }
    ]
  },
  {
    type: 'group',
    label: 'Lapszabászat',
    icon: Factory,
    accent: 'slate',
    matchPrefix: '/megrendelesek',
    children: [
      {
        type: 'link',
        label: 'Megrendelések',
        href: '/megrendelesek',
        icon: Package,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Lapszabászati ajánlatok',
        href: '/ajanlatok',
        icon: FileText,
        accent: 'slate'
      }
    ]
  },
  {
    type: 'group',
    label: 'Jelenlét',
    icon: CalendarDays,
    accent: 'slate',
    matchPrefix: '/jelenlet',
    children: [
      {
        type: 'link',
        label: 'Jelenlét',
        href: '/jelenlet',
        icon: CalendarDays,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Dolgozók',
        href: '/dolgozok',
        icon: Users,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Munkarend',
        href: '/jelenlet/naptar',
        icon: CalendarRange,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Dolgozó típusok',
        href: '/dolgozok/tipusok',
        icon: Tags,
        accent: 'slate'
      }
    ]
  },
  {
    type: 'group',
    label: 'Törzsadatok',
    icon: BookMarked,
    accent: 'slate',
    matchPrefix: '/torzsadatok',
    children: [
      {
        type: 'group',
        label: 'Alapanyagok',
        icon: Boxes,
        accent: 'slate',
        matchPrefix: '/torzsadatok/alapanyagok',
        children: [
          {
            type: 'link',
            label: 'Táblás anyagok',
            href: '/torzsadatok/alapanyagok/tablas-anyagok',
            icon: Layers,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Szálas anyagok',
            href: '/torzsadatok/alapanyagok/szalas-anyagok',
            icon: RectangleHorizontal,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Élzárók',
            href: '/torzsadatok/alapanyagok/elzarok',
            icon: SquareStack,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Termékek',
            href: '/torzsadatok/alapanyagok/termekek',
            icon: Package,
            accent: 'slate'
          }
        ]
      },
      {
        type: 'group',
        label: 'Rendszer',
        icon: Settings2,
        accent: 'slate',
        matchPrefix: '/torzsadatok/rendszer',
        children: [
          {
            type: 'link',
            label: 'Adónem',
            href: '/torzsadatok/rendszer/adonem',
            icon: Percent,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Fizetési módok',
            href: '/torzsadatok/rendszer/fizetesi-modok',
            icon: Wallet,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Egységek',
            href: '/torzsadatok/rendszer/egysegek',
            icon: Ruler,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Díj típusok',
            href: '/torzsadatok/rendszer/dij-tipusok',
            icon: CircleDollarSign,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Gyártók',
            href: '/torzsadatok/rendszer/gyartok',
            icon: Factory,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Raktárak',
            href: '/torzsadatok/rendszer/raktarak',
            icon: Warehouse,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Berendezés',
            href: '/torzsadatok/rendszer/berendezes',
            icon: Wrench,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Gyártógépek',
            href: '/torzsadatok/rendszer/gyartogepek',
            icon: Cog,
            accent: 'slate'
          },
          {
            type: 'link',
            label: 'Média',
            href: '/torzsadatok/rendszer/media',
            icon: ImageIcon,
            accent: 'slate'
          }
        ]
      }
    ]
  },
  {
    type: 'group',
    label: 'Beállítások',
    icon: Settings,
    accent: 'slate',
    matchPrefix: '/beallitasok',
    children: [
      {
        type: 'link',
        label: 'Cégadatok',
        href: '/beallitasok/cegadatok',
        icon: Building2,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Opti beállítások',
        href: '/beallitasok/opti',
        icon: Settings2,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Online partner',
        href: '/beallitasok/partner',
        icon: Handshake,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'SMS sablon',
        href: '/beallitasok/sms',
        icon: MessageSquare,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Felhasználók',
        href: '/beallitasok/felhasznalok',
        icon: Users,
        accent: 'slate'
      }
    ]
  }
]

export function isNavLink(node: NavNode): node is NavLink {
  return node.type === 'link'
}

export function isNavGroup(node: NavNode): node is NavGroup {
  return node.type === 'group'
}

/** Nyers prefix-egyezés (belső). */
function pathMatchesHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Csoport aktív, ha a prefix vagy bármely leszármazott link egyezik. */
export function navGroupIsActive(group: NavGroup, pathname: string): boolean {
  if (pathMatchesPrefix(pathname, group.matchPrefix)) return true
  for (const child of group.children) {
    if (isNavLink(child) && pathMatchesHref(pathname, child.href)) return true
    if (isNavGroup(child) && navGroupIsActive(child, pathname)) return true
  }
  return false
}

/** Leghosszabb href-egyezés — detail route-okhoz is (pl. /elzarok/[id]). */
export function findNavLinkByPath(pathname: string): NavLink | null {
  const links: NavLink[] = []

  function walk(nodes: NavNode[]) {
    for (const node of nodes) {
      if (isNavLink(node)) links.push(node)
      else walk(node.children)
    }
  }

  walk(mainNavItems)

  const matches = links
    .filter((link) => pathMatchesHref(pathname, link.href))
    .sort((a, b) => b.href.length - a.href.length)

  return matches[0] ?? null
}

/**
 * Link aktív, ha ez a leghosszabb nav-egyezés.
 * Így /ertekesitesek/arajanlatok nem világítja az „Értékesítések” (/ertekesitesek) sort is.
 */
export function pathIsActive(pathname: string, href: string) {
  const best = findNavLinkByPath(pathname)
  return best?.href === href
}
