import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, ImageIcon, Play } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import {
  LAPSZABASZAT_AUDIENCE,
  LAPSZABASZAT_HERO,
  LAPSZABASZAT_LOOP,
  LAPSZABASZAT_PAINS,
  LAPSZABASZAT_PORTAL,
  LAPSZABASZAT_STATS
} from '@/lib/marketing/lapszabaszat'
import { formatHufNet, MARKETING_PRICING } from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Lapszabászati modul',
  description:
    'Partnerportál, Opti szabás, gyártásütemezés, scan utáni SMS és átvételi bizonylat — a lapszabászati megrendelés teljes köre egy rendszerben.'
}

const ADDON = MARKETING_PRICING.addons.lapszabaszat

export default function LapszabaszatPage() {
  return (
    <MarketingShell activeHref="/lapszabaszat">
      <article>
        <header className="border-b border-border bg-gradient-to-b from-violet-50 via-white to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
            <div>
              <span className="inline-flex h-7 items-center rounded-full border border-violet-200 bg-violet-100 px-3 text-[12px] font-medium text-violet-900">
                {LAPSZABASZAT_HERO.eyebrow}
              </span>
              <h1 className="mt-4 max-w-xl text-[2.1rem] font-semibold tracking-tight text-ink md:text-[2.5rem] md:leading-[1.12]">
                {LAPSZABASZAT_HERO.title}
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-secondary md:text-[16px]">
                {LAPSZABASZAT_HERO.body}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/kapcsolat"
                  className={cn(
                    buttonVariants({ variant: 'primary', size: 'md' }),
                    'no-underline'
                  )}
                >
                  Kérek bemutatót
                </Link>
                <Link
                  href="/egyedi-modulok"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'md' }),
                    'no-underline'
                  )}
                >
                  Egyedi modulok
                </Link>
              </div>
              <p className="mt-4 text-[13px] text-ink-muted">
                Add-on modul az Alap csomag mellé ·{' '}
                {formatHufNet(ADDON.priceMonthlyHuf)}/hó
              </p>
            </div>

            <MediaPlaceholder label={LAPSZABASZAT_HERO.mediaLabel} video />
          </div>
        </header>

        <section className="border-b border-border bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-[1.625rem] font-semibold tracking-tight text-ink md:text-[1.875rem]">
              Ahonnan indultunk
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
              A lapszabászat adta az árbevételünk nagy részét — és ugyanez volt
              a legdrágább folyamatunk is.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {LAPSZABASZAT_PAINS.map((pain) => {
                const Icon = pain.Icon
                return (
                  <div
                    key={pain.title}
                    className="rounded-xl border border-border bg-subtle p-5"
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                      <Icon className="size-5" strokeWidth={2} aria-hidden />
                    </span>
                    <p className="mt-3.5 text-[14.5px] font-semibold text-ink">
                      {pain.title}
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">
                      {pain.body}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-violet-50/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-[1.625rem] font-semibold tracking-tight text-ink md:text-[1.875rem]">
              A zárt kör — megrendeléstől az átvételig
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
              Öt lépés, újrarögzítés nélkül. A modul egyszerre maximalizálja az
              ügyfélélményt és a gyártás optimalizálását.
            </p>

            <ol className="mt-8 space-y-4">
              {LAPSZABASZAT_LOOP.map((step, index) => {
                const Icon = step.Icon
                return (
                  <li
                    key={step.title}
                    className="grid gap-5 rounded-2xl border border-violet-200 bg-white p-5 sm:p-6 lg:grid-cols-[1.1fr_1fr] lg:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-violet-600 text-[13px] font-semibold tabular-nums text-white">
                          {index + 1}
                        </span>
                        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                          <Icon className="size-4" strokeWidth={2} aria-hidden />
                        </span>
                      </div>
                      <p className="mt-3.5 text-[16px] font-semibold text-ink">
                        {step.title}
                      </p>
                      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-secondary">
                        {step.body}
                      </p>
                    </div>
                    <MediaPlaceholder label={step.mediaLabel} compact />
                  </li>
                )
              })}
            </ol>

            <p className="mt-6 text-[15px] font-medium text-ink">
              Így záródik a kör — és ez csak az egyik modul az Optinovában.
            </p>
          </div>
        </section>

        <section className="border-b border-border bg-white">
          <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2 className="text-[1.625rem] font-semibold tracking-tight text-ink md:text-[1.875rem]">
                A megrendelő a hét minden napján dolgozhat
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
                A partnerportál a legnagyobb különbség: nem nektek kell
                módosítani és visszaárazni. A megrendelő 0–24 leadja az
                optimalizált megrendelést a ti rendszerükben, a ti áraitokkal.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {LAPSZABASZAT_PORTAL.map((feature) => {
                  const Icon = feature.Icon
                  return (
                    <div
                      key={feature.title}
                      className="rounded-xl border border-border bg-white px-4 py-3.5"
                    >
                      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                        <Icon className="size-4" strokeWidth={2} aria-hidden />
                      </span>
                      <p className="mt-2.5 text-[13.5px] font-semibold text-ink">
                        {feature.title}
                      </p>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink-secondary">
                        {feature.body}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
            <MediaPlaceholder label="Kép: partnerportál felület (megrendelés lista + Opti)" />
          </div>
        </section>

        <section className="border-b border-border bg-emerald-50/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-[1.625rem] font-semibold tracking-tight text-ink md:text-[1.875rem]">
              Amit a saját üzemünkben mértünk
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
              2025 novemberi indulás óta, a Hírös-Ablak napi működéséből.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {LAPSZABASZAT_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-emerald-200 bg-white px-4 py-5 shadow-sm"
                >
                  <p className="text-[1.75rem] font-semibold tabular-nums tracking-tight text-ink">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-ink">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-muted">{stat.hint}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
              Saját üzem, Hírös-Ablak kalibráció. A megtakarítás becslés, nem
              szerződéses garancia.
            </p>
            <div className="mt-6">
              <Link
                href="/arak"
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'md' }),
                  'no-underline'
                )}
              >
                Árak és modulok
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-[1.625rem] font-semibold tracking-tight text-ink md:text-[1.875rem]">
              Kinek való ez a modul?
            </h2>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {LAPSZABASZAT_AUDIENCE.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] leading-snug text-ink"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-violet-700"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-[14px] leading-relaxed text-ink-secondary">
              Ha nem lapszabászattal dolgozol, a modul nélkül is teljes a
              rendszer: az Alap csomag a bolt, a raktár és az iroda folyamatait
              viszi.{' '}
              <Link href="/hogyan-mukodik" className="text-ink underline">
                Modulok részletesen
              </Link>
              .
            </p>
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
                  Mutatjuk élőben, a saját anyagaitokkal
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                  Végigmegyünk a teljes körön: partner leadja, ti átveszitek,
                  scan, SMS, átvétel.
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
                <ArrowRight className="ml-1.5 size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}

function MediaPlaceholder({
  label,
  video = false,
  compact = false
}: {
  label: string
  video?: boolean
  compact?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-100 to-violet-50 shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-black/5 bg-white/50 px-3 py-2">
        <span className="size-2 rounded-full bg-black/15" />
        <span className="size-2 rounded-full bg-black/15" />
        <span className="size-2 rounded-full bg-black/15" />
        <span className="ml-2 text-[11px] font-medium text-ink-muted">
          {video ? 'Videó helye' : 'Kép helye'}
        </span>
      </div>
      <div
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 px-6',
          compact ? 'min-h-[160px] py-8' : 'aspect-[16/10]'
        )}
      >
        <div className="absolute inset-5 rounded-lg border border-dashed border-black/10 bg-white/40" />
        <span className="relative z-[1] flex size-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
          {video ? (
            <Play className="size-6" strokeWidth={1.75} aria-hidden />
          ) : (
            <ImageIcon className="size-6" strokeWidth={1.75} aria-hidden />
          )}
        </span>
        <p className="relative z-[1] max-w-xs text-center text-[12.5px] font-medium leading-snug text-ink-secondary">
          {label}
        </p>
      </div>
    </div>
  )
}
