'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Search, Star } from 'lucide-react'

import { YearRevenueChart } from '@/components/kiemelt-partnerek/year-revenue-chart'
import { PartnerSpark } from '@/components/kiemelt-partnerek/partner-spark'
import { MetricCell, MetricRow } from '@/components/home/home-metric-row'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  KIEMELT_COPY,
  TREND_DOWN_THRESHOLD,
  TREND_UP_THRESHOLD
} from '@/lib/kiemelt-partnerek/copy'
import {
  filterAndSortPartners,
  formatCompactFt,
  type KiemeltActivity,
  type KiemeltPartnerCard,
  type KiemeltPartnerekPageData,
  type KiemeltSort
} from '@/lib/kiemelt-partnerek/queries'
import { cn } from '@/lib/utils'

type Props = {
  data: KiemeltPartnerekPageData
  initialQ: string
  initialYear: number
  initialSort: KiemeltSort
  initialActivity: KiemeltActivity
}

function lastOrderLabel(days: number | null): string {
  if (days == null) return KIEMELT_COPY.cardNeverOrdered
  if (days === 0) return KIEMELT_COPY.cardLastToday
  return KIEMELT_COPY.cardLastDays(days)
}

function trendUi(pct: number | null): {
  text: string
  tone: 'up' | 'down' | 'flat'
} {
  if (pct == null) return { text: KIEMELT_COPY.cardTrendNone, tone: 'flat' }
  if (pct >= TREND_UP_THRESHOLD)
    return { text: KIEMELT_COPY.cardTrendUp(pct), tone: 'up' }
  if (pct <= TREND_DOWN_THRESHOLD)
    return { text: KIEMELT_COPY.cardTrendDown(pct), tone: 'down' }
  if (pct > 0) return { text: KIEMELT_COPY.cardTrendUp(pct), tone: 'up' }
  if (pct < 0) return { text: KIEMELT_COPY.cardTrendDown(pct), tone: 'down' }
  return { text: KIEMELT_COPY.cardTrendFlat, tone: 'flat' }
}

function cardBadge(p: KiemeltPartnerCard): string | null {
  if (p.isSilent) return KIEMELT_COPY.cardBadgeSilent
  if (p.trendPct != null && p.trendPct <= TREND_DOWN_THRESHOLD) {
    return KIEMELT_COPY.cardBadgeDown
  }
  if (p.trendPct != null && p.trendPct >= TREND_UP_THRESHOLD) {
    return KIEMELT_COPY.cardBadgeUp
  }
  return null
}

