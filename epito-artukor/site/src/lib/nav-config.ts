import type { LucideIcon } from "lucide-react"
import {
  Archive,
  ClipboardList,
  FileText,
  FolderTree,
  HardHat,
  Hammer,
  Layers,
  List,
  Ruler,
  Settings,
  SlidersHorizontal,
  Upload,
  Users,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Menüpont saját színe (erős) — ikon, aktív állapot, oldal-fejléc */
  accent: string
  /** Halvány háttér-árnyalat az accenthez */
  accentMuted: string
  /** További útvonal-prefixek, amik ehhez a menüponthoz tartoznak */
  matchPrefixes?: string[]
}

export type NavGroup = {
  group: string
  items: NavItem[]
}

export const navConfig: NavGroup[] = [
  {
    group: "Projektek",
    items: [
      {
        label: "Ügyfelek",
        href: "/ugyfelek",
        icon: Users,
        accent: "#2563eb",
        accentMuted: "#eff6ff",
      },
      {
        label: "Árajánlatok",
        href: "/ajanlatok",
        icon: ClipboardList,
        accent: "#7c3aed",
        accentMuted: "#f5f3ff",
      },
      {
        label: "Kivitelezés",
        href: "/kivitelezes",
        icon: Hammer,
        accent: "#ea580c",
        accentMuted: "#fff7ed",
      },
      {
        label: "Archív",
        href: "/archiv",
        icon: Archive,
        accent: "#64748b",
        accentMuted: "#f1f5f9",
      },
    ],
  },
  {
    group: "Adatbázis",
    items: [
      {
        label: "Szakágak",
        href: "/szakagak",
        icon: Layers,
        accent: "#0891b2",
        accentMuted: "#ecfeff",
      },
      {
        label: "Kategóriák",
        href: "/kategoriak",
        icon: FolderTree,
        accent: "#0d9488",
        accentMuted: "#f0fdfa",
      },
      {
        label: "Tételek",
        href: "/tetelek",
        icon: List,
        accent: "#16a34a",
        accentMuted: "#f0fdf4",
      },
      {
        label: "Mértékegységek",
        href: "/mertekegysegek",
        icon: Ruler,
        accent: "#4f46e5",
        accentMuted: "#eef2ff",
      },
      {
        label: "Alvállalkozók",
        href: "/alvalalkozok",
        icon: HardHat,
        accent: "#db2777",
        accentMuted: "#fdf2f8",
      },
    ],
  },
  {
    group: "Eszközök",
    items: [
      {
        label: "Import / Export",
        href: "/import",
        icon: Upload,
        accent: "#0284c7",
        accentMuted: "#f0f9ff",
      },
    ],
  },
  {
    group: "Beállítások",
    items: [
      {
        label: "Saját cég",
        href: "/beallitasok/ceg",
        icon: Settings,
        accent: "#971d25",
        accentMuted: "#fdf2f3",
      },
      {
        label: "Alapértelmezések",
        href: "/beallitasok/alapertelmezettek",
        icon: SlidersHorizontal,
        accent: "#d97706",
        accentMuted: "#fffbeb",
      },
      {
        label: "Dokumentumok",
        href: "/beallitasok/dokumentumok",
        icon: FileText,
        accent: "#059669",
        accentMuted: "#ecfdf5",
      },
    ],
  },
]

function matchesNavItem(item: NavItem, pathname: string): boolean {
  const prefixes = [item.href, ...(item.matchPrefixes ?? [])]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Az útvonalhoz tartozó menüpont (accent-öröklés: a menüpont oldalai a színét követik). */
export function findNavItemByPath(pathname: string): NavItem | undefined {
  for (const group of navConfig) {
    const hit = group.items.find((item) => matchesNavItem(item, pathname))
    if (hit) return hit
  }
  return undefined
}

/** Menüpont keresése pontos href alapján (pl. fázis-href → accent). */
export function findNavItemByHref(href: string): NavItem | undefined {
  for (const group of navConfig) {
    const hit = group.items.find((item) => item.href === href)
    if (hit) return hit
  }
  return undefined
}

export const APP_NAME = "Építő Ártükör"
