'use client'

import { ChevronDown, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { PartnerLegalLinks } from '@/components/partner/partner-legal-links'
import { MobileNavMenuButton } from '@/components/shell/app-sidebar'
import { Button } from '@/components/ui/button'
import { partnerLogoutAction } from '@/lib/auth/partner-actions'
import {
  PARTNER_HOME_PATH,
  PARTNER_SETTINGS_PATH,
  partnerHref,
  partnerHrefModeFromPathname
} from '@/lib/auth/surface'
import { getNavAccentClasses } from '@/lib/nav-accent'
import { partnerNavItems, partnerPathIsActive } from '@/lib/partner/nav'
import { cn } from '@/lib/utils'

type PartnerShellProps = {
  email: string
  name: string
  companyLabel: string | null
  children: React.ReactNode
}

function initialsFromLabel(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  const local = label.split('@')[0] || '?'
  const chunks = local.split(/[._-]/).filter(Boolean)
  if (chunks.length >= 2) {
    return `${chunks[0]![0] ?? ''}${chunks[1]![0] ?? ''}`.toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export function PartnerShell({
  email,
  name,
  companyLabel,
  children
}: PartnerShellProps) {
  const pathname = usePathname()
  const mode = partnerHrefModeFromPathname(pathname)
  const homeHref = partnerHref(PARTNER_HOME_PATH, mode)
  const settingsHref = partnerHref(PARTNER_SETTINGS_PATH, mode)
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
        aria-label="Oldalsáv"
      >
        <PartnerSidebarChrome
          pathname={pathname}
          mode={mode}
          homeHref={homeHref}
        />
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
                href={homeHref}
                className="flex items-center no-underline"
                aria-label="Turinova Partner kezdőlap"
                onClick={() => setMobileOpen(false)}
              >
                <Image
                  src="/images/turinova-logo.png"
                  alt="Turinova"
                  width={160}
                  height={32}
                  className="h-8 w-auto"
                  priority
                />
              </Link>
              <p id={titleId} className="sr-only">
                Partner menü
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
            <PartnerSidebarChrome
              pathname={pathname}
              mode={mode}
              homeHref={homeHref}
              showBrandHeader={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="md:ml-[var(--sidebar-width)]">
        <header className="sticky top-0 z-30 flex h-topbar items-center justify-between gap-3 border-b border-border bg-surface px-3 md:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <MobileNavMenuButton onClick={() => setMobileOpen(true)} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink">
                {companyLabel ?? 'Nincs kapcsolt cég'}
              </p>
              <p className="truncate text-hint text-ink-secondary">
                {companyLabel
                  ? name
                  : 'Állítsd be a Beállításokban'}
              </p>
            </div>
          </div>

          <details className="relative shrink-0">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-subtle [&::-webkit-details-marker]:hidden">
              <span
                className="flex size-6 items-center justify-center rounded-full border border-border bg-subtle text-[10px] font-semibold text-ink"
                aria-hidden
              >
                {initialsFromLabel(name || email)}
              </span>
              <span className="hidden max-w-[160px] truncate text-[12.5px] text-ink-secondary sm:inline">
                {name}
              </span>
              <ChevronDown
                className="size-3.5 text-ink-secondary"
                aria-hidden
              />
            </summary>
            <div className="absolute right-0 mt-1 w-52 rounded-md border border-border bg-surface p-1 shadow-elev2">
              <p className="truncate px-2.5 py-1.5 text-hint text-ink-secondary">
                {email}
              </p>
              <p className="px-2.5 pb-1.5 text-hint text-ink-muted">Partner</p>
              <Link
                href={settingsHref}
                className="block rounded-md px-2.5 py-1.5 text-[12.5px] text-ink no-underline hover:bg-subtle"
              >
                Beállítások
              </Link>
              <form action={partnerLogoutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal"
                >
                  Kijelentkezés
                </Button>
              </form>
            </div>
          </details>
        </header>
        <main className="px-4 pb-6 pt-4 md:px-6">{children}</main>
      </div>
    </div>
  )
}

function PartnerSidebarChrome({
  pathname,
  mode,
  homeHref,
  showBrandHeader = true,
  onNavigate
}: {
  pathname: string
  mode: ReturnType<typeof partnerHrefModeFromPathname>
  homeHref: string
  showBrandHeader?: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      {showBrandHeader ? (
        <>
          <div className="flex h-topbar shrink-0 items-center border-b border-border px-3">
            <Link
              href={homeHref}
              className="flex items-center no-underline"
              aria-label="Turinova Partner kezdőlap"
              onClick={onNavigate}
            >
              <Image
                src="/images/turinova-logo.png"
                alt="Turinova"
                width={160}
                height={32}
                className="h-8 w-auto"
                priority
              />
            </Link>
          </div>
          <div className="border-b border-border px-3 py-2">
            <p className="text-hint font-semibold text-ink-muted">Partner</p>
          </div>
        </>
      ) : (
        <div className="border-b border-border px-3 py-2">
          <p className="text-hint font-semibold text-ink-muted">Partner</p>
        </div>
      )}

      <nav className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {partnerNavItems.map((item) => {
          const href = partnerHref(item.href, mode)
          const active = partnerPathIsActive(pathname, item.href, mode)
          const Icon = item.icon
          const accent = getNavAccentClasses(item.accent)
          return (
            <Link
              key={item.href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'group relative flex h-8 items-center gap-2 rounded-md px-2 no-underline transition-colors duration-fast',
                active
                  ? cn(accent.soft, accent.ink)
                  : 'text-ink-secondary hover:bg-subtle hover:text-ink'
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active ? (
                <span
                  className={cn(
                    'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-sm',
                    accent.bar
                  )}
                  aria-hidden
                />
              ) : null}
              <Icon
                className={cn(
                  'size-4 shrink-0',
                  active ? accent.icon : accent.iconMuted
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {item.label}
              </span>
              {item.comingSoon ? (
                <span className="shrink-0 text-[10px] font-normal text-ink-muted">
                  Hamarosan
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto shrink-0 border-t border-border py-2.5">
        <PartnerLegalLinks variant="sidebar" />
      </div>
    </>
  )
}
