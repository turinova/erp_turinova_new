import { cn } from '@/lib/utils'
import {
  FOOTCOUNTER_CHART,
  formatChartCount
} from '@/lib/footcounter/chart-tokens'
import type { FootcounterSeasonBar } from '@/lib/footcounter/chart-types'

/**
 * 12 hónapos szezon oszlopdiagram.
 * Fontos: a külső sor `items-stretch` + abszolút sáv — a régi `items-end` +
 * százalékos magasság 0 magasságú szülőn miatt üresnek látszott.
 */
export function SeasonChart({
  months,
  caption,
  className
}: {
  months: FootcounterSeasonBar[]
  caption?: string
  className?: string
}) {
  const max = Math.max(1, ...months.map((m) => m.totalIn))
  const best = months.reduce(
    (a, b) => (b.totalIn > a.totalIn ? b : a),
    months[0] ?? { key: '', label: '', totalIn: 0 }
  )
  const worst = months.reduce(
    (a, b) => (b.totalIn < a.totalIn ? b : a),
    months[0] ?? { key: '', label: '', totalIn: 0 }
  )
  const empty = months.every((m) => m.totalIn <= 0)

  if (empty) {
    return (
      <p
        className={cn(
          'py-10 text-center text-body text-ink-secondary',
          className
        )}
      >
        Nincs szezon adat.
      </p>
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div
        className="flex h-[188px] items-stretch gap-1.5 sm:gap-2"
        role="img"
        aria-label={`Utolsó 12 hónap belépésszáma. A legerősebb hónap ${best.label} ${formatChartCount(best.totalIn)}, a leggyengébb ${worst.label} ${formatChartCount(worst.totalIn)} belépéssel.`}
      >
        {months.map((m) => {
          const pct = (m.totalIn / max) * 100
          return (
            <div
              key={m.key}
              className="flex min-w-0 flex-1 flex-col items-center"
            >
              <span
                className={cn(
                  'shrink-0 text-[10px] tabular-nums leading-none',
                  m.selected ? 'font-semibold text-ink' : 'text-ink-muted'
                )}
              >
                {formatChartCount(m.totalIn)}
              </span>
              <div className="relative mt-1 min-h-0 w-full flex-1">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-sm"
                  style={{
                    height: `${Math.max(pct, 4)}%`,
                    backgroundColor: m.selected
                      ? FOOTCOUNTER_CHART.strong
                      : m.key === worst.key
                        ? FOOTCOUNTER_CHART.soft
                        : FOOTCOUNTER_CHART.mid
                  }}
                />
              </div>
              <span
                className={cn(
                  'mt-1 shrink-0 text-[10.5px]',
                  m.selected ? 'font-semibold text-ink' : 'text-ink-muted'
                )}
              >
                {m.label}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11.5px] text-ink-muted">
        {caption ??
          `Belépésszám hónaponként. Legerősebb: ${best.label} ${formatChartCount(best.totalIn)} · leggyengébb: ${worst.label} ${formatChartCount(worst.totalIn)}`}
      </p>
    </div>
  )
}
