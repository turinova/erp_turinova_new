import { cn } from '@/lib/utils'
import {
  FOOTCOUNTER_HOUR_LABELS,
  heatCellStyle
} from '@/lib/footcounter/chart-tokens'
import type { FootcounterHeatmapRow } from '@/lib/footcounter/chart-types'

export function WeekHourHeatmap({
  rows,
  hourLabels = FOOTCOUNTER_HOUR_LABELS,
  className
}: {
  rows: FootcounterHeatmapRow[]
  hourLabels?: string[]
  className?: string
}) {
  const max = Math.max(
    1,
    ...rows.flatMap((r) => r.cells.map((c) => (c.closed ? 0 : c.value)))
  )

  let peak = { weekday: -1, hour: -1, value: 0, label: '' }
  for (const row of rows) {
    for (const cell of row.cells) {
      if (!cell.closed && cell.value > peak.value) {
        peak = {
          weekday: row.weekday,
          hour: cell.hour,
          value: cell.value,
          label: row.label
        }
      }
    }
  }

  const empty = rows.every((r) => r.closed || r.total <= 0)

  if (empty) {
    return (
      <p
        className={cn(
          'py-10 text-center text-body text-ink-secondary',
          className
        )}
      >
        Nincs heatmap adat erre a hónapra.
      </p>
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div className="overflow-x-auto">
        <div
          className="min-w-[560px]"
          role="img"
          aria-label={
            peak.value > 0
              ? `Hét napja és óra szerinti belépésszám. A legerősebb óra ${peak.label} ${peak.hour} óra, ${peak.value} belépéssel.`
              : 'Hét napja és óra szerinti belépésszám.'
          }
        >
          <div className="flex items-center gap-1 pl-[68px] pr-[52px]">
            {hourLabels.map((h) => (
              <span
                key={h}
                className="flex-1 text-center text-[10.5px] tabular-nums text-ink-muted"
              >
                {h}
              </span>
            ))}
          </div>

          <div className="mt-1 space-y-1">
            {rows.map((row) => (
              <div key={row.weekday} className="flex items-center gap-1">
                <span
                  className={cn(
                    'w-[68px] shrink-0 pr-2 text-right text-[11.5px]',
                    row.weekday === 3 || row.weekday === 5
                      ? 'font-semibold text-ink'
                      : 'text-ink-secondary'
                  )}
                >
                  {row.label}
                </span>

                {row.cells.map((cell) => {
                  const isPeak =
                    row.weekday === peak.weekday && cell.hour === peak.hour
                  return (
                    <span
                      key={cell.hour}
                      title={
                        cell.closed
                          ? `${row.label} ${cell.hour}:00 – zárva`
                          : `${row.label} ${cell.hour}:00 – ${cell.value} belépés`
                      }
                      className={cn(
                        'flex h-8 flex-1 items-center justify-center rounded-sm text-[10.5px] font-medium tabular-nums',
                        cell.closed
                          ? 'border border-dashed border-border text-ink-disabled'
                          : cell.value / max > 0.55
                            ? 'text-white'
                            : 'text-ink-secondary',
                        isPeak && 'ring-2 ring-ink ring-offset-1'
                      )}
                      style={heatCellStyle(cell.value, max, cell.closed)}
                    >
                      {cell.closed ? '' : cell.value}
                    </span>
                  )
                })}

                <span
                  className={cn(
                    'w-[52px] shrink-0 pl-2 text-right text-[11.5px] tabular-nums',
                    row.closed ? 'text-ink-disabled' : 'font-semibold text-ink'
                  )}
                >
                  {row.closed ? 'Zárva' : row.total}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-1.5 flex items-center justify-between pl-[68px] pr-[52px] text-[10.5px] text-ink-muted">
            <span>Óra (nyitvatartás)</span>
            <span>Átlagos belépésszám óránként · napi összesítés jobbra</span>
          </div>
        </div>
      </div>
    </div>
  )
}
