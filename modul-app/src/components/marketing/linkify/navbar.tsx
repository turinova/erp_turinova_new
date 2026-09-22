'use client'

import { ChevronDownIcon, PhoneIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { AnimationContainer } from '@/components/marketing/linkify/animation-container'
import { MaxWidthWrapper } from '@/components/marketing/linkify/max-width-wrapper'
import { MARKETING_NAV } from '@/lib/marketing/linkify/content'
import { UNIQUE_MODULES } from '@/lib/marketing/nav'

export function LinkifyNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileModulesOpen, setMobileModulesOpen] = useState(false)

  return (
    <header className="fixed top-0 inset-x-0 z-[99999] h-14 w-full select-none border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
      <AnimationContainer reverse delay={0.1} className="size-full">
        <MaxWidthWrapper className="flex items-center justify-between">
          <div className="flex items-center space-x-10">
            <Link href="/" className="inline-flex items-center no-underline">
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
              className="hidden items-center gap-1 lg:flex"
              aria-label="Fő navigáció"
            >
              {MARKETING_NAV.map((link) => (
                <span key={link.href} className="contents">
                  <Link
                    href={link.href}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 no-underline hover:text-zinc-900"
                  >
                    {link.title}
                  </Link>
                  {link.href === '/hogyan-mukodik' ? (
                    <UniqueModulesMenu />
                  ) : null}
                </span>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-x-3 lg:flex">
            <Link
              href="/ceges-belepes"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 no-underline hover:text-zinc-900"
            >
              Belépés
            </Link>
            <Link
              href="/kapcsolat"
              className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white no-underline"
            >
              Ingyenes konzultáció
              <PhoneIcon className="ml-1.5 size-3.5 fill-orange-500 text-orange-500" />
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex items-center rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
          >
            Menü
          </button>
        </MaxWidthWrapper>
      </AnimationContainer>

      {mobileOpen ? (
        <div className="border-t border-zinc-200 bg-white px-4 py-3 lg:hidden">
          <ul className="space-y-1">
            {MARKETING_NAV.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium text-zinc-700 no-underline"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.title}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                aria-expanded={mobileModulesOpen}
                onClick={() => setMobileModulesOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-medium text-zinc-700"
              >
                Egyedi modulok
                <ChevronDownIcon
                  className={`size-4 transition-transform ${
                    mobileModulesOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>
              {mobileModulesOpen ? (
                <ul className="mb-1 ml-2 space-y-0.5 border-l border-zinc-200 pl-2">
                  <li>
                    <Link
                      href="/egyedi-modulok"
                      className="block rounded-md px-2 py-1.5 text-sm text-zinc-500 no-underline"
                      onClick={() => setMobileOpen(false)}
                    >
                      Összes egyedi modul
                    </Link>
                  </li>
                  {UNIQUE_MODULES.map((mod) => (
                    <li key={mod.href}>
                      <Link
                        href={mod.href}
                        className="block rounded-md px-2 py-1.5 text-sm font-medium text-zinc-700 no-underline"
                        onClick={() => setMobileOpen(false)}
                      >
                        {mod.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
            <li>
              <Link
                href="/ceges-belepes"
                className="block w-full rounded-md px-2 py-2 text-left text-sm text-zinc-600 no-underline"
                onClick={() => setMobileOpen(false)}
              >
                Belépés
              </Link>
            </li>
            <li>
              <Link
                href="/kapcsolat"
                className="block w-full rounded-md bg-zinc-900 px-2 py-2 text-left text-sm font-medium text-white no-underline"
                onClick={() => setMobileOpen(false)}
              >
                Ingyenes konzultáció
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  )
}

/** Egyedi modulok — ugyanaz a menüszerkezet, mint a MarketingShell navban. */
function UniqueModulesMenu() {
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
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          open ? 'text-zinc-900' : 'text-zinc-700 hover:text-zinc-900'
        }`}
      >
        Egyedi modulok
        <ChevronDownIcon
          className={`size-3.5 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 w-[320px] pt-1"
        >
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg">
            <Link
              href="/egyedi-modulok"
              role="menuitem"
              className="mb-1 block rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 no-underline hover:bg-zinc-50 hover:text-zinc-900"
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
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 no-underline transition-colors hover:bg-zinc-50"
                  onClick={() => setOpen(false)}
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
                    <Icon className="size-4" strokeWidth={2} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-zinc-900">
                      {mod.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
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
