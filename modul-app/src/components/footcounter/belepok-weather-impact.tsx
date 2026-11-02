import { CloudRain, Snowflake, Sun, Wind } from 'lucide-react'

import {
  FOOTCOUNTER_CHART,
  formatChartCount,
  formatSignedPct
} from '@/lib/footcounter/chart-tokens'
import type { FootcounterWeatherImpact } from '@/lib/footcounter/weather'
import { cn } from '@/lib/utils'

const BUCKET_ICON = {
  dry: Sun,
  rain: CloudRain,
  wind: Wind,
  cold: Snowflake
} as const

export function BelepokWeatherImpact({
  impact,
  monthLabel
}: {
  impact: FootcounterWeatherImpact
  monthLabel: string
}) {
  if (!impact.hasAnyWeather || impact.buckets.length === 0) {
    return null
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-3">
        <p className="text-[13px] font-semibold text-ink">
          Látogatottság időjárás szerint
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink-muted">
          {monthLabel} · csak nyitvatartási napok · eltérés a havi átlagtól (
          {formatChartCount(impact.monthAvgIn)} belépés / nap)
        </p>
        {impact.headline ? (
          <p className="mt-2 text-[13px] font-medium leading-snug text-ink">
            {impact.headline}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        {impact.buckets.map((b) => {
          const Icon = BUCKET_ICON[b.key]
          const negative = b.deltaPct < 0
          const width = Math.min(Math.abs(b.deltaPct) * 3.2, 50)
          const barColor = negative
            ? b.key === 'rain'
              ? FOOTCOUNTER_CHART.rain
              : b.key === 'wind'
                ? FOOTCOUNTER_CHART.wind
                : FOOTCOUNTER_CHART.soft
            : FOOTCOUNTER_CHART.strong

          return (
            <div
              key={b.key}
              className="rounded-lg border border-border bg-surface px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                  <Icon className="size-3.5 text-ink-muted" aria-hidden />
                  {b.label}
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10.5px] font-normal tabular-nums text-ink-muted">
                    {b.days} nap
                  </span>
                </p>
                <p className="text-[12.5px] tabular-nums text-ink-secondary">
                  <span className="font-semibold text-ink">
                    {formatChartCount(b.avgIn)}
                  </span>{' '}
                  / nap
                </p>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="relative h-2.5 min-w-0 flex-1 rounded-sm bg-subtle">
                  <span
                    className="absolute inset-y-[-3px] left-1/2 w-px bg-border-strong"
                    aria-hidden
                  />
                  <div
                    className="absolute top-0 h-full rounded-sm"
                    style={{
                      ...(negative ? { right: '50%' } : { left: '50%' }),
                      width: `${width}%`,
                      backgroundColor: barColor
                    }}
                  />
                </div>
                <span
                  className={cn(
                    'w-[52px] shrink-0 text-right text-[12px] font-semibold tabular-nums',
                    negative ? 'text-ink-secondary' : 'text-ink'
                  )}
                >
                  {formatSignedPct(b.deltaPct)}
                </span>
              </div>

              <p className="mt-1.5 text-[11px] text-ink-muted">{b.hint}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
