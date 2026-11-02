import { CloudRain, Wind } from 'lucide-react'

import { TodayHourlyChart } from '@/components/footcounter/charts/today-hourly-chart'
import { StatusBadge } from '@/components/patterns/status-badge'
import { formatChartCount } from '@/lib/footcounter/chart-tokens'
import type { FootcounterTodayPanelData } from '@/lib/footcounter/chart-types'
import { cn } from '@/lib/utils'

export function BelepokTodayPanel({ data }: { data: FootcounterTodayPanelData }) {
  const pace =
    data.weekdayAvg && data.weekdayAvg > 0
      ? Math.round((data.todayIn / data.weekdayAvg) * 100)
      : null
  const weather = data.weather

  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-ink">Mai forgalom</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">{data.label}</p>
          {weather ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-secondary">
              <span>Ma · {weather.line}</span>
              {weather.rainSignificant ? (
                <StatusBadge tone="warning" variant="soft">
                  <span className="inline-flex items-center gap-1">
                    <CloudRain className="size-3" aria-hidden />
                    Esős nyitás
                  </span>
                </StatusBadge>
              ) : null}
              {weather.windSignificant ? (
                <StatusBadge tone="warning" variant="soft">
                  <span className="inline-flex items-center gap-1">
                    <Wind className="size-3" aria-hidden />
                    Szeles
                  </span>
                </StatusBadge>
              ) : null}
            </p>
          ) : null}
        </div>
        {data.live ? (
          <span className="inline-flex items-center gap-1.5 rounded border border-border bg-subtle px-2 py-0.5 text-[11px] font-medium text-ink">
            <span
              className="size-1.5 animate-pulse rounded-full bg-danger"
              aria-hidden
            />
            Élő
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border-strong bg-subtle px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Belépések ma
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-ink">
            {formatChartCount(data.todayIn)}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-secondary">
            {formatChartCount(data.todayOut)} kilépés
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Becsült létszám
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-ink">
            ~{formatChartCount(data.occupancy)}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-secondary">
            a be- és kilépések különbsége
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Csúcsóra
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-ink">
            {data.peakHour != null
              ? `${String(data.peakHour).padStart(2, '0')}:00`
              : '—'}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-secondary">
            {data.peakHourIn > 0
              ? `${formatChartCount(data.peakHourIn)} belépés ebben az órában`
              : 'Még nincs csúcsóra'}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            {data.weekdayAvgLabel}
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-ink">
            {data.weekdayAvg != null ? formatChartCount(data.weekdayAvg) : '—'}
          </p>
          <p
            className={cn(
              'mt-1.5 text-[11.5px]',
              pace != null && pace >= 100 ? 'text-ink' : 'text-ink-secondary'
            )}
          >
            {pace != null
              ? `A mai belépésszám eddig az átlag ${pace}%-a`
              : 'Még nincs összehasonlítható átlag'}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <TodayHourlyChart
          hourly={data.hourly}
          peakHour={data.peakHour}
          hourLabels={data.hourly.map((h) => String(h.hour))}
        />
      </div>
    </section>
  )
}
