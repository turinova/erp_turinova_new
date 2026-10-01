import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import {
  HandoverMockup,
  PartnerOrdersMockup,
  PartnerPriceMockup,
  ProductionAssignMockup,
  ScanSmsMockup
} from '@/components/marketing/lapszabaszat-mockups'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import {
  LAPSZABASZAT_AUDIENCE,
  LAPSZABASZAT_AUDIENCE_TITLE,
  LAPSZABASZAT_CTA,
  LAPSZABASZAT_FLOW_INTRO,
  LAPSZABASZAT_FLOW_TITLE,
  LAPSZABASZAT_FOOTER_BLURB,
  LAPSZABASZAT_HANDOVER,
  LAPSZABASZAT_HERO,
  LAPSZABASZAT_PAINS,
  LAPSZABASZAT_PRIVACY,
  LAPSZABASZAT_SCENE,
  LAPSZABASZAT_SCENE_TITLE,
  LAPSZABASZAT_STATS,
  LAPSZABASZAT_STATS_INTRO,
  LAPSZABASZAT_STATS_TITLE,
  LAPSZABASZAT_STEPS
} from '@/lib/marketing/lapszabaszat'
import { WAITLIST_HREF } from '@/lib/marketing/nav'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Lapszabászati modul',
  description:
    'Az asztalos a saját fiókjában adja meg a méreteket, ti a szabásjegyzéket kapjátok. Készre jelölés után SMS. Több mint 500 partner rendel így.'
}

const STEP_MOCKS = [
  PartnerOrdersMockup,
  ProductionAssignMockup,
  ScanSmsMockup
] as const

export default function LapszabaszatPage() {
  return (
    <MarketingShell
      activeHref="/lapszabaszat"
      footerBlurb={LAPSZABASZAT_FOOTER_BLURB}
    >
      <article className="bg-white">
        <header className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-16">
            <div>
              <h1 className="max-w-xl text-[2rem] font-semibold tracking-tight text-ink sm:text-[2.35rem] sm:leading-[1.12]">
                {LAPSZABASZAT_HERO.title}
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-secondary">
                {LAPSZABASZAT_HERO.body}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href={WAITLIST_HREF}
                  className={cn(
                    buttonVariants({ variant: 'primary', size: 'lg' }),
                    'h-11 no-underline'
                  )}
                >
                  {LAPSZABASZAT_HERO.primaryCta}
                </Link>
                <Link
                  href="#igy-mukodik"
                  className={cn(
                    buttonVariants({ variant: 'secondary', size: 'lg' }),
                    'h-11 no-underline'
                  )}
                >
                  {LAPSZABASZAT_HERO.secondaryCta}
                </Link>
              </div>
            </div>
            <PartnerPriceMockup />
          </div>
        </header>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              {LAPSZABASZAT_SCENE_TITLE}
            </h2>
            <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-ink-secondary">
              {LAPSZABASZAT_SCENE}
            </p>

            <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-white">
              {LAPSZABASZAT_PAINS.map((pain) => (
                <li
                  key={pain.before}
                  className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:gap-8 sm:px-5"
                >
                  <p className="text-[13.5px] leading-snug text-ink-secondary">
                    <span className="mb-1 block text-[11px] font-medium text-ink-muted">
                      Előtte
                    </span>
                    {pain.before}
                  </p>
                  <p className="text-[13.5px] leading-snug text-ink">
                    <span className="mb-1 block text-[11px] font-medium text-ink-muted">
                      Utána
                    </span>
                    {pain.after}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-border bg-subtle/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              {LAPSZABASZAT_STATS_TITLE}
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-secondary">
              {LAPSZABASZAT_STATS_INTRO}
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {LAPSZABASZAT_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border bg-white px-4 py-4"
                >
                  <p className="text-[1.65rem] font-semibold tabular-nums tracking-tight text-ink">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-ink">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">{stat.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="igy-mukodik" className="scroll-mt-20 border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              {LAPSZABASZAT_FLOW_TITLE}
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-secondary">
              {LAPSZABASZAT_FLOW_INTRO}
            </p>

            <ol className="mt-8 space-y-12">
              {LAPSZABASZAT_STEPS.map((step, index) => {
                const Mock = STEP_MOCKS[index]
                return (
                  <li
                    key={step.title}
                    className="grid gap-6 lg:grid-cols-2 lg:items-center lg:gap-12"
                  >
                    <div className={index % 2 === 1 ? 'lg:order-2' : undefined}>
                      <h3 className="text-[1.125rem] font-semibold tracking-tight text-ink">
                        {step.title}
                      </h3>
                      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-secondary">
                        {step.body}
                      </p>
                    </div>
                    <div className={index % 2 === 1 ? 'lg:order-1' : undefined}>
                      <Mock />
                    </div>
                  </li>
                )
              })}
            </ol>

            <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:items-center lg:gap-12">
              <div>
                <h3 className="text-[1.125rem] font-semibold tracking-tight text-ink">
                  {LAPSZABASZAT_HANDOVER.title}
                </h3>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-secondary">
                  {LAPSZABASZAT_HANDOVER.body}
                </p>
              </div>
              <HandoverMockup />
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-subtle/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              {LAPSZABASZAT_AUDIENCE_TITLE}
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {LAPSZABASZAT_AUDIENCE.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-white p-5"
                >
                  <div className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-ink"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    <p className="text-[14px] font-semibold leading-snug text-ink">
                      {item.title}
                    </p>
                  </div>
                  <p className="mt-2 pl-[26px] text-[13px] leading-relaxed text-ink-secondary">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-xl border border-border bg-white px-5 py-5">
              <p className="text-[15px] font-semibold tracking-tight text-ink">
                {LAPSZABASZAT_PRIVACY.title}
              </p>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-secondary">
                {LAPSZABASZAT_PRIVACY.body}
              </p>
            </div>
          </div>
        </section>

        <div className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-zinc-950 p-8 md:p-12">
            <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-lg">
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  {LAPSZABASZAT_CTA.title}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                  {LAPSZABASZAT_CTA.body}
                </p>
              </div>
              <Link
                href={WAITLIST_HREF}
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'lg' }),
                  'h-11 shrink-0 no-underline'
                )}
              >
                {LAPSZABASZAT_CTA.button}
                <ArrowRight className="ml-1.5 size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
