import { cn } from '@/lib/utils'
import { FOOTCOUNTER_CHART } from '@/lib/footcounter/chart-tokens'
import type { FootcounterWeekdayBar } from '@/lib/footcounter/chart-types'

export function WeekdayProfileChart({
  rows,
  caption,
  className
}: {
  rows: FootcounterWeekdayBar[]
  caption?: string
  className?: string
}) {
  const maxAvg = Math.max(1, ...rows.map((r) => r.avgIn))
  const open = rows.filter((r) => !r.closed)

  return (
    <div
      className={cn('min-w-0 space-y-1.5', className)}
      role="img"
      aria-label={
        open.length
          ? `Hét napja szerinti átlagos belépésszám: ${open
              .map((r) => `${r.label} ${r.avgIn}`)
              .join(', ')}.`
          : 'Nincs heti profil adat.'
      }
    >
      {rows.map((row) => {
        const pct = maxAvg > 0 ? (row.avgIn / maxAvg) * 100 : 0
        const isTop = row.avgIn === maxAvg && !row.closed && row.avgIn > 0
        return (
          <div key={row.weekday} className="flex items-center gap-3">
            <span
              className={cn(
                'w-[68px] shrink-0 text-right text-[12px]',
                isTop ? 'font-semibold text-ink' : 'text-ink-secondary'
              )}
            >
              {row.label}
            </span>
            <div className="h-6 min-w-0 flex-1 rounded-sm bg-subtle">
              {row.closed ? null : (
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${Math.max(pct, 3)}%`,
                    backgroundColor: isTop
                      ? FOOTCOUNTER_CHART.strong
                      : FOOTCOUNTER_CHART.mid
                  }}
                />
              )}
            </div>
            <span
              className={cn(
                'w-[86px] shrink-0 text-right text-[12px] tabular-nums',
                row.closed
                  ? 'text-ink-disabled'
                  : isTop
                    ? 'font-semibold text-ink'
                    : 'text-ink-secondary'
              )}
            >
              {row.closed ? 'Zárva' : `${row.avgIn} / nap`}
            </span>
          </div>
        )
      })}
      {caption ? (
        <p className="pt-1 text-[11.5px] text-ink-muted">{caption}</p>
      ) : null}
    </div>
  )
}
