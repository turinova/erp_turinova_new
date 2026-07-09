"use client"

import type { CSSProperties, ReactNode } from "react"
import { usePathname } from "next/navigation"
import { findNavItemByPath } from "@/lib/nav-config"

/**
 * Az aktuális útvonalhoz tartozó menüpont színét CSS-változóként
 * (--page-accent, --page-accent-muted) adja tovább az oldal tartalmának —
 * így az oldalak a sidebar menüpontjuk színét követik.
 */
export function PageAccentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const item = findNavItemByPath(pathname)

  const style = {
    "--page-accent": item?.accent ?? "var(--brand)",
    "--page-accent-muted": item?.accentMuted ?? "var(--brand-muted)",
  } as CSSProperties

  return (
    <div style={style} className="contents">
      {children}
    </div>
  )
}
