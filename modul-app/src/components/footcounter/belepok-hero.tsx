import { cn } from '@/lib/utils'
import type {
  FootcounterMonthGlance,
  FootcounterTodayGlance
} from '@/lib/footcounter/summary'

function fmt(n: number, digits = 0) {
  return n.toLocaleString('hu-HU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  })
}

function hourLabel(hour: number | null) {
  if (hour == null) return '—'
  return `${String(hour).padStart(2, '0')}:00`
}

export function BelepokTodayStrip({ today }: { today: FootcounterTodayGlance }) {
  const moodClass =
    today.mood === 'busy'
      ? 'border-success/30 bg-success-soft/50 text-success-ink'
      : today.mood === 'quiet'
        ? 'border-warning/30 bg-warning-soft/50 text-warning-ink'
        : today.mood === 'typical'
          ? 'border-border bg-subtle text-ink'
          : 'border-border bg-subtle text-ink-secondary'

  return (
    <section className="rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-hint text-ink-secondary">Ma</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">
            {fmt(today.todayIn)}
            <span className="ml-1.5 text-[13px] font-medium text-ink-secondary">
              belépő
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-md border px-2 py-1 text-[12px] font-medium',
              moodClass
            )}
          >
            {today.moodLabel}
            {today.moodHint ? (
              <span className="font-normal text-ink-muted">
                {' '}
                · {today.moodHint}
              </span>
            ) : null}
          </span>
          <span className="text-hint tabular-nums text-ink-secondary">
            Csúcs {hourLabel(today.peakHour)}
            {today.peakHourIn > 0 ? ` · ${fmt(today.peakHourIn)}` : ''}
          </span>
        </div>
      </div>
    </section>
  )
}

export function BelepokMonthKpis({ glance }: { glance: FootcounterMonthGlance }) {
  const momClass =
    glance.monthMood === 'strong'
      ? 'border-success/30 bg-success-soft/40 text-success-ink'
      : glance.monthMood === 'soft'
        ? 'border-warning/30 bg-warning-soft/40 text-warning-ink'
        : 'border-border bg-subtle text-ink-secondary'

  const momText =
    glance.momChangePct == null
      ? null
      : `${glance.momChangePct > 0 ? '+' : ''}${glance.momChangePct}%`

  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi
        label="Összesen"
        value={fmt(glance.totalIn)}
        hint={`${glance.activeDays} nyitott nap`}
      />
      <Kpi
        label="Átlag / nap"
        value={fmt(Math.round(glance.avgPerActiveDay))}
        hint="csak nyitott napokon"
      />
      <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
        <p className="text-hint text-ink-secondary">Előző hónaphoz</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-[12px] font-medium',
              momClass
            )}
          >
            {glance.monthMoodLabel}
            {momText ? ` · ${momText}` : ''}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-ink-muted">
          Csúcsóra {hourLabel(glance.peakHour)}
          {glance.peakHourIn > 0 ? ` · ${fmt(glance.peakHourIn)} belépő` : ''}
        </p>
      </div>
      <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
        <p className="text-hint text-ink-secondary">Szélső értékek</p>
        <p className="mt-1 text-[13px] tabular-nums text-ink">
          {glance.best ? (
            <>
              <span className="text-success-ink">{glance.best.day}.</span>
              <span className="text-ink-muted"> · </span>
              {fmt(glance.best.count)}
            </>
          ) : (
            '—'
          )}
          <span className="mx-1.5 text-ink-muted">/</span>
          {glance.worst ? (
            <>
              <span className="text-danger-ink">{glance.worst.day}.</span>
              <span className="text-ink-muted"> · </span>
              {fmt(glance.worst.count)}
            </>
          ) : (
            '—'
          )}
        </p>
        <p className="mt-1 text-[11px] text-ink-muted">legjobb · leggyengébb</p>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
      <p className="text-hint text-ink-secondary">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted">{hint}</p>
    </div>
  )
}
