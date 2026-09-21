'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { ACCENT_STYLES } from '@/lib/marketing/how-it-works'
import {
  OUR_STORY_CHAPTERS,
  type StoryChapter
} from '@/lib/marketing/our-story'
import {
  formatHufNet,
  formatHufPlain
} from '@/lib/marketing/pricing'
import {
  computeRoi,
  formatHoursHu,
  formatMonthsHu,
  HIROS_ROI_INPUTS
} from '@/lib/marketing/roi'
import { cn } from '@/lib/utils'

export function OurStoryJumpNav() {
  const [activeId, setActiveId] = useState(OUR_STORY_CHAPTERS[0]?.id ?? '')

  useEffect(() => {
    const nodes = OUR_STORY_CHAPTERS.map((c) =>
      document.getElementById(c.id)
    ).filter((el): el is HTMLElement => Boolean(el))

    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top)
          )
        const top = visible[0]
        if (top?.target?.id) setActiveId(top.target.id)
      },
      {
        rootMargin: '-30% 0px -55% 0px',
        threshold: [0, 0.25, 0.5]
      }
    )

    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      className="sticky top-[52px] z-30 border-b border-border bg-white/90 backdrop-blur-md"
      aria-label="Fejezetek"
    >
      <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {OUR_STORY_CHAPTERS.map((chapter) => {
          const styles = ACCENT_STYLES[chapter.accent]
          const active = activeId === chapter.id
          const Icon = chapter.Icon
          return (
            <a
              key={chapter.id}
              href={`#${chapter.id}`}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium no-underline transition-colors',
                active ? styles.chipActive : styles.chip
              )}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {chapter.navLabel}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

export function OurStorySections() {
  return (
    <div>
      {OUR_STORY_CHAPTERS.map((chapter, index) => (
        <StorySection key={chapter.id} chapter={chapter} index={index} />
      ))}
    </div>
  )
}

function StorySection({
  chapter,
  index
}: {
  chapter: StoryChapter
  index: number
}) {
  const styles = ACCENT_STYLES[chapter.accent]
  const Icon = chapter.Icon
  const reverse = index % 2 === 1
  const tinted = index % 2 === 1

  return (
    <section
      id={chapter.id}
      className={cn(
        'scroll-mt-[7.5rem] border-b border-border/60',
        tinted ? styles.section : 'bg-white'
      )}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div className={cn(reverse && 'lg:order-2')}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex size-9 items-center justify-center rounded-xl',
                styles.iconWrap
              )}
            >
              <Icon className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <span
              className={cn(
                'inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium tabular-nums',
                styles.badge
              )}
            >
              {chapter.year}
            </span>
            <span className="text-[12px] font-medium text-ink-muted">
              {index + 1} / {OUR_STORY_CHAPTERS.length}
            </span>
          </div>

          <h2 className="mt-4 text-[1.75rem] font-semibold tracking-tight text-ink md:text-[2rem]">
            {chapter.title}
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-secondary">
            {chapter.body}
          </p>

          {chapter.chips && chapter.chips.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {chapter.chips.map((chip) => (
                <span
                  key={chip}
                  className={cn(
                    'inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium',
                    styles.badge
                  )}
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}

          {chapter.bullets && chapter.bullets.length > 0 ? (
            <ul className="mt-5 space-y-2.5">
              {chapter.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 text-[14px] leading-snug text-ink"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      styles.bullet
                    )}
                    aria-hidden
                  />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}

          {chapter.quote ? (
            <blockquote className="mt-6 rounded-xl border border-border bg-white/70 px-4 py-4 text-[14px] leading-relaxed text-ink">
              „{chapter.quote.text}”
              <footer className="mt-2 text-[12px] text-ink-muted">
                — {chapter.quote.attribution}
              </footer>
            </blockquote>
          ) : null}

          {chapter.variant === 'today' ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/hogyan-mukodik"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'md' }),
                  'no-underline'
                )}
              >
                Hogyan működik
              </Link>
              <Link
                href="/arak"
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'md' }),
                  'no-underline'
                )}
              >
                Árak
              </Link>
            </div>
          ) : null}
        </div>

        <div className={cn(reverse && 'lg:order-1')}>
          {chapter.variant === 'stats' ? (
            <StoryStatsPanel />
          ) : (
            <StoryVisualFrame chapter={chapter} />
          )}
        </div>
      </div>

      {chapter.variant === 'stats' ? (
        <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-16">
          <StoryStatsDetail />
        </div>
      ) : null}
    </section>
  )
}

