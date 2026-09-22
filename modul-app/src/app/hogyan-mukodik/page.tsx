import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import {
  HowItWorksJumpNav,
  HowItWorksSections
} from '@/components/marketing/how-it-works-sections'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import { FEATURE_PAGE_STEPS } from '@/lib/marketing/how-it-works'
import { UNIQUE_MODULES } from '@/lib/marketing/nav'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Funkciók',
  description:
    'Optinova Alap: készlet, beszerzés, POS, árajánlat, címke, számlázás — plusz SMS és partnerportál. Az egyedi modulok külön oldalon.'
}

export default function FeaturesPage() {
  return (
    <MarketingShell activeHref="/hogyan-mukodik">
      <article>
        <header className="border-b border-border bg-gradient-to-b from-zinc-50 via-white to-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <span className="inline-flex h-7 items-center rounded-full border border-border bg-white px-3 text-[12px] font-medium text-ink-secondary">
              Alap csomag · {FEATURE_PAGE_STEPS.filter((s) => s.package === 'alap').length} fő funkció
            </span>
            <h1 className="mt-4 max-w-2xl text-[2.25rem] font-semibold tracking-tight text-ink md:text-[2.75rem] md:leading-[1.1]">
              A bolt mindennapi funkciói egy rendszerben
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-secondary">
              Készlet, beszerzés, POS, ajánlat, címke, számlázás — ami minden
              kereskedő-gyártónak kell. A lapszabászat, a jelenlét és a
              belépőszámláló külön, egyedi modulként érhető el.
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
                href="/egyedi-modulok"
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'md' }),
                  'no-underline'
                )}
              >
                Egyedi modulok
              </Link>
            </div>
          </div>
        </header>

        <HowItWorksJumpNav />
        <HowItWorksSections />

        <section className="border-t border-border bg-subtle">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              Egyedi modulok
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
              Hardveres vagy iparági specialitások — csak akkor kapcsolod be,
              ha a folyamatodhoz kell.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {UNIQUE_MODULES.map((mod) => {
                const Icon = mod.Icon
                return (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="group flex flex-col rounded-xl border border-border bg-white p-5 no-underline shadow-sm transition-colors hover:bg-white"
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-subtle text-ink">
                      <Icon className="size-5" strokeWidth={2} aria-hidden />
                    </span>
                    <p className="mt-3.5 text-[15px] font-semibold text-ink">
                      {mod.title}
                    </p>
                    <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-secondary">
                      {mod.blurb}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink">
                      Megnézem
                      <ArrowRight
                        className="size-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <div className="bg-white px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-zinc-950 p-8 shadow-[0_24px_60px_-24px_rgba(24,24,27,0.45)] md:p-12">
            <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-lg">
                <span className="inline-flex h-7 items-center rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-zinc-300">
                  Következő lépés
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Megnéznéd élőben?
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                  Húsz perces hívás a ti folyamataitokról. Megmondjuk, melyik
                  funkció érdemes először.
                </p>
              </div>
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'md' }),
                  'h-11 shrink-0 no-underline'
                )}
              >
                Kérek bemutatót
              </Link>
            </div>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
