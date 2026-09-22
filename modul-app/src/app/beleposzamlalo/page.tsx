import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { AiCameraMediaSlot } from '@/components/marketing/ai-camera-media-slot'
import {
  MonthInsightCard,
  WeatherImpactMockup,
  WeekHourHeatmap
} from '@/components/marketing/beleposzamlalo-mockups'
import { FootcounterDemoTabs } from '@/components/marketing/footcounter-demo-tabs'
import { FootcounterTodayPanel } from '@/components/marketing/footcounter-today-panel'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import {
  BELEPOSZAMLALO_AUDIENCE,
  BELEPOSZAMLALO_CONVERSION,
  BELEPOSZAMLALO_CTA,
  BELEPOSZAMLALO_DEMO,
  BELEPOSZAMLALO_FEATURES,
  BELEPOSZAMLALO_HEATMAP,
  BELEPOSZAMLALO_HERO,
  BELEPOSZAMLALO_HOW,
  BELEPOSZAMLALO_PAINS,
  BELEPOSZAMLALO_STORE_NOTE,
  BELEPOSZAMLALO_WEATHER
} from '@/lib/marketing/beleposzamlalo'
import { formatHufPlain, MARKETING_PRICING } from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Belépőszámláló',
  description:
    'AI-alapú belépőszámláló üzleteknek. Óránkénti látogatottság, napi és havi összehasonlítás, valamint időjárási bontás egy helyen.'
}

const ADDON = MARKETING_PRICING.addons.footcounter
const StoreIcon = BELEPOSZAMLALO_STORE_NOTE.Icon

