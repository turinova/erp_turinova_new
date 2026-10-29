'use client'

import Link from 'next/link'
import { ShoppingCart, Users } from 'lucide-react'

import {
  MonthProgressBar,
  OpenDueRing
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
        <h2 className="text-body font-semibold text-ink">Értékesítés</h2>
        <Link
          href="/ertekesitesek"
          className="ml-auto text-hint text-ink-secondary no-underline hover:underline"
        >
          Összes →
        </Link>
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div
          className={cn(
            'grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:divide-y-0',
            showLapszab ? 'lg:grid-cols-6' : 'lg:grid-cols-4'
          )}
        >
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link
              href="/ertekesitesek"
              className="block px-3 py-3 no-underline hover:bg-subtle"
            >
              <p className="text-hint text-ink-secondary">Mai forgalom</p>
              <p
                className={cn(
                  'mt-1 text-[1.5rem] font-semibold tabular-nums leading-none tracking-tight',
                  sales.todayGross > 0 ? 'text-ink' : 'text-ink-muted'
                )}
              >
                {formatMoneyFt(sales.todayGross)} Ft
              </p>
              <p className="mt-1 text-hint text-ink-muted">
                {sales.todaySaleCount === 0
                  ? 'Ma még nincs eladás'
                  : `${sales.todaySaleCount} eladás ma`}
              </p>
              <div className="mt-2">
                <HomeSalesSparkChart
                  data={sales.last7Days}
                  metric="gross"
                  gradientId="homeSalesSpark"
                />
              </div>
            </Link>
          </div>

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
            label={showLapszab ? 'Eladás kintlévő' : 'Kintlévőség'}
            value={`${formatMoneyFt(sales.openDue)} Ft`}
            href="/ertekesitesek"
            hint={salesPaidHint}
            emphasize={sales.openDue > 0 ? 'warning' : null}
            footer={
              <OpenDueRing
                openDue={sales.openDue}
                openInvoiceGross={sales.openInvoiceGross}
              />
            }
          />

          {lapszabaszat ? (
            <MetricCell
              label="Lapszab. kintlévő"
              value={`${formatMoneyFt(lapszabaszat.openDue)} Ft`}
              href="/megrendelesek"
              hint={lapszabPaidHint}
              emphasize={lapszabaszat.openDue > 0 ? 'warning' : null}
              footer={
                <OpenDueRing
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
      <SalesGlance sales={data.sales} lapszabaszat={data.lapszabaszat} />
      {data.jelenlet ? <JelenletGlance jelenlet={data.jelenlet} /> : null}
    </div>
  )
}
