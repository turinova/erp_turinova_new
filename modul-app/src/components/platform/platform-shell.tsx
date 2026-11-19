'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  Hammer,
  Package,
  Star,
  X,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { MobileNavMenuButton } from '@/components/shell/app-sidebar'
import { Button } from '@/components/ui/button'
import type { SessionUser } from '@/lib/auth/session'
import { usePlatformHref } from '@/lib/platform/use-platform-href'
import { cn } from '@/lib/utils'

/** Lean ops + partner visszajelzés inbox. */
const NAV: Array<{ clean: string; label: string; icon: LucideIcon }> = [
  { clean: '/tenants', label: 'Cégek', icon: Building2 },
  { clean: '/partnerek', label: 'Partnerek', icon: Hammer },
  { clean: '/visszajelzesek', label: 'Visszajelzések', icon: Star },
  { clean: '/katalogus', label: 'Katalógus', icon: Package }
]

function appHomeHref() {
  return process.env.NEXT_PUBLIC_APP_ORIGIN
    ? `${process.env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/$/, '')}/home`
    : '/home'
}

function PlatformNav({
  pathname,
  href,
  onNavigate
}: {
  pathname: string
  href: (clean: string) => string
  onNavigate?: () => void
}) {
  return (
    <nav className="mt-2 flex flex-1 flex-col gap-0.5 px-2 pb-4">
      {NAV.map((item) => {
        const itemHref = href(item.clean)
        const active =
          pathname === itemHref ||
          pathname.startsWith(`${itemHref}/`) ||
          pathname.startsWith(`/platform${item.clean}`) ||
          (item.clean === '/katalogus' &&
            (pathname.includes('/csomagok') ||
              pathname.includes('/add-onok')))
        const Icon = item.icon
        return (
          <Link
            key={item.clean}
            href={itemHref}
            onClick={onNavigate}
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
  )
}

function PlatformSidebarChrome({
  user,
  pathname,
  href,
  showBrandHeader = true,
  onNavigate
}: {
  user: SessionUser
  pathname: string
  href: (clean: string) => string
  showBrandHeader?: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      {showBrandHeader ? (
        <div className="flex h-topbar shrink-0 items-center border-b border-border px-3">
          <Link
            href={href('/tenants')}
            className="flex items-center no-underline"
            onClick={onNavigate}
          >
            <Image
              src="/images/turinova-logo.png"
              alt="Turinova"
              width={140}
              height={28}
              className="h-7 w-auto"
              priority
            />
          </Link>
        </div>
      ) : null}
      <div className="border-b border-border px-3 py-2">
        <p className="text-hint font-semibold uppercase tracking-wide text-ink-muted">
          Platform ops
        </p>
      </div>
      <PlatformNav pathname={pathname} href={href} onNavigate={onNavigate} />
      <div className="border-t border-border p-3">
        <p className="truncate text-hint text-ink-secondary">{user.email}</p>
        <a
          href={appHomeHref()}
          className="mt-1 text-hint text-ink underline-offset-2 hover:underline"
          onClick={onNavigate}
        >
          ← Turinova app
        </a>
      </div>
    </>
  )
}

export function PlatformShell({
  user,
  children
}: {
  user: SessionUser
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const href = usePlatformHref()
  const [mobileOpen, setMobileOpen] = useState(false)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => closeRef.current?.focus(), 0)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <div className="relative min-h-screen bg-app">
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-sidebar flex-col border-r border-border bg-surface md:flex"
        aria-label="Platform menü"
      >
        <PlatformSidebarChrome user={user} pathname={pathname} href={href} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Menü bezárása"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[min(100%-3rem,280px)] flex-col border-r border-border bg-surface shadow-elev3"
            aria-labelledby={titleId}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex h-topbar shrink-0 items-center justify-between gap-2 border-b border-border px-3">
              <Link
                href={href('/tenants')}
                className="flex items-center no-underline"
                onClick={() => setMobileOpen(false)}
              >
                <Image
                  src="/images/turinova-logo.png"
                  alt="Turinova"
                  width={140}
                  height={28}
                  className="h-7 w-auto"
                  priority
                />
              </Link>
              <p id={titleId} className="sr-only">
                Platform menü
              </p>
              <Button
                ref={closeRef}
                type="button"
                variant="ghost"
                size="sm"
                className="size-10 shrink-0 p-0"
                aria-label="Menü bezárása"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" aria-hidden />
              </Button>
            </div>
            <PlatformSidebarChrome
              user={user}
              pathname={pathname}
              href={href}
              showBrandHeader={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="md:ml-[var(--sidebar-width)]">
        <header className="flex h-topbar items-center gap-2 border-b border-border bg-surface px-3 md:px-6">
          <MobileNavMenuButton onClick={() => setMobileOpen(true)} />
          <p className="text-body font-medium text-ink">
            Cégek · plan · belépés
          </p>
        </header>
        <main className="px-4 pb-6 pt-4 md:px-6">{children}</main>
      </div>
    </div>
  )
}
