import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { MARKETING_NAV } from '@/lib/marketing/linkify/content'
import {
  COMPANY_LINE,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164
} from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

const NAV = MARKETING_NAV.map((item) => ({
  href: item.href,
  label: item.title
}))

const LEGAL = [
  { href: '/aszf', label: 'ÁSZF' },
  { href: '/adatkezelesi-tajekoztato', label: 'Adatkezelés' },
  { href: '/impresszum', label: 'Impresszum' }
] as const

export function MarketingShell({
  children,
  activeHref
}: {
  children: ReactNode
  activeHref?: string
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[52px] max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex shrink-0 no-underline transition-opacity hover:opacity-80"
          >
            <Image
              src="/images/optinova-logo.png"
              alt="Optinova"
              width={132}
              height={28}
              className="h-7 w-auto"
              priority
            />
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Fő navigáció"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-[13px] font-medium no-underline transition-colors',
                  activeHref === item.href
                    ? 'bg-subtle text-ink'
                    : 'text-ink-secondary hover:bg-subtle hover:text-ink'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/ceges-belepes"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'md' }),
                'hidden no-underline sm:inline-flex'
              )}
            >
              Belépés
            </Link>
            <Link
              href="/kapcsolat"
              className={cn(
                buttonVariants({ variant: 'primary', size: 'md' }),
                'no-underline'
              )}
            >
              Ingyenes konzultáció
            </Link>
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1.5 md:hidden"
          aria-label="Mobil navigáció"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1 text-[12px] font-medium no-underline',
                activeHref === item.href
                  ? 'bg-subtle text-ink'
                  : 'text-ink-secondary'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Image
              src="/images/optinova-logo.png"
              alt="Optinova"
              width={120}
              height={24}
              className="h-6 w-auto"
            />
            <p className="max-w-xs text-[13px] leading-relaxed text-ink-secondary">
              Ajánlat, gyártás és partnerfolyamat egy helyen — magyar
              gyártóknak.
            </p>
            <p className="text-[12px] text-ink-muted">{COMPANY_LINE}</p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
              <a
                href={`tel:${SUPPORT_PHONE_E164}`}
                className="text-ink-secondary no-underline hover:text-ink"
              >
                {SUPPORT_PHONE_DISPLAY}
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-ink-secondary no-underline hover:text-ink"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
            <nav
              className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-muted"
              aria-label="Jogi"
            >
              {LEGAL.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="no-underline underline-offset-2 hover:text-ink hover:underline"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
