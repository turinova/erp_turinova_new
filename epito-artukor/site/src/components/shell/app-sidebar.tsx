"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { navConfig } from "@/lib/nav-config"
import { TurinovaLogo } from "@/components/brand/turinova-logo"
import { Button } from "@/components/ui/button"
import { CurrentUserSwitcher } from "@/components/shell/current-user-switcher"

const STORAGE_KEY = "epito-artukor:sidebar-collapsed"

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "1") setCollapsed(true)
    } catch {
      /* ignore */
    }
    setMounted(true)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] transition-[width] duration-200 ease-in-out",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div
        className={cn(
          "border-b border-[var(--sidebar-border)] py-4",
          collapsed ? "px-2 text-center" : "px-4"
        )}
      >
        {collapsed ? (
          <TurinovaLogo variant="icon" height={24} className="mx-auto" />
        ) : (
          <TurinovaLogo variant="full" height={22} />
        )}
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
        {navConfig.map((group, groupIndex) => (
          <div
            key={group.group}
            className={cn(
              groupIndex > 0 && "mt-4",
              collapsed && groupIndex > 0 && "border-t border-[var(--sidebar-border)] pt-4"
            )}
          >
            {!collapsed ? (
              <div className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--sidebar-muted)]">
                {group.group}
              </div>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const matchPaths = [item.href, ...(item.matchPrefixes ?? [])]
                const active = matchPaths.some(
                  (p) => pathname === p || pathname.startsWith(`${p}/`)
                )
                const Icon = item.icon

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      style={
                        active
                          ? {
                              backgroundColor: item.accentMuted,
                              boxShadow: `inset 2px 0 0 0 ${item.accent}`,
                            }
                          : undefined
                      }
                      className={cn(
                        "flex items-center rounded-md py-2 text-sm transition-colors",
                        collapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
                        active
                          ? "font-medium text-[var(--sidebar-foreground-strong)]"
                          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-active)] hover:text-[var(--sidebar-active-foreground)]"
                      )}
                    >
                      <Icon
                        className="h-4 w-4 shrink-0"
                        style={{ color: item.accent }}
                      />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-[var(--sidebar-border)] p-2">
        <CurrentUserSwitcher collapsed={collapsed} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn(
            "w-full gap-1 text-[var(--sidebar-muted)] hover:text-[var(--sidebar-foreground-strong)]",
            collapsed ? "justify-center px-0" : "justify-start"
          )}
          title={collapsed ? "Menü kinyitása" : "Menü összecsukása"}
          aria-label={collapsed ? "Menü kinyitása" : "Menü összecsukása"}
          aria-expanded={mounted ? !collapsed : true}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Összecsukás</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
