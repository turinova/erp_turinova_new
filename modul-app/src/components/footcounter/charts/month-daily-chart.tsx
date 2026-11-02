import { CloudRain, Wind } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  FOOTCOUNTER_CHART,
  formatChartCount
} from '@/lib/footcounter/chart-tokens'
import type { FootcounterMonthDayBar } from '@/lib/footcounter/chart-types'

function dayTitle(d: FootcounterMonthDayBar): string {
  if (d.closed) return `${d.day}. · zárva`
  const parts = [`${d.day}. · ${formatChartCount(d.inCount)} belépő`]
  if (d.tempMinC != null && d.tempMaxC != null) {
    parts.push(`${Math.round(d.tempMinC)}–${Math.round(d.tempMaxC)} °C`)
  } else if (d.tempMaxC != null) {
    parts.push(`max ${Math.round(d.tempMaxC)} °C`)
  }
  if (d.precipOpenMm != null && d.precipOpenMm > 0) {
    parts.push(
      `${d.precipOpenMm.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} mm`
    )
  }
  if (d.windMaxKmh != null && d.windMaxKmh > 0) {
    parts.push(`${Math.round(d.windMaxKmh)} km/h`)
  }
  return parts.join(' · ')
}

function barColor(d: FootcounterMonthDayBar): string {
  if (d.highlight) return FOOTCOUNTER_CHART.strong
  if (d.rainSignificant) return FOOTCOUNTER_CHART.rain
  if (d.windSignificant) return FOOTCOUNTER_CHART.wind
  return FOOTCOUNTER_CHART.mid
}

export function MonthDailyChart({
  days,
  avgIn,
  ariaLabel,
  className
}: {
  days: FootcounterMonthDayBar[]
  avgIn: number
  ariaLabel?: string
  className?: string
}) {
  const maxIn = Math.max(1, ...days.map((d) => d.inCount))
  const avgPct = maxIn > 0 ? (avgIn / maxIn) * 100 : 0
  const empty = days.every((d) => d.closed || d.inCount <= 0)
  const showWeatherLegend = days.some(
    (d) => !d.closed && (d.rainSignificant || d.windSignificant)
  )

  if (empty) {
    return (
      <p
        className={cn(
          'py-10 text-center text-body text-ink-secondary',
          className
        )}
      >
        Nincs belépő adat erre a hónapra.
      </p>
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div
        className="overflow-x-auto"
        role="img"
        aria-label={ariaLabel ?? 'Napi belépésszám'}
      >
        <div className="min-w-[520px]">
          <div className="relative flex h-[188px] items-end gap-[3px]">
            {avgIn > 0 ? (
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-strong"
                style={{ bottom: `${avgPct}%` }}
              >
                <span className="absolute -top-[15px] right-0 rounded bg-surface px-1 text-[10px] font-medium tabular-nums text-ink-secondary">
                  átlag {formatChartCount(Math.round(avgIn))}
                </span>
              </div>
            ) : null}

            {days.map((d) => {
              const pct = (d.inCount / maxIn) * 100
              if (d.closed) {
                return (
                  <div
                    key={d.day}
                    className="flex h-full min-w-0 flex-1 items-end justify-center"
                    title={dayTitle(d)}
                  >
                    <div className="h-[3px] w-full rounded-sm bg-border" />
                  </div>
                )
              }
              return (
                <div
                  key={d.day}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                  title={dayTitle(d)}
                >
                  {d.highlight ? (
                    <span className="mb-1 text-center text-[10px] font-semibold tabular-nums text-ink">
                      {d.inCount}
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      'w-full rounded-t-sm',
                      d.highlight && 'ring-2 ring-border-strong'
                    )}
                    style={{
                      height: `${Math.max(pct, 2)}%`,
                      backgroundColor: barColor(d)
                    }}
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-1 flex gap-[3px]">
            {days.map((d) => (
              <div
                key={d.day}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
                title={dayTitle(d)}
              >
                <span className="flex h-3 items-center justify-center">
                  {!d.closed && d.rainSignificant ? (
                    <CloudRain
                      className="size-3 text-ink-muted"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : !d.closed && d.windSignificant ? (
                    <Wind
                      className="size-3 text-ink-muted"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-[9.5px] tabular-nums',
                    d.day % 5 === 0 || d.day === 1
                      ? 'text-ink-muted'
                      : 'text-transparent'
                  )}
                >
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: FOOTCOUNTER_CHART.strong }}
            aria-hidden
          />
          Csúcsnap
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: FOOTCOUNTER_CHART.mid }}
            aria-hidden
          />
          Nyitvatartási nap
        </span>
        {showWeatherLegend ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: FOOTCOUNTER_CHART.rain }}
                aria-hidden
              />
              Esős
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: FOOTCOUNTER_CHART.wind }}
                aria-hidden
              />
              Szeles
            </span>
          </>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-3 rounded-sm bg-border" aria-hidden />
          Zárva
        </span>
      </div>
    </div>
  )
}
