import type { Metadata } from 'next'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import {
  OurStoryJumpNav,
  OurStorySections
} from '@/components/marketing/our-story-sections'
import { buttonVariants } from '@/components/ui/button'
import { OUR_STORY_CHAPTERS } from '@/lib/marketing/our-story'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'A történetünk',
  description:
    'Hírös Ablakból nőtt az Optinova: hogyan lett a saját gyártásból bolt-, műhely- és partnerfolyamat egy rendszerben.'
}

export default function OurStoryPage() {
  return (
    <MarketingShell activeHref="/a-tortenetunk">
      <article>
        <header className="relative overflow-hidden border-b border-orange-100 bg-gradient-to-b from-orange-50 via-amber-50/40 to-white">
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-orange-200/40 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-1/4 size-56 rounded-full bg-violet-200/25 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <span className="inline-flex h-7 items-center rounded-full border border-orange-200 bg-orange-100/80 px-3 text-[12px] font-medium text-orange-900">
              Hírös Ablak → Optinova · {OUR_STORY_CHAPTERS.length} fejezet
            </span>
            <h1 className="mt-4 max-w-2xl text-[2.25rem] font-semibold tracking-tight text-ink md:text-[2.75rem] md:leading-[1.1]">
              Nem szoftvercégként indultunk
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-secondary">
              Ablakos gyártóként naponta ütköztünk abba, hogy az ajánlat, a
              készlet és a műhely három külön világ. Az Optinova abból nőtt ki,
              amit magunknak kellett megoldani — utána más gyártóknak is.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'md' }),
                  'no-underline'
                )}
              >
                Ingyenes konzultáció
              </Link>
              <Link
                href="/hogyan-mukodik"
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'md' }),
                  'no-underline'
                )}
              >
                Hogyan működik
              </Link>
            </div>
          </div>
        </header>

        <OurStoryJumpNav />
        <OurStorySections />

        <div className="bg-white px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-zinc-950 p-8 shadow-[0_24px_60px_-24px_rgba(24,24,27,0.45)] md:p-12">
            <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-lg">
                <span className="inline-flex h-7 items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 text-xs font-medium uppercase tracking-wide text-orange-400">
                  Ingyenes konzultáció
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Beszéljük át a ti folyamataitokat
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                  Ugyanabból a történetből indulunk: hol megy el az idő, és melyik
                  modul váltja ki először.
                </p>
              </div>
              <Link
                href="/kapcsolat"
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-orange-500 px-6 text-[15px] font-medium text-white no-underline transition-colors hover:bg-orange-600"
              >
                Kérem a visszahívást
              </Link>
            </div>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
