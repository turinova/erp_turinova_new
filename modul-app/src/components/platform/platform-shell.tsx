'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Building2,
  Hammer,
  LayoutDashboard,
  Package,
  Puzzle,
  Search,
  type LucideIcon
} from 'lucide-react'
import Image from 'next/image'

import type { SessionUser } from '@/lib/auth/session'
import { usePlatformHref } from '@/lib/platform/use-platform-href'
import { cn } from '@/lib/utils'

const NAV: Array<{ clean: string; label: string; icon: LucideIcon }> = [
  { clean: '/', label: 'Áttekintés', icon: LayoutDashboard },
  { clean: '/kereses', label: 'Keresés', icon: Search },
  { clean: '/tenants', label: 'Cégek', icon: Building2 },
  { clean: '/partnerek', label: 'Partnerek', icon: Hammer },
  { clean: '/csomagok', label: 'Csomagok', icon: Package },
  { clean: '/add-onok', label: 'Add-onok', icon: Puzzle },
  { clean: '/health', label: 'Health', icon: Activity }
]

export function PlatformShell({
  user,
  children
}: {
  user: SessionUser
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const href = usePlatformHref()

  return (
    <div className="relative min-h-screen bg-app">
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-sidebar flex-col border-r border-border bg-surface md:flex"
        aria-label="Platform menü"
      >
        <div className="flex h-topbar shrink-0 items-center border-b border-border px-3">
          <Link href={href('/')} className="flex items-center no-underline">
            <Image
              src="/images/optinova-logo.png"
              alt="Optinova"
              width={120}
              height={24}
              className="h-6 w-auto"
              priority
            />
          </Link>
        </div>
        <div className="border-b border-border px-3 py-2">
          <p className="text-hint font-semibold uppercase tracking-wide text-ink-muted">
            Turinova Platform
          </p>
        </div>
        <nav className="mt-2 flex flex-1 flex-col gap-0.5 px-2 pb-4">
          {NAV.map((item) => {
            const itemHref = href(item.clean)
            const active =
              item.clean === '/'
                ? pathname === '/platform' || pathname === '/'
                : pathname === itemHref ||
                  pathname.startsWith(`${itemHref}/`) ||
                  pathname.startsWith(`/platform${item.clean}`)
            const Icon = item.icon
            return (
              <Link
                key={item.clean}
                href={itemHref}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium no-underline transition-colors',
                  active
                    ? 'bg-subtle text-ink'
                    : 'text-ink-secondary hover:bg-subtle hover:text-ink'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate text-hint text-ink-secondary">{user.email}</p>
          <a
            href={
              process.env.NEXT_PUBLIC_APP_ORIGIN
                ? `${process.env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/$/, '')}/home`
                : '/home'
            }
            className="mt-1 text-hint text-ink underline-offset-2 hover:underline"
          >
            ← Optinova app
          </a>
        </div>
      </aside>

      <div className="md:ml-[var(--sidebar-width)]">
        <header className="flex h-topbar items-center border-b border-border bg-surface px-4 md:px-6">
          <p className="text-body font-medium text-ink">
            Platform operátor konzol
          </p>
        </header>
        <main className="px-4 pb-6 pt-4 md:px-6">{children}</main>
      </div>
    </div>
  )
}
