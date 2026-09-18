'use client'

import Link from 'next/link'
import { ShoppingCart, Users } from 'lucide-react'

import { HomeSalesSparkChart } from '@/components/home/home-sales-spark-chart'
import { MetricCell, MetricRow } from '@/components/home/home-metric-row'
import type {
  HomeJelenletKpis,
  HomeKpiBundle,
  HomeSalesKpis
} from '@/lib/home/kpi-queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

function SalesGlance({ sales }: { sales: HomeSalesKpis }) {
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
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
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
                  : `${sales.todaySaleCount} eladás · 7 nap`}
              </p>
              <div className="mt-2">
                <HomeSalesSparkChart data={sales.last7Days} metric="gross" />
              </div>
            </Link>
          </div>
          <MetricCell
            label="Nyitott ajánlat"
            value={String(sales.openQuoteCount)}
            href="/ertekesitesek/arajanlatok"
            emphasize={sales.openQuoteCount > 0 ? 'warning' : null}
          />
          <MetricCell
            label="Lejáró ajánlat"
            value={String(sales.expiringQuoteCount)}
            href="/ertekesitesek/arajanlatok"
            hint={sales.expiringQuoteCount > 0 ? 'Ma / lejárt' : undefined}
            emphasize={sales.expiringQuoteCount > 0 ? 'danger' : null}
          />
          <MetricCell
            label="Beszerzés"
            value={String(sales.openPurchaseOrderCount)}
            href="/beszallitoi-rendelesek"
            hint={
              sales.overduePurchaseOrderCount > 0
                ? `${sales.overduePurchaseOrderCount} késik`
                : undefined
            }
            emphasize={
              sales.overduePurchaseOrderCount > 0
                ? 'danger'
                : sales.openPurchaseOrderCount > 0
                  ? 'warning'
                  : null
            }
          />
        </div>
      </div>
    </section>
  )
}

function JelenletGlance({ jelenlet }: { jelenlet: HomeJelenletKpis }) {
  const awayTotal =
    jelenlet.vacation + jelenlet.sick + jelenlet.otherAway
  const awayHint =
    jelenlet.awayNames.length > 0
      ? jelenlet.awayNames.join(', ')
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
          hint="Ma a cégnél"
          emphasize={jelenlet.present > 0 ? 'success' : null}
        />
        <MetricCell
          label="Nincs itt"
          value={String(jelenlet.late)}
          href="/jelenlet"
          hint={jelenlet.late > 0 ? 'Elvárt, nincs érkezés' : undefined}
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
      <SalesGlance sales={data.sales} />
      {data.jelenlet ? <JelenletGlance jelenlet={data.jelenlet} /> : null}
    </div>
  )
}
