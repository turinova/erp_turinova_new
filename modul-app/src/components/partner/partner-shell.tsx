'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { PartnerLegalLinks } from '@/components/partner/partner-legal-links'
import { partnerLogoutAction } from '@/lib/auth/partner-actions'
import {
  PARTNER_HOME_PATH,
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

export function PartnerShell({
  email,
  name,
  companyLabel,
  children
}: PartnerShellProps) {
  const pathname = usePathname()
  const mode = partnerHrefModeFromPathname(pathname)
  const homeHref = partnerHref(PARTNER_HOME_PATH, mode)

  return (
    <div className="relative min-h-screen bg-stone-50">
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-sidebar flex-col border-r border-stone-200 bg-white md:flex"
        aria-label="Oldalsáv"
      >
        <div className="flex h-topbar shrink-0 flex-col justify-center gap-0.5 border-b border-stone-200 px-3">
          <Link
            href={homeHref}
            className="flex items-center no-underline"
            aria-label="Optinova Partner kezdőlap"
          >
            <Image
              src="/images/optinova-logo.png"
              alt="Optinova"
              width={140}
              height={28}
              className="h-7 w-auto"
              priority
            />
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Optinova
          </span>
        </div>
        <nav className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {partnerNavItems.map((item) => {
            const href = partnerHref(item.href, mode)
            const active = partnerPathIsActive(pathname, item.href, mode)
            const Icon = item.icon
            const accent = getNavAccentClasses('amber')
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  'group relative flex h-8 items-center gap-2 rounded-md px-2 no-underline transition-colors duration-fast',
                  active
                    ? cn(accent.soft, accent.ink)
                    : 'text-ink-secondary hover:bg-stone-100 hover:text-ink'
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
        <div className="mt-auto shrink-0 border-t border-stone-200 py-2.5">
          <PartnerLegalLinks variant="sidebar" />
        </div>
      </aside>

      <div className="md:ml-[var(--sidebar-width)]">
        <header className="sticky top-0 z-30 flex h-topbar items-center justify-between gap-3 border-b border-stone-200 bg-white/95 px-4 backdrop-blur-sm md:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-body font-medium text-ink">{name}</p>
            <p className="text-hint text-ink-secondary">
              {companyLabel
                ? `Kapcsolt lapszabászat: ${companyLabel}`
                : 'Nincs kapcsolt cég — állítsd be a Beállításokban'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-hint text-ink-secondary lg:inline">
              {email}
            </span>
            <form action={partnerLogoutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Kijelentkezés
              </Button>
            </form>
          </div>
        </header>
        <main className="px-4 pb-8 pt-4 md:px-6">{children}</main>
      </div>
    </div>
  )
}
