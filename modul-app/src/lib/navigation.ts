import type { LucideIcon } from 'lucide-react'
import {
  BookMarked,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Cog,
  Factory,
  FileText,
  Home,
  Layers,
  Percent,
  Ruler,
  ScanSearch,
  Search,
  Settings,
  Settings2,
  SquareStack,
  Users,
  Wallet,
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
    label: 'Ügyfelek',
    href: '/ugyfelek',
    icon: Users,
    accent: 'slate'
  },
  {
    type: 'link',
    label: 'Árajánlatok',
    href: '/ajanlatok',
    icon: FileText,
    accent: 'slate'
  },
  {
    type: 'link',
    label: 'Megrendelések',
    href: '/megrendelesek',
    icon: ClipboardList,
    accent: 'slate'
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
            label: 'Élzárók',
            href: '/torzsadatok/alapanyagok/elzarok',
            icon: SquareStack,
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

export function pathIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
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
    .filter((link) => pathIsActive(pathname, link.href))
    .sort((a, b) => b.href.length - a.href.length)

  return matches[0] ?? null
}
