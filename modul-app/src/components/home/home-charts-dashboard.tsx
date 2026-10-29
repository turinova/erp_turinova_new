'use client'

import dynamic from 'next/dynamic'
import { useCallback, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { BacklogMetersCard } from '@/components/home/backlog-meters-card'
import { BelepokHomeCard } from '@/components/home/belepok-home-card'
import { Button } from '@/components/ui/button'
import type {
  BacklogMeters,
  WeeklyCuttingData,
  WeeklyEdgeData,
  YearlyMachineAvgData
} from '@/lib/home/chart-queries'
import type { FootcounterHomeSlim } from '@/lib/footcounter/types'

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
  /** null = Belépők add-on nincs bekapcsolva → widget rejtve */
  footcounter: FootcounterHomeSlim | null
  /** Lapszabászat add-on — heti szabás / élzárás / backlog chartok */
  showLapszabaszatCharts: boolean
}

export function HomeChartsDashboard({
  backlog,
  initialCutting,
  initialEdge,
  yearlyAvg,
  footcounter,
  showLapszabaszatCharts
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
      {footcounter ? <BelepokHomeCard data={footcounter} /> : null}

      {showLapszabaszatCharts ? (
        <BacklogMetersCard
          cuttingM={backlog.cuttingM}
          edgeM={backlog.edgeM}
          orderCount={backlog.orderCount}
          staleOrderCount={backlog.staleOrderCount}
        />
      ) : null}

      {showLapszabaszatCharts ? (
        <>
          <section className="rounded-md border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div>
                <h2 className="text-body font-semibold text-ink">
                  Heti szabás
                </h2>
                <p className="text-hint text-ink-secondary">
                  H–P · {cutting.weekStart} – {cutting.weekEnd}
                  {pending ? ' · frissítés…' : ''}
                  {' · '}gépenként külön oszlop
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
            <div className="px-3 py-3">
              {error ? (
                <p className="mb-2 text-hint text-danger-ink">{error}</p>
              ) : null}
              <WeeklyCuttingChart data={cutting} />
            </div>
          </section>

          <section className="rounded-md border border-border bg-surface">
            <div className="border-b border-border px-3 py-2">
              <h2 className="text-body font-semibold text-ink">Heti élzárás</h2>
              <p className="text-hint text-ink-secondary">
                H–P · {edge.weekStart} – {edge.weekEnd} · kapacitás{' '}
                {edge.capacityPerDayM} m/nap
              </p>
            </div>
            <div className="px-3 py-3">
              <WeeklyEdgeChart data={edge} />
            </div>
          </section>

          <section className="rounded-md border border-border bg-surface">
            <div className="border-b border-border px-3 py-2">
              <h2 className="text-body font-semibold text-ink">
                Gépenkénti átlag — {yearlyAvg.year}
              </h2>
              <p className="text-hint text-ink-secondary">
                Kész napok átlaga, H–P, m/nap
              </p>
            </div>
            <div className="px-3 py-3">
              <YearlyMachineAvgChart data={yearlyAvg} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
