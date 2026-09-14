'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { partnerLogoutAction } from '@/lib/auth/partner-actions'
import { PARTNER_HOME_PATH } from '@/lib/auth/surface'
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

  return (
    <div className="relative min-h-screen bg-app">
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-sidebar flex-col border-r border-border bg-surface md:flex"
        aria-label="Partner oldalsáv"
      >
        <div className="flex h-topbar shrink-0 items-center border-b border-border px-3">
          <Link
            href={PARTNER_HOME_PATH}
            className="flex items-center no-underline"
            aria-label="Optinova kezdőlap"
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
        </div>
        <nav className="mt-3 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
          {partnerNavItems.map((item) => {
            const active = partnerPathIsActive(pathname, item.href)
            const Icon = item.icon
            const accent = getNavAccentClasses('slate')
            return (
              <Link
                key={item.href}
                href={item.href}
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
        <div className="border-t border-border px-3 py-2">
          <p className="text-hint text-ink-muted">Asztalos felület</p>
        </div>
      </aside>

      <div className="md:ml-[var(--sidebar-width)]">
        <header className="sticky top-0 z-30 flex h-topbar items-center justify-between gap-3 border-b border-border bg-surface px-4 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-body font-medium text-ink">{name}</p>
            <p className="text-hint text-ink-secondary">
              {companyLabel
                ? `Kapcsolt cég: ${companyLabel}`
                : 'Nincs kapcsolt cég'}
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

        {/* Mobile nav */}
        <nav
          className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-1.5 md:hidden"
          aria-label="Partner menü"
        >
          {partnerNavItems.map((item) => {
            const active = partnerPathIsActive(pathname, item.href)
            const Icon = item.icon
            const accent = getNavAccentClasses('slate')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-hint no-underline',
                  active
                    ? 'bg-subtle font-medium text-ink'
                    : 'text-ink-secondary'
                )}
              >
                <Icon
                  className={cn(
                    'size-3.5 shrink-0',
                    active ? accent.icon : accent.iconMuted
                  )}
                  aria-hidden
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <main className="px-4 pb-6 pt-4 md:px-6">{children}</main>
      </div>
    </div>
  )
}