function StoryVisualFrame({ chapter }: { chapter: StoryChapter }) {
  const styles = ACCENT_STYLES[chapter.accent]
  const Icon = chapter.Icon

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border shadow-sm',
        styles.frame
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-black/5 bg-white/50 px-3 py-2">
        <span className="size-2 rounded-full bg-black/15" />
        <span className="size-2 rounded-full bg-black/15" />
        <span className="size-2 rounded-full bg-black/15" />
        <span className="ml-2 h-2 w-20 rounded-full bg-black/10" />
      </div>
      <div className="relative flex aspect-[16/10] flex-col items-center justify-center gap-3 px-6">
        <div className="absolute inset-6 rounded-lg border border-dashed border-black/10 bg-white/40" />
        <span
          className={cn(
            'relative z-[1] flex size-14 items-center justify-center rounded-2xl shadow-sm',
            styles.play
          )}
        >
          <Icon className="size-7" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="relative z-[1] text-center">
          <p className="text-[13px] font-medium tabular-nums text-ink-muted">
            {chapter.year}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-ink">
            {chapter.navLabel}
          </p>
        </div>
      </div>
    </div>
  )
}

function StoryStatsPanel() {
  const result = computeRoi(HIROS_ROI_INPUTS)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <StatCard
        label="Megspórolt idő / hó"
        value={formatHoursHu(result.hoursTotal)}
      />
      <StatCard
        label="Megspórolt érték / hó"
        value={formatHufPlain(result.savingsMonthlyHuf)}
      />
      <StatCard
        label="Nettó nyereség / hó"
        value={formatHufPlain(result.netMonthlyHuf)}
      />
      <StatCard
        label="Megtérülés"
        value={
          result.paybackMonths != null
            ? formatMonthsHu(result.paybackMonths)
            : '—'
        }
      />
    </div>
  )
}

function StoryStatsDetail() {
  const result = computeRoi(HIROS_ROI_INPUTS)

  return (
    <div className="space-y-6 rounded-2xl border border-emerald-200 bg-white p-5 sm:p-6">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">
          Előtte / utána (modellinputok)
        </h3>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[320px] text-left text-[13px]">
            <thead className="border-b border-border bg-emerald-50 text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Tétel</th>
                <th className="px-3 py-2 font-medium">Előtte</th>
                <th className="px-3 py-2 font-medium">Optinovával</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              <tr className="border-b border-border">
                <td className="px-3 py-2">Ajánlat / hó</td>
                <td className="px-3 py-2 tabular-nums" colSpan={2}>
                  {HIROS_ROI_INPUTS.quotesPerMonth}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2">Perc / ajánlat</td>
                <td className="px-3 py-2 tabular-nums">
                  {HIROS_ROI_INPUTS.minutesPerQuoteNow}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {HIROS_ROI_INPUTS.minutesPerQuoteWithOptinova}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2">Gyártás szervezés óra / hét</td>
                <td className="px-3 py-2 tabular-nums">
                  {HIROS_ROI_INPUTS.productionHoursPerWeekNow}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {HIROS_ROI_INPUTS.productionHoursPerWeekWithOptinova}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">SMS / hó</td>
                <td className="px-3 py-2 tabular-nums" colSpan={2}>
                  {HIROS_ROI_INPUTS.smsPerMonth} ·{' '}
                  {HIROS_ROI_INPUTS.minutesPerSmsManual} perc/db kézzel
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-ink-muted">
          Órabér: {formatHufPlain(HIROS_ROI_INPUTS.hourlyWageHuf)}/óra ·
          előfizetés becslés: {formatHufNet(result.subscriptionMonthlyHuf)} ·
          éves időérték: {formatHufPlain(result.savingsYearlyHuf)}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
          Bontás: ajánlat {formatHoursHu(result.hoursQuotes)}, gyártás{' '}
          {formatHoursHu(result.hoursProduction)}, SMS{' '}
          {formatHoursHu(result.hoursSms)} havonta.
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  )
}
