import { cn } from '@/lib/utils'
import { FOOTCOUNTER_HOUR_LABELS } from '@/lib/footcounter/chart-tokens'
import type { FootcounterTodayHourBar } from '@/lib/footcounter/chart-types'

export function TodayHourlyChart({
  hourly,
  peakHour,
  hourLabels = FOOTCOUNTER_HOUR_LABELS,
  className
}: {
  hourly: FootcounterTodayHourBar[]
  peakHour?: number | null
  hourLabels?: string[]
  className?: string
}) {
  const max = Math.max(1, ...hourly.map((h) => Math.max(h.inCount, h.outCount)))
  const resolvedPeak =
    peakHour ??
    hourly.reduce(
      (best, h) => (h.inCount > best.inCount ? h : best),
      hourly[0] ?? { hour: 0, inCount: 0, outCount: 0 }
    ).hour

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-end gap-[3px] sm:gap-1.5">
        {hourly.map((h) => {
          const inPct = max > 0 ? (h.inCount / max) * 100 : 0
          const outPct = max > 0 ? (h.outCount / max) * 100 : 0
          return (
            <div
              key={h.hour}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  'text-[10px] tabular-nums leading-none',
                  h.pending
                    ? 'text-transparent'
                    : h.hour === resolvedPeak
                      ? 'font-semibold text-ink'
                      : 'text-ink-muted'
                )}
              >
                {h.pending ? '0' : h.inCount}
              </span>
              <div className="flex h-[104px] w-full items-end justify-center gap-[2px] sm:h-[124px]">
                {h.pending ? (
                  <div className="h-3 w-full rounded-t-sm border border-dashed border-border" />
                ) : (
                  <>
                    <div
                      className={cn(
                        'w-1/2 rounded-t-sm',
                        h.running
                          ? 'bg-[repeating-linear-gradient(135deg,#18181b_0_3px,#52525b_3px_6px)]'
                          : 'bg-ink'
                      )}
                      style={{ height: `${Math.max(inPct, 2)}%` }}
                    />
                    <div
                      className="w-1/2 rounded-t-sm bg-border"
                      style={{ height: `${Math.max(outPct, 2)}%` }}
                    />
                  </>
                )}
              </div>
              <span className="text-[10px] tabular-nums text-ink-muted">
                {h.hour}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-ink" aria-hidden />
          Belépés
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-border" aria-hidden />
          Kilépő
        </span>
        <span className="text-ink-muted">
          Óra · {hourLabels[0]}–{hourLabels.at(-1)}
        </span>
      </div>
    </div>
  )
}
