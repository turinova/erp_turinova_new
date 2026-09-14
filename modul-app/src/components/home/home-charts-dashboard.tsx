'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { BacklogMetersCard } from '@/components/home/backlog-meters-card'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import type {
  BacklogMeters,
  HomeOrderRow,
  WeeklyCuttingData,
  WeeklyEdgeData,
  YearlyMachineAvgData
} from '@/lib/home/chart-queries'
import {
  QUOTE_STATUS_LABEL,
  quoteStatusTone
} from '@/lib/quotes/status-labels'
import { cn } from '@/lib/utils'

const WeeklyCuttingChart = dynamic(
  () =>
    import('@/components/home/weekly-cutting-chart').then(
      (m) => m.WeeklyCuttingChart
    ),
  {
    ssr: false,
    loading: () => (
      <p className="py-16 text-center text-body text-ink-secondary">Betöltés…</p>
    )
  }
)

const WeeklyEdgeChart = dynamic(
  () =>
    import('@/components/home/weekly-edge-chart').then((m) => m.WeeklyEdgeChart),
  {
    ssr: false,
    loading: () => (
      <p className="py-16 text-center text-body text-ink-secondary">Betöltés…</p>
    )
  }
)

const YearlyMachineAvgChart = dynamic(
  () =>
    import('@/components/home/yearly-machine-avg-chart').then(
      (m) => m.YearlyMachineAvgChart
    ),
  {
    ssr: false,
    loading: () => (
      <p className="py-16 text-center text-body text-ink-secondary">Betöltés…</p>
    )
  }
)

type Props = {
  backlog: BacklogMeters
  initialCutting: WeeklyCuttingData
  initialEdge: WeeklyEdgeData
  yearlyAvg: YearlyMachineAvgData
  orders: HomeOrderRow[]
}

function formatDate(ymd: string | null) {
  if (!ymd) return '—'
  try {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short' }).format(
      new Date(y, m - 1, d)
    )
  } catch {
    return ymd
  }
}

function bucketLabel(bucket: HomeOrderRow['bucket']) {
  if (bucket === 'overdue') return 'Elmaradás'
  if (bucket === 'today') return 'Ma'
  if (bucket === 'upcoming') return 'Később'
  return 'Nincs dátum'
}

function bucketTone(
  bucket: HomeOrderRow['bucket']
): 'danger' | 'warning' | 'info' | 'neutral' {
  if (bucket === 'overdue') return 'danger'
  if (bucket === 'today') return 'warning'
  if (bucket === 'upcoming') return 'info'
  return 'neutral'
}

export function HomeChartsDashboard({
  backlog,
  initialCutting,
  initialEdge,
  yearlyAvg,
  orders
}: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [cutting, setCutting] = useState(initialCutting)
  const [edge, setEdge] = useState(initialEdge)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const loadWeek = useCallback((offset: number) => {
    startTransition(async () => {
      setError(null)
      try {
        const [cRes, eRes] = await Promise.all([
          fetch(`/api/home/weekly-cutting?weekOffset=${offset}`),
          fetch(`/api/home/weekly-edge?weekOffset=${offset}`)
        ])
        if (!cRes.ok || !eRes.ok) {
          throw new Error('Heti adatok betöltése sikertelen.')
        }
        const cJson = (await cRes.json()) as WeeklyCuttingData
        const eJson = (await eRes.json()) as WeeklyEdgeData
        setCutting(cJson)
        setEdge(eJson)
        setWeekOffset(offset)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Hiba')
      }
    })
  }, [])

  return (
    <div className="space-y-5">
      <BacklogMetersCard cuttingM={backlog.cuttingM} edgeM={backlog.edgeM} />

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-body font-semibold text-ink">
              Heti szabás mennyiség
            </h2>
            <p className="text-hint text-ink-secondary">
              {cutting.weekStart} – {cutting.weekEnd}
              {pending ? ' · frissítés…' : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => loadWeek(weekOffset - 1)}
              aria-label="Előző hét"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || weekOffset === 0}
              onClick={() => loadWeek(0)}
            >
              Ma
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => loadWeek(weekOffset + 1)}
              aria-label="Következő hét"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
        {error ? (
          <p className="mb-2 text-hint text-danger-ink">{error}</p>
        ) : null}
        <WeeklyCuttingChart data={cutting} />
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-body font-semibold text-ink">
              Heti élzárás mennyiség
            </h2>
            <p className="text-hint text-ink-secondary">
              {edge.weekStart} – {edge.weekEnd} · kapacitás{' '}
              {edge.capacityPerDayM} m/nap
            </p>
          </div>
        </div>
        <WeeklyEdgeChart data={edge} />
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3">
          <h2 className="text-body font-semibold text-ink">
            Gépenkénti átlag szabás — {yearlyAvg.year}
          </h2>
          <p className="text-hint text-ink-secondary">
            Kész (ready) napok átlaga, H–P, m/nap
          </p>
        </div>
        <YearlyMachineAvgChart data={yearlyAvg} />
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-body font-semibold text-ink">
            Lapszabászati megrendelések
          </h2>
          <Link
            href="/megrendelesek?status=all"
            className="text-hint text-ink-secondary no-underline hover:underline"
          >
            Összes →
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-subtle px-3 py-4 text-body text-ink-secondary">
            Nincs nyitott megrendelés.
          </p>
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Megrendelés</DataTableHeaderCell>
                <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
                <DataTableHeaderCell>Gép</DataTableHeaderCell>
                <DataTableHeaderCell>Dátum</DataTableHeaderCell>
                <DataTableHeaderCell>Státusz</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {orders.map((row) => (
                <DataTableRow
                  key={row.id}
                  className={cn(
                    'hover:bg-subtle',
                    row.bucket === 'overdue' && 'bg-danger-soft/40'
                  )}
                >
                  <DataTableCell>
                    <Link
                      href={`/ajanlatok/${row.id}`}
                      className="font-medium text-ink no-underline hover:underline"
                    >
                      {row.order_number}
                    </Link>
                    <div className="mt-0.5">
                      <StatusBadge tone={bucketTone(row.bucket)}>
                        {bucketLabel(row.bucket)}
                      </StatusBadge>
                    </div>
                  </DataTableCell>
                  <DataTableCell>{row.customer_name}</DataTableCell>
                  <DataTableCell>
                    {row.production_machine_name ?? '—'}
                  </DataTableCell>
                  <DataTableCell className="tabular-nums">
                    {formatDate(row.production_date)}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={quoteStatusTone(row.status)}>
                      {QUOTE_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </section>
    </div>
  )
}