export default function BeleposzamlaloPage() {
  return (
    <MarketingShell activeHref="/beleposzamlalo">
      <article className="bg-white">
        {/* Hero — szöveg, AI kamera slot és az élő mai panel */}
        <header className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <span className="inline-flex h-7 items-center rounded-full border border-border bg-subtle px-3 text-[12px] font-medium text-ink-secondary">
              {BELEPOSZAMLALO_HERO.eyebrow}
            </span>
            <h1 className="mt-4 max-w-3xl text-[2rem] font-semibold tracking-tight text-ink sm:text-[2.5rem] sm:leading-[1.14]">
              {BELEPOSZAMLALO_HERO.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
              {BELEPOSZAMLALO_HERO.body}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'lg' }),
                  'h-11 no-underline'
                )}
              >
                Bemutatót kérek
              </Link>
              <Link
                href="/arak"
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'lg' }),
                  'h-11 no-underline'
                )}
              >
                Árak
              </Link>
              <span className="text-[13px] text-ink-muted">
                {formatHufPlain(ADDON.priceMonthlyHuf)} + ÁFA havonta az Alap
                csomag mellé.
                {ADDON.hardwareNote ? ` · ${ADDON.hardwareNote}` : null}
              </span>
            </div>

            <div className="mt-10 grid items-start gap-5 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <AiCameraMediaSlot />
              </div>
              <div className="min-w-0 lg:col-span-7">
                <FootcounterTodayPanel />
              </div>
            </div>
          </div>
        </header>

        {/* Mit nem mutat meg az eladási adat */}
        <section className="border-b border-border bg-app">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              Amit ma nem mérsz, később sem tudod visszanézni
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-secondary">
              Az árbevételből nem derül ki, hányan jártak az üzletben. A
              belépésszámot utólag már nem lehet pontosan megállapítani.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BELEPOSZAMLALO_PAINS.map((pain) => {
                const Icon = pain.Icon
                return (
                  <div
                    key={pain.title}
                    className="rounded-xl border border-border bg-subtle p-5"
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-white text-ink">
                      <Icon className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <p className="mt-3.5 text-[14px] font-semibold text-ink">
                      {pain.title}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                      {pain.body}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Három nézet — interaktív demo */}
        <section className="border-b border-border bg-app">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              {BELEPOSZAMLALO_DEMO.title}
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-secondary">
              {BELEPOSZAMLALO_DEMO.body}
            </p>
            <div className="mt-8 grid items-start gap-5 lg:grid-cols-3">
              <FootcounterDemoTabs className="lg:col-span-2" />
              <MonthInsightCard />
            </div>
          </div>
        </section>

        {/* Hét × óra mátrix — a legerősebb nézet */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <span className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
              {BELEPOSZAMLALO_HEATMAP.eyebrow}
            </span>
            <h2 className="mt-2 text-[1.5rem] font-semibold tracking-tight text-ink">
              {BELEPOSZAMLALO_HEATMAP.title}
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-secondary">
              {BELEPOSZAMLALO_HEATMAP.body}
            </p>
            <div className="mt-8 rounded-xl border border-border bg-white p-4 shadow-elev1 sm:p-6">
              <WeekHourHeatmap />
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {BELEPOSZAMLALO_HEATMAP.insights.map((insight) => (
                <li
                  key={insight}
                  className="rounded-xl border border-border bg-subtle px-4 py-3.5 text-[13px] leading-relaxed text-ink-secondary"
                >
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Időjárás */}
        <section className="border-b border-border bg-app">
          <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2 className="max-w-md text-[1.5rem] font-semibold leading-snug tracking-tight text-ink">
                {BELEPOSZAMLALO_WEATHER.title}
              </h2>
              <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink-secondary">
                {BELEPOSZAMLALO_WEATHER.body}
              </p>
              <p className="mt-4 max-w-lg rounded-lg border border-border bg-white px-4 py-3 text-[13.5px] leading-relaxed text-ink">
                {BELEPOSZAMLALO_WEATHER.insight}
              </p>
              <p className="mt-4 max-w-lg text-[12px] leading-relaxed text-ink-muted">
                {BELEPOSZAMLALO_WEATHER.note}
              </p>
            </div>
            <WeatherImpactMockup />
          </div>
        </section>

        {/* Üzleti értelmezés — nem állít automatikus POS-integrációt */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-3xl rounded-xl border border-border bg-subtle p-6 sm:p-8">
              <h2 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-ink">
                {BELEPOSZAMLALO_CONVERSION.title}
              </h2>
              <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-secondary">
                {BELEPOSZAMLALO_CONVERSION.body}
              </p>
            </div>
          </div>
        </section>

        {/* Mit kapsz */}
        <section className="border-b border-border bg-app">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              Mit mutat a rendszer?
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BELEPOSZAMLALO_FEATURES.map((f) => {
                const Icon = f.Icon
                return (
                  <div
                    key={f.title}
                    className="flex items-start gap-3 rounded-xl border border-border bg-white px-4 py-4"
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink">
                      <Icon className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-ink">
                        {f.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
                        {f.body}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Hogyan működik */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              Így kerül be a rendszerbe
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {BELEPOSZAMLALO_HOW.map((step, i) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-border bg-white p-5"
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-md bg-ink text-[12.5px] font-semibold tabular-nums text-white">
                    {i + 1}
                  </span>
                  <p className="mt-3.5 text-[14px] font-semibold text-ink">
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-subtle px-4 py-4">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-ink">
                <StoreIcon className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-ink">
                  {BELEPOSZAMLALO_STORE_NOTE.title}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
                  {BELEPOSZAMLALO_STORE_NOTE.body}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Kinek való */}
        <section className="border-b border-border bg-app">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              Mikor érdemes belépőszámlálót használni?
            </h2>
            <p className="mt-2 max-w-xl text-[14px] text-ink-secondary">
              Olyan üzleteknek készült, ahol az eladások mellett a
              látogatottságot is mérni szeretnék.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {BELEPOSZAMLALO_AUDIENCE.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-white p-5"
                >
                  <p className="text-[14px] font-semibold text-ink">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-white px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-border bg-zinc-950 p-8 md:p-12">
            <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-lg">
                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-[1.75rem]">
                  {BELEPOSZAMLALO_CTA.title}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                  {BELEPOSZAMLALO_CTA.body}
                </p>
                <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                  {BELEPOSZAMLALO_CTA.reassurance.map((item) => (
                    <li
                      key={item}
                      className="inline-flex items-center gap-1.5 text-[13px] text-zinc-300"
                    >
                      <Check
                        className="size-3.5 shrink-0 text-zinc-400"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'md' }),
                  'h-11 shrink-0 border border-white/15 bg-white text-ink no-underline hover:bg-zinc-100'
                )}
              >
                Időpontot kérek
                <ArrowRight className="ml-1.5 size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