export function KiemeltPartnerekClient({
  data,
  initialQ,
  initialYear,
  initialSort,
  initialActivity
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === '') next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const partners = useMemo(
    () =>
      filterAndSortPartners(data.partners, {
        q: initialQ,
        sort: initialSort,
        activity: initialActivity
      }),
    [data.partners, initialQ, initialSort, initialActivity]
  )

  const { portfolio, yearChart, availableYears } = data
  const filtered = Boolean(initialQ) || initialActivity !== 'all'

  return (
    <div className="space-y-3">
      <PageHeader
        title={KIEMELT_COPY.pageTitle}
        description={KIEMELT_COPY.pageDescription(portfolio.favoriteCount)}
        actions={
          <form
            className="relative w-full sm:w-56"
            onSubmit={(e) => {
              e.preventDefault()
              pushParams({ q: qDraft.trim() || null })
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-secondary" />
            <Input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder={KIEMELT_COPY.searchPlaceholder}
              className="h-8 pl-8"
              aria-label={KIEMELT_COPY.searchAria}
            />
          </form>
        }
      />

      <MetricRow
        title={KIEMELT_COPY.overviewTitle}
        href="/ugyfelek"
        hrefLabel={KIEMELT_COPY.overviewLink}
        cols={4}
      >
        <MetricCell
          label={KIEMELT_COPY.metricFavorites}
          value={String(portfolio.favoriteCount)}
          href="/ugyfelek"
          hint={KIEMELT_COPY.metricFavoritesHint}
        />
        <MetricCell
          label={KIEMELT_COPY.metricMonthly}
          value={formatCompactFt(portfolio.sumAvgMonthly)}
          href="/kiemelt-partnerek"
          hint={KIEMELT_COPY.metricMonthlyHint}
        />
        <MetricCell
          label={KIEMELT_COPY.metricSilent}
          value={String(portfolio.silentCount)}
          href="/kiemelt-partnerek?activity=silent"
          hint={KIEMELT_COPY.metricSilentHint}
          emphasize={portfolio.silentCount > 0 ? 'warning' : null}
        />
        <MetricCell
          label={KIEMELT_COPY.metricOpen}
          value={String(portfolio.openCount)}
          href="/megrendelesek"
          hint={KIEMELT_COPY.metricOpenHint}
        />
      </MetricRow>

      <YearRevenueChart
        months={yearChart.months}
        ytdGross={yearChart.ytdGross}
        priorYtdGross={yearChart.priorYtdGross}
        year={yearChart.year}
        availableYears={availableYears}
        onYearChange={(y) => pushParams({ year: String(y) })}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-auto min-w-[11rem]"
          value={initialSort}
          aria-label={KIEMELT_COPY.sortAria}
          onChange={(e) =>
            pushParams({ sort: e.target.value as KiemeltSort })
          }
        >
          <option value="avg_monthly">{KIEMELT_COPY.sortAvg}</option>
          <option value="last_order">{KIEMELT_COPY.sortLast}</option>
          <option value="cutting_90d">{KIEMELT_COPY.sortCutting}</option>
          <option value="name">{KIEMELT_COPY.sortName}</option>
        </Select>
        {(
          [
            ['all', KIEMELT_COPY.filterAll],
            ['active', KIEMELT_COPY.filterActive],
            ['silent', KIEMELT_COPY.filterSilent],
            ['down', KIEMELT_COPY.filterDown]
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={initialActivity === key ? 'secondary' : 'ghost'}
            onClick={() =>
              pushParams({ activity: key === 'all' ? null : key })
            }
          >
            {label}
          </Button>
        ))}
      </div>

      {partners.length === 0 ? (
        <section className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center">
          <Star className="mx-auto size-5 text-ink-secondary" aria-hidden />
          <p className="mt-2 text-body font-medium text-ink">
            {filtered
              ? KIEMELT_COPY.emptyFilteredTitle
              : KIEMELT_COPY.emptyNoneTitle}
          </p>
          <p className="mt-1 text-hint text-ink-secondary">
            {filtered
              ? KIEMELT_COPY.emptyFilteredHint
              : KIEMELT_COPY.emptyNoneHint}
          </p>
          {!filtered ? (
            <Link
              href="/ugyfelek"
              className="mt-3 inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 text-hint font-medium text-ink no-underline hover:bg-subtle"
            >
              {KIEMELT_COPY.emptyCta}
            </Link>
          ) : null}
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {partners.map((p) => {
            const trend = trendUi(p.trendPct)
            const badge = cardBadge(p)
            return (
              <Link
                key={p.id}
                href={`/ugyfelek/${p.id}`}
                className="block rounded-md border border-border bg-surface px-3 py-2.5 no-underline transition-colors hover:bg-subtle"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-body font-semibold text-ink">
                    {p.name}
                  </p>
                  <span
                    className={cn(
                      'shrink-0 text-hint tabular-nums',
                      trend.tone === 'up' && 'text-success-ink',
                      trend.tone === 'down' && 'text-danger-ink',
                      trend.tone === 'flat' && 'text-ink-secondary'
                    )}
                  >
                    {trend.text}
                  </span>
                </div>
                {badge ? (
                  <p
                    className={cn(
                      'mt-0.5 text-hint font-medium',
                      badge === KIEMELT_COPY.cardBadgeSilent &&
                        'text-warning-ink',
                      badge === KIEMELT_COPY.cardBadgeDown && 'text-danger-ink',
                      badge === KIEMELT_COPY.cardBadgeUp && 'text-success-ink'
                    )}
                  >
                    {badge}
                  </p>
                ) : null}
                <p className="mt-0.5 text-[1.125rem] font-semibold tabular-nums leading-tight text-ink">
                  Kb. {formatCompactFt(p.avgMonthlyRevenue)}
                  <span className="text-hint font-normal text-ink-secondary">
                    {' '}
                    {KIEMELT_COPY.cardMonthlySuffix}
                  </span>
                </p>
                <PartnerSpark
                  data={p.spark}
                  gradientId={`kp-spark-${p.id.slice(0, 8)}`}
                  height={28}
                />
                <p className="mt-1 truncate text-hint text-ink-secondary">
                  {lastOrderLabel(p.daysSinceLast)}
                  {' · '}
                  {KIEMELT_COPY.cardOpen(p.openCount)}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
