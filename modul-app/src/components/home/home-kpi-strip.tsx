'use client'

import Link from 'next/link'
import { AlertTriangle, ShoppingCart, Users } from 'lucide-react'

import {
  AgingBar,
  BulletBar,
  MonthProgressBar,
  OpenDueStackBar,
  WeekBars
} from '@/components/home/home-kpi-micro'
import { HomeSalesSparkChart } from '@/components/home/home-sales-spark-chart'
import { MetricCell, MetricRow } from '@/components/home/home-metric-row'
import type {
  HomeJelenletKpis,
  HomeKpiBundle,
  HomeLapszabaszatKpis,
  HomeSalesKpis
} from '@/lib/home/kpi-queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

function compactFt(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} M Ft`
  }
  return `${formatMoneyFt(n)} Ft`
}

function LapszabaszatGlance({ k }: { k: HomeLapszabaszatKpis }) {
  const oldShare = k.ready.total > 0 ? k.ready.old / k.ready.total : 0
  const monthPct =
    k.priorMonthGross > 0
      ? Math.round(((k.monthGross - k.priorMonthGross) / k.priorMonthGross) * 100)
      : null

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 px-0.5">
        <ShoppingCart className="size-3.5 text-ink-muted" aria-hidden />
        <h2 className="text-body font-semibold text-ink">Lapszabászat</h2>
        {k.lateCount > 0 ? (
          <Link
            href="/megrendelesek?focus=late"
            title="Megrendelve / gyártásban, a gyártási nap az előző munkanapnál régebbi"
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-hint font-medium text-warning-ink no-underline hover:underline"
          >
            <AlertTriangle className="size-3" aria-hidden />
            {k.lateCount} csúszásban
            {k.lateNotStarted > 0 ? ` (${k.lateNotStarted} még el sem indult)` : ''} →
          </Link>
        ) : null}
        <Link
          href="/megrendelesek"
          className={cn(
            'text-hint text-ink-secondary no-underline hover:underline',
            k.lateCount > 0 ? 'ml-2' : 'ml-auto'
          )}
        >
          Összes →
        </Link>
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="grid grid-cols-2 divide-x divide-y divide-border lg:grid-cols-4 lg:divide-y-0">
          <MetricCell
            label="Ma felvett"
            value={`${formatMoneyFt(k.todayGross)} Ft`}
            href="/megrendelesek"
            hint={`${k.todayCount} rendelés · múlt ${k.sameDayLastWeekLabel.toLowerCase()}.: ${k.sameDayLastWeekCount} rendelés`}
            hint2="Oszlopok: rendelések száma, 7 nap"
            emphasize={k.todayCount > 0 ? 'success' : null}
            footer={
              <WeekBars
                data={k.last7Days.map((d) => ({ label: d.label, count: d.count }))}
                label={`Elmúlt 7 nap rendeléseinek száma: ${k.last7Days.map((d) => d.count).join(', ')}`}
              />
            }
          />
          <MetricCell
            label="Átvételre vár"
            value={`${k.ready.total} rendelés`}
            href="/megrendelesek?status=ready"
            hint={
              k.ready.total === 0
                ? 'Üres a polc'
                : k.ready.old > 0
                  ? `${k.ready.old} db 7+ napja`
                  : 'Mind 7 napon belüli'
            }
            hint2={k.ready.noSms > 0 ? `${k.ready.noSms} SMS nélkül` : undefined}
            emphasize={oldShare > 0.25 ? 'warning' : null}
            footer={<AgingBar fresh={k.ready.fresh} mid={k.ready.mid} old={k.ready.old} />}
          />
          <MetricCell
            label="Ma kiadva"
            value={`${k.finishedToday} rendelés`}
            href="/megrendelesek?focus=finished_today"
            hint={
              k.finishedToday === 0 ? 'Még nincs kiadás' : `${formatMoneyFt(k.finishedTodayGross)} Ft értékben`
            }
            hint2={k.finishedTypical > 0 ? `ilyenkor átl.: ${k.finishedTypicalByNow} rendelés` : undefined}
            emphasize={
              k.finishedTypicalByNow > 0 && k.finishedToday >= k.finishedTypicalByNow
                ? 'success'
                : null
            }
            footer={<BulletBar value={k.finishedToday} typical={k.finishedTypicalByNow} />}
          />
          <MetricCell
            label="Nem fizetett"
            value={`${formatMoneyFt(k.openDue)} Ft`}
            href="/megrendelesek?focus=unpaid"
            hint={
              k.openOrderCount === 0 ? 'Nincs tartozás' : `${k.openOrderCount} átadott rendelés`
            }
            hint2={
              k.oldestUnpaidDays != null ? `legrégebbi: ${k.oldestUnpaidDays} napja` : undefined
            }
            emphasize={k.openDue > 0 ? 'warning' : null}
          />
        </div>
        <p className="truncate border-t border-border px-3 py-1.5 text-hint tabular-nums text-ink-secondary">
          <span className="font-medium text-ink">Ma befizetve összesen: {formatMoneyFt(k.collectedToday)} Ft</span>
          {' · '}
          {k.monthLabel} eddig: {compactFt(k.monthGross)} ({k.monthCount} rendelés)
          {monthPct != null
            ? ` · ${monthPct >= 0 ? '+' : '−'}${Math.abs(monthPct)}% ${k.priorMonthRangeLabel ? `${k.priorMonthRangeLabel}-hoz képest` : 'az előző hónaphoz'}`
            : ''}
        </p>
      </div>
    </section>
  )
}

function SalesGlance({
  sales,
  lapszabaszat
}: {
  sales: HomeSalesKpis
  lapszabaszat: HomeLapszabaszatKpis | null
}) {
  const showLapszab = lapszabaszat != null
  const salesCollected = Math.max(0, sales.openInvoiceGross - sales.openDue)
  const salesPaidHint =
    sales.openInvoiceCount === 0
      ? 'Nincs eladás kintlévő'
      : sales.openInvoiceGross > 0
        ? `${sales.openInvoiceCount} számla · ${Math.round((salesCollected / sales.openInvoiceGross) * 100)}% fizetve`
        : `${sales.openInvoiceCount} számla`

  const lapszabCollected = lapszabaszat
    ? Math.max(0, lapszabaszat.openOrderGross - lapszabaszat.openDue)
    : 0
  const lapszabPaidHint = !lapszabaszat
    ? undefined
    : lapszabaszat.openOrderCount === 0
      ? 'Nincs lapszabászat kintlévő'
      : lapszabaszat.openOrderGross > 0
        ? `${lapszabaszat.openOrderCount} megrendelés · ${Math.round((lapszabCollected / lapszabaszat.openOrderGross) * 100)}% fizetve`
        : `${lapszabaszat.openOrderCount} megrendelés`

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 px-0.5">
        <ShoppingCart className="size-3.5 text-ink-muted" aria-hidden />
        <h2 className="text-body font-semibold text-ink">
          {showLapszab ? 'Lapszabászat' : 'Értékesítés'}
        </h2>
        <Link
          href={showLapszab ? '/megrendelesek' : '/ertekesitesek'}
          className="ml-auto text-hint text-ink-secondary no-underline hover:underline"
        >
          Összes →
        </Link>
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div
          className={cn(
            'grid grid-cols-2 divide-x divide-y divide-border lg:divide-y-0',
            showLapszab ? 'sm:grid-cols-3' : 'lg:grid-cols-2'
          )}
        >
          {lapszabaszat ? (
            <MetricCell
              label="Mai lapszabászat"
              value={`${formatMoneyFt(lapszabaszat.todayGross)} Ft`}
              href="/megrendelesek"
              hint={
                lapszabaszat.todayCount === 0
                  ? 'Még nincs rendelés'
                  : `${lapszabaszat.todayCount} megrendelés`
              }
              emphasize={lapszabaszat.todayCount > 0 ? 'success' : null}
              footer={
                <HomeSalesSparkChart
                  data={lapszabaszat.last7Days}
                  metric="gross"
                  height={28}
                  strokeWidth={1.25}
                  gradientId="homeLapszabSpark"
                  showTooltip={false}
                />
              }
            />
          ) : null}

          {lapszabaszat ? (
            <MetricCell
              label="Havi lapszabászat"
              value={`${formatMoneyFt(lapszabaszat.monthGross)} Ft`}
              href="/megrendelesek"
              hint={
                lapszabaszat.monthCount === 0
                  ? `${lapszabaszat.monthLabel} · még nincs megrendelés`
                  : `${lapszabaszat.monthLabel} · ${lapszabaszat.monthCount} megrendelés`
              }
              footer={
                <MonthProgressBar
                  current={lapszabaszat.monthGross}
                  prior={lapszabaszat.priorMonthGross}
                />
              }
            />
          ) : (
            <>
              <MetricCell
                label="Havi forgalom"
                value={`${formatMoneyFt(sales.monthGross)} Ft`}
                href="/ertekesitesek"
                hint={
                  sales.monthSaleCount === 0
                    ? sales.monthLabel
                    : `${sales.monthLabel} · ${sales.monthSaleCount} eladás`
                }
                footer={
                  <MonthProgressBar
                    current={sales.monthGross}
                    prior={sales.priorMonthGross}
                  />
                }
              />
              <MetricCell
                label="Kintlévőség"
                value={`${formatMoneyFt(sales.openDue)} Ft`}
                href="/ertekesitesek"
                hint={salesPaidHint}
                emphasize={sales.openDue > 0 ? 'warning' : null}
                footer={
                  <OpenDueStackBar
                    openDue={sales.openDue}
                    openInvoiceGross={sales.openInvoiceGross}
                  />
                }
              />
            </>
          )}

          {lapszabaszat ? (
            <MetricCell
              label="Lapszab. kintlévő"
              value={`${formatMoneyFt(lapszabaszat.openDue)} Ft`}
              href="/megrendelesek"
              hint={lapszabPaidHint}
              emphasize={lapszabaszat.openDue > 0 ? 'warning' : null}
              footer={
                <OpenDueStackBar
                  openDue={lapszabaszat.openDue}
                  openInvoiceGross={lapszabaszat.openOrderGross}
                />
              }
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function compactNameHint(names: string[], total: number): string | undefined {
  if (total <= 0 || names.length === 0) return undefined
  const shown = names.slice(0, 3)
  const extra = total - shown.length
  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ')
}

function JelenletGlance({ jelenlet }: { jelenlet: HomeJelenletKpis }) {
  const awayTotal =
    jelenlet.vacation + jelenlet.sick + jelenlet.otherAway
  const awayHint =
    jelenlet.awayNames.length > 0
      ? jelenlet.awayNames.join(', ')
      : undefined
  const lateHint = compactNameHint(jelenlet.lateNames, jelenlet.late)
  const lateTitle =
    jelenlet.lateNames.length > 0
      ? jelenlet.lateNames.join(', ') +
        (jelenlet.late > jelenlet.lateNames.length
          ? ` (+${jelenlet.late - jelenlet.lateNames.length})`
          : '')
      : undefined

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <Users className="size-3.5 text-ink-muted" aria-hidden />
        <span className="text-hint text-ink-secondary">
          Ma · {jelenlet.present}/{jelenlet.expectedToday || '—'} bent
        </span>
      </div>
      <MetricRow title="Jelenlét" href="/jelenlet" hrefLabel="Naptár →" cols={5}>
        <MetricCell
          label="Bent"
          value={
            jelenlet.expectedToday > 0
              ? `${jelenlet.present}/${jelenlet.expectedToday}`
              : String(jelenlet.present)
          }
          href="/jelenlet"
          hint="Bent van ma"
          emphasize={jelenlet.present > 0 ? 'success' : null}
        />
        <MetricCell
          label="Késik / nincs bent"
          value={String(jelenlet.late)}
          href="/jelenlet"
          hint={lateHint}
          hintTitle={lateTitle}
          emphasize={jelenlet.late > 0 ? 'danger' : null}
        />
        <MetricCell
          label="Szabadság"
          value={String(jelenlet.vacation)}
          href="/jelenlet"
          hint={awayHint && jelenlet.vacation > 0 ? awayHint : undefined}
        />
        <MetricCell
          label="Beteg"
          value={String(jelenlet.sick)}
          href="/jelenlet"
          emphasize={jelenlet.sick > 0 ? 'danger' : null}
        />
        <MetricCell
          label="Hiányzó nap"
          value={String(jelenlet.missingDayCount)}
          href="/dolgozok"
          hint={
            awayTotal > 0 && !jelenlet.vacation
              ? `${awayTotal} távollét ma`
              : undefined
          }
          emphasize={jelenlet.missingDayCount > 0 ? 'warning' : null}
        />
      </MetricRow>
    </div>
  )
}

export function HomeKpiStrip({ data }: { data: HomeKpiBundle }) {
  return (
    <div className="mb-5 space-y-4">
      {data.lapszabaszat ? (
        <LapszabaszatGlance k={data.lapszabaszat} />
      ) : (
        <SalesGlance sales={data.sales} lapszabaszat={null} />
      )}
      {data.jelenlet ? <JelenletGlance jelenlet={data.jelenlet} /> : null}
    </div>
  )
}
