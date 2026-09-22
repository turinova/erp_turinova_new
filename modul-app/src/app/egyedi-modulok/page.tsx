import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import { UNIQUE_MODULES } from '@/lib/marketing/nav'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Egyedi modulok',
  description:
    'Lapszabászati gyártás, jelenléti ív és AI belépőszámláló — csak akkor kapcsolod be, ha a folyamatodhoz kell.'
}

export default function UniqueModulesPage() {
  return (
    <MarketingShell activeHref="/egyedi-modulok">
      <article>
        <header className="border-b border-border bg-gradient-to-b from-zinc-50 via-white to-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <span className="inline-flex h-7 items-center rounded-full border border-border bg-white px-3 text-[12px] font-medium text-ink-secondary">
              Add-on · hardver opcióval
            </span>
            <h1 className="mt-4 max-w-2xl text-[2.25rem] font-semibold tracking-tight text-ink md:text-[2.5rem] md:leading-[1.12]">
              Egyedi modulok — ha a folyamatod többet kér
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-secondary">
              Az Alap a bolt magja. Ezek a modulok iparági vagy hardveres
              specialitások — külön oldalon, részletesen.
            </p>
          </div>
        </header>

        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-3">
            {UNIQUE_MODULES.map((mod) => {
              const Icon = mod.Icon
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="group flex flex-col rounded-2xl border border-border bg-white p-6 no-underline shadow-sm transition-colors hover:bg-subtle"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-subtle text-ink">
                    <Icon className="size-5" strokeWidth={2} aria-hidden />
                  </span>
                  <p className="mt-4 text-[1.125rem] font-semibold text-ink">
                    {mod.title}
                  </p>
                  <p className="mt-2 flex-1 text-[14px] leading-relaxed text-ink-secondary">
                    {mod.blurb}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                    Részletek
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <div className="border-t border-border bg-subtle px-4 py-12 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-[14px] text-ink-secondary">
              Az Alap funkciókat a Funkciók oldalon találod.
            </p>
            <Link
              href="/hogyan-mukodik"
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'md' }),
                'no-underline'
              )}
            >
              Funkciók
            </Link>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
