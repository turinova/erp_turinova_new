import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { AttendanceTerminalDemo } from '@/components/marketing/attendance-terminal-demo'
import {
  EmployeesListMockup,
  JelenletCalendarMockup,
  OvertimeFormMockup,
  WorkCalendarMockup
} from '@/components/marketing/jelenlet-mockups'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import {
  JELENLET_AUDIENCE,
  JELENLET_FEATURES,
  JELENLET_HERO,
  JELENLET_PAINS,
  JELENLET_PDF_HIGHLIGHT,
  JELENLET_TERMINAL
} from '@/lib/marketing/jelenlet'
import { formatHufPlain, MARKETING_PRICING } from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Jelenléti ív',
  description:
    'Havi jelenlét-naptár, szabadság és betegszabadság, hivatalos PDF jelenléti ív céglogóval. Hardver nélkül is működik; opcionális chipkártyás beléptető.'
}

const ADDON = MARKETING_PRICING.addons.jelenlet

export default function JelenletiIvPage() {
  return (
    <MarketingShell activeHref="/jelenleti-iv">
      <article className="bg-white">
        <header className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <span className="inline-flex h-7 items-center rounded-full border border-border bg-subtle px-3 text-[12px] font-medium text-ink-secondary">
              {JELENLET_HERO.eyebrow}
            </span>
            <h1 className="mt-4 max-w-2xl text-[2rem] font-semibold tracking-tight text-ink sm:text-[2.5rem] sm:leading-[1.14]">
              {JELENLET_HERO.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
              {JELENLET_HERO.body}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'lg' }),
                  'h-11 no-underline'
                )}
              >
                Kérek bemutatót
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
                {formatHufPlain(ADDON.priceMonthlyHuf)} + ÁFA / hó az Alap
                csomag mellé
              </span>
            </div>
            <div className="mt-10">
              <JelenletCalendarMockup />
            </div>
          </div>
        </header>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              Miért szokott elcsúszni
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {JELENLET_PAINS.map((pain) => {
                const Icon = pain.Icon
                return (
                  <div
                    key={pain.title}
                    className="rounded-xl border border-border bg-subtle/50 p-5"
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

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              Mit kapsz a modulban
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {JELENLET_FEATURES.map((f) => {
                const Icon = f.Icon
                return (
                  <div
                    key={f.title}
                    className="rounded-xl border border-border bg-white p-5"
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Icon className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <p className="mt-3.5 text-[14px] font-semibold text-ink">
                      {f.title}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                      {f.body}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-subtle/40">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2 className="max-w-lg text-[1.5rem] font-semibold leading-snug tracking-tight text-ink">
                {JELENLET_PDF_HIGHLIGHT.title}
              </h2>
              <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink-secondary">
                {JELENLET_PDF_HIGHLIGHT.body}
              </p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {JELENLET_PDF_HIGHLIGHT.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-[13.5px] text-ink"
                  >
                    <Check
                      className="mt-0.5 size-3.5 shrink-0 text-ink"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <EmployeesListMockup />
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
              <div>
                <h3 className="text-[1.125rem] font-semibold tracking-tight text-ink">
                  Ünnepek és áthelyezett napok
                </h3>
                <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-secondary">
                  A magyar nemzeti ünnepeket egy gombbal betöltöd az évre. A
                  céges szünnapot és a ledolgozós szombatot magad veszed fel —
                  mindkettő minden dolgozóra érvényes a naptáron és a hivatalos
                  íven is.
                </p>
                <div className="mt-6">
                  <WorkCalendarMockup />
                </div>
              </div>
              <div>
                <h3 className="text-[1.125rem] font-semibold tracking-tight text-ink">
                  Túlóra-szabály dolgozónként
                </h3>
                <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-secondary">
                  Megadod, hány perc után indul a túlóra a műszak vége után, és
                  hogy egy napra mennyi az elszámolható maximum. Akinél nem
                  kell, ott egy kapcsolóval kikapcsolod. A műszak és az ebédidő
                  is dolgozónként állítható.
                </p>
                <div className="mt-6">
                  <OvertimeFormMockup />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2 className="max-w-md text-[1.5rem] font-semibold leading-snug tracking-tight text-ink">
                {JELENLET_TERMINAL.title}
              </h2>
              <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink-secondary">
                {JELENLET_TERMINAL.body}
              </p>
              <ul className="mt-6 grid gap-2.5">
                {JELENLET_TERMINAL.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-[13.5px] text-ink"
                  >
                    <Check
                      className="mt-0.5 size-3.5 shrink-0 text-ink"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <AttendanceTerminalDemo className="lg:justify-self-end" />
          </div>
        </section>

        <section className="border-b border-border bg-subtle/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">
              Kinek való
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-secondary">
              Ha az alábbiakból kettő is igaz a cégedre, ez a modul neked szól.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {JELENLET_AUDIENCE.map((item) => (
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
          </div>
        </section>

        <div className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-zinc-950 p-8 md:p-12">
            <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-lg">
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  Megmutatjuk a naptárt élőben
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                  Végigmegyünk egy hónapon: rögzítés, szabadság, hó végi PDF.
                  Chipkártyás beléptetés is szóba jöhet, ha kell.
                </p>
              </div>
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'lg' }),
                  'h-11 shrink-0 no-underline'
                )}
              >
                Kérek bemutatót
                <ArrowRight className="ml-1.5 size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
