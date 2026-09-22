'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
  isUniqueModulePath,
  MARKETING_FOOTER_LINKS,
  MARKETING_NAV_LINKS,
  UNIQUE_MODULES
} from '@/lib/marketing/nav'
import {
  COMPANY_LINE,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164
} from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

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
  const uniqueActive = isUniqueModulePath(activeHref)

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
            <NavLink
              href="/hogyan-mukodik"
              label="Funkciók"
              active={activeHref === '/hogyan-mukodik'}
            />
            <UniqueModulesDesktop active={uniqueActive} />
            <NavLink
              href="/arak"
              label="Árak"
              active={activeHref === '/arak'}
            />
            <NavLink
              href="/kapcsolat"
              label="Kapcsolat"
              active={activeHref === '/kapcsolat'}
            />
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

        <MobileNav activeHref={activeHref} uniqueActive={uniqueActive} />
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
              Ajánlat, készlet és bolt egy helyen — magyar kereskedő-gyártóknak.
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
              aria-label="Lábléc navigáció"
            >
              {MARKETING_FOOTER_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="no-underline underline-offset-2 hover:text-ink hover:underline"
                >
                  {l.title}
                </Link>
              ))}
            </nav>
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

function NavLink({
  href,
  label,
  active
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md px-2.5 py-1.5 text-[13px] font-medium no-underline transition-colors',
        active
          ? 'bg-subtle text-ink'
          : 'text-ink-secondary hover:bg-subtle hover:text-ink'
      )}
    >
      {label}
    </Link>
  )
}

function UniqueModulesDesktop({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        // Hoverre már nyílik — a kattintás csak nyisson, ne csukja vissza.
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
          active || open
            ? 'bg-subtle text-ink'
            : 'text-ink-secondary hover:bg-subtle hover:text-ink'
        )}
      >
        Egyedi modulok
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 w-[320px] pt-1"
        >
          <div className="overflow-hidden rounded-xl border border-border bg-white p-1.5 shadow-lg">
            <Link
              href="/egyedi-modulok"
              role="menuitem"
              className="mb-1 block rounded-lg px-3 py-2 text-[12px] font-medium text-ink-muted no-underline hover:bg-subtle hover:text-ink"
              onClick={() => setOpen(false)}
            >
              Összes egyedi modul
            </Link>
            {UNIQUE_MODULES.map((mod) => {
              const Icon = mod.Icon
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  role="menuitem"
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 no-underline transition-colors hover:bg-subtle"
                  onClick={() => setOpen(false)}
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink">
                    <Icon className="size-4" strokeWidth={2} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-ink">
                      {mod.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-ink-secondary">
                      {mod.blurb}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MobileNav({
  activeHref,
  uniqueActive
}: {
  activeHref?: string
  uniqueActive: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <nav
      className="border-t border-border px-4 py-1.5 md:hidden"
      aria-label="Mobil navigáció"
    >
      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MARKETING_NAV_LINKS.map((item) => (
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
            {item.title}
          </Link>
        ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium',
            uniqueActive || open ? 'bg-subtle text-ink' : 'text-ink-secondary'
          )}
        >
          Egyedi modulok
          <ChevronDown
            className={cn('size-3 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>
      {open ? (
        <div className="mt-1.5 space-y-0.5 rounded-lg border border-border bg-white p-1.5">
          <Link
            href="/egyedi-modulok"
            className="block rounded-md px-2.5 py-1.5 text-[12px] font-medium text-ink-muted no-underline"
            onClick={() => setOpen(false)}
          >
            Összes egyedi modul
          </Link>
          {UNIQUE_MODULES.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={cn(
                'block rounded-md px-2.5 py-1.5 text-[12px] font-medium no-underline',
                activeHref === mod.href
                  ? 'bg-subtle text-ink'
                  : 'text-ink-secondary'
              )}
              onClick={() => setOpen(false)}
            >
              {mod.title}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  )
}
