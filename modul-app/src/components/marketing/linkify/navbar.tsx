'use client'

import { PhoneIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

import { AnimationContainer } from '@/components/marketing/linkify/animation-container'
import { MaxWidthWrapper } from '@/components/marketing/linkify/max-width-wrapper'
import { MARKETING_NAV } from '@/lib/marketing/linkify/content'

export function LinkifyNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

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
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 no-underline hover:text-zinc-900"
                >
                  {link.title}
                </Link>
              ))}
              <Link
                href="/egyedi-modulok"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 no-underline hover:text-zinc-900"
              >
                Egyedi modulok
              </Link>
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
              <Link
                href="/egyedi-modulok"
                className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium text-zinc-700 no-underline"
                onClick={() => setMobileOpen(false)}
              >
                Egyedi modulok
              </Link>
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
