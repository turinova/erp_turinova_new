"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const SETTINGS_TABS = [
  { label: "Saját cég", href: "/beallitasok/ceg" },
  { label: "Alapértelmezések", href: "/beallitasok/alapertelmezettek" },
  { label: "Dokumentumok", href: "/beallitasok/dokumentumok" },
] as const

export function SettingsSubNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--shadow-sm)]">
      {SETTINGS_TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--page-accent)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
