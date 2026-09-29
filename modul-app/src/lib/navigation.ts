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
  Globe,
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
  Receipt,
  Scale,
  Store,
  Tags,
  Truck,
  Undo2,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  Wrench
} from 'lucide-react'

import type { NavAccent } from '@/lib/nav-accent'
import { WEBSHOP_ENABLED } from '@/lib/webshop/enabled'

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

/** Linear-szerű szekció: felirat + items. Üres szekció (entitlement) nem jelenik meg. */
export type NavSection = {
  label: string | null
  items: NavNode[]
}

/**
 * Top-level IA — szerep-chunkok (Pult / Ügyfél / Értékesítés / Gyártás /
 * Beszerzés & készlet / Csapat / Rendszer). Sorrend stabil; addon/entitlement rejt.
 * Pénzügy a bizonylatlista (Értékesítés és Gyártás között).
 */
const allNavSections: NavSection[] = [
  {
    label: null,
    items: [
      {
          type: 'link',
          label: 'Kezdőlap',
          href: '/home',
          icon: Home,
          accent: 'slate'
        }
    ]
  },
  {
    label: 'Pult',
    items: [
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
          label: 'Belépők',
          href: '/belepok',
          icon: UsersRound,
          accent: 'slate'
        }
    ]
  },
  {
    label: 'Ügyfél',
    items: [
      {
          type: 'link',
          label: 'Ügyfelek',
          href: '/ugyfelek',
          icon: Users,
          accent: 'slate'
        },
      {
          type: 'group',
          label: 'Ügyfélrendelések',
          icon: ClipboardList,
          accent: 'slate',
          matchPrefix: '/ugyfelrendelesek',
          children: [
            {
              type: 'link',
              label: 'Rendelések',
              href: '/ugyfelrendelesek',
              icon: ClipboardList,
              accent: 'slate'
            },
            {
              type: 'link',
              label: 'Beszállítói várólista',
              href: '/ugyfelrendelesek/varolista',
              icon: Truck,
              accent: 'slate'
            }
          ]
        }
    ]
  },
  {
    label: 'Értékesítés',
    items: [
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
          label: 'Webshop',
          icon: Store,
          accent: 'slate',
          matchPrefix: '/webshop',
          children: [
            {
              type: 'link',
              label: 'Áttekintés',
              href: '/webshop',
              icon: Store,
              accent: 'slate'
            },
            {
              type: 'link',
              label: 'Bolt katalógus',
              href: '/webshop/katalogus',
              icon: Package,
              accent: 'slate'
            },
            {
              type: 'link',
              label: 'Kategóriák',
              href: '/webshop/kategoriak',
              icon: Layers,
              accent: 'slate'
            },
            {
              type: 'link',
              label: 'Jellemzők',
              href: '/webshop/tulajdonsagok',
              icon: Tags,
              accent: 'slate'
            },
            {
              type: 'link',
              label: 'Értékelések',
              href: '/webshop/ertekelesek',
              icon: MessageSquare,
              accent: 'slate'
            },
            {
              type: 'link',
              label: 'Elállások',
              href: '/webshop/elallasok',
              icon: Undo2,
              accent: 'slate'
            },
            {
              type: 'link',
              label: 'Csatornák',
              href: '/webshop/csatornak',
              icon: Globe,
              accent: 'slate'
            },
            {
              type: 'link',
              label: 'Jogi oldalak',
              href: '/webshop/jogi',
              icon: Scale,
              accent: 'slate'
            },
            {
              type: 'link',
              label: 'Bolt beállítások',
              href: '/webshop/beallitasok',
              icon: Settings2,
              accent: 'slate'
            }
          ]
        }
    ]
  },
  {
    label: 'Pénzügy',
    items: [
      {
        type: 'link',
        label: 'Áttekintés',
        href: '/penzugy',
        icon: Wallet,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Bizonylatok',
        href: '/szamlak',
        icon: Receipt,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Kintlévőség',
        href: '/penzugy/kintlevoseg',
        icon: CircleDollarSign,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'ÁFA összesítő',
        href: '/penzugy/afa',
        icon: Percent,
        accent: 'slate'
      },
      {
        type: 'link',
        label: 'Exportok',
        href: '/penzugy/exportok',
        icon: FileText,
        accent: 'slate'
      }
    ]
  },
  {
    label: 'Gyártás',
    items: [
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
        }
    ]
  },
  {
    label: 'Beszerzés & készlet',
    items: [
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
        }
    ]
  },
  {
    label: 'Csapat',
    items: [
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
              label: 'Munkarend',
              href: '/jelenlet/naptar',
              icon: CalendarRange,
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
              label: 'Dolgozó típusok',
              href: '/dolgozok/tipusok',
              icon: Tags,
              accent: 'slate'
            }
          ]
        }
    ]
  },
  {
    label: 'Rendszer',
    items: [
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
              label: 'Számlázás',
              href: '/beallitasok/szamlazas',
              icon: CircleDollarSign,
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
              label: 'Átvételi blokk',
              href: '/beallitasok/atveteli-blokk',
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
              label: 'SMS sablonok',
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
  }
]

/**
 * Domain accent (top-level) — child örököl.
 * Minden top-level tintelt (nincs szürke „félkész” blokk).
 * Hue újrafelhasználás OK távoli domaineknél; Beállítások/Kezdőlap: slate.
 */
function topLevelAccent(node: NavNode): NavAccent {
  const key = isNavLink(node) ? node.href : node.matchPrefix
  switch (key) {
    case '/home':
    case '/beallitasok':
      return 'slate'
    case '/penzugy':
    case '/penzugy/kintlevoseg':
    case '/penzugy/afa':
    case '/penzugy/exportok':
    case '/szamlak':
      return 'teal'
    case '/kereso':
      return 'cyan'
    case '/opti':
      return 'violet'
    case '/scanner':
      return 'amber'
    case '/pos':
      return 'emerald'
    case '/ugyfelek':
    case '/ugyfelrendelesek':
      return 'blue'
    case '/belepok':
      return 'rose'
    case '/ertekesitesek':
      return 'teal'
    case '/webshop':
      return 'violet'
    case '/beszallitoi-rendelesek':
      return 'amber'
    case '/keszlet':
      return 'cyan'
    case '/megrendelesek':
      return 'emerald'
    case '/jelenlet':
      return 'rose'
    case '/torzsadatok':
      return 'blue'
    default:
      return 'slate'
  }
}

function paintNavTree(nodes: NavNode[], inherited?: NavAccent): NavNode[] {
  return nodes.map((node) => {
    const accent = inherited ?? topLevelAccent(node)
    if (isNavLink(node)) {
      return { ...node, accent }
    }
    return {
      ...node,
      accent,
      children: paintNavTree(node.children, accent)
    }
  })
}

function paintSections(sections: NavSection[]): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: paintNavTree(
        section.items.filter(
          (node) =>
            WEBSHOP_ENABLED ||
            !(node.type === 'group' && node.matchPrefix === '/webshop')
        )
      )
    }))
    .filter((section) => section.items.length > 0)
}

export const mainNavSections: NavSection[] = paintSections(allNavSections)

/** Flatten — path matching / legacy. */
export const mainNavItems: NavNode[] = mainNavSections.flatMap((s) => s.items)

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
