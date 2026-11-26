import { cn } from '@/lib/utils'

/** Havi forgalom vs előző hónap ugyanarra a napra. */
export function MonthProgressBar({
  current,
  prior
}: {
  current: number
  prior: number
}) {
  const ratio =
    prior > 0 ? Math.min(1.5, current / prior) : current > 0 ? 1 : 0
  const widthPct = Math.min(100, ratio * 100)
  const ahead = prior > 0 && current > prior

  return (
    <div className="space-y-1" aria-hidden>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            ahead ? 'bg-success' : 'bg-ink'
          )}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  )
}

/** Mai visszáru aránya a mai forgalomhoz. */
export function ReturnRatioBar({
  returnGross,
  todayGross
}: {
  returnGross: number
  todayGross: number
}) {
  if (returnGross <= 0) {
    return (
      <div className="h-1.5 w-full rounded-full bg-subtle" aria-hidden />
    )
  }
  const ratio =
    todayGross > 0 ? Math.min(1, returnGross / todayGross) : 1
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle" aria-hidden>
      <div
        className="h-full rounded-full bg-danger"
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}

/**
 * Kinnlevő dual-sáv + címkék (látványosabb, mégis alacsony).
 * paid (soft) | due (warning); arány a nyitott gross-hoz.
 */
export function OpenDueStackBar({
  openDue,
  openInvoiceGross
}: {
  openDue: number
  openInvoiceGross: number
}) {
  const paid = Math.max(0, openInvoiceGross - openDue)
  const total = Math.max(0, openInvoiceGross)
  const due = Math.max(0, openDue)

  if (total <= 0) {
    return (
      <div className="space-y-1" aria-hidden>
        <div className="h-2.5 w-full rounded-full bg-subtle" />
        <p className="text-[10px] leading-none text-ink-muted">Nincs kintlévő</p>
      </div>
    )
  }

  const paidPct = (paid / total) * 100
  const duePct = (due / total) * 100
  const paidLabel = `${Math.round(paidPct)}%`
  const dueLabel = `${Math.round(duePct)}%`

  return (
    <div className="space-y-1">
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-subtle"
        role="img"
        aria-label={`Befizetve ${paidLabel}, hátralévő ${dueLabel}`}
      >
        {paidPct > 0 ? (
          <div
            className="h-full bg-ink-muted"
            style={{ width: `${paidPct}%` }}
          />
        ) : null}
        {duePct > 0 ? (
          <div
            className="h-full bg-warning"
            style={{ width: `${duePct}%` }}
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] leading-none text-ink-secondary">
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <span
            className="size-1.5 shrink-0 rounded-sm bg-ink-muted"
            aria-hidden
          />
          Befizetve{' '}
          <span className="tabular-nums text-ink-muted">{paidLabel}</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-sm',
              due > 0 ? 'bg-warning' : 'bg-border'
            )}
            aria-hidden
          />
          Hátralévő{' '}
          <span
            className={cn(
              'tabular-nums',
              due > 0 ? 'text-warning-ink' : 'text-ink-muted'
            )}
          >
            {dueLabel}
          </span>
        </span>
      </div>
    </div>
  )
}

/**
 * @deprecated Prefer OpenDueStackBar (home KPI). Kept for marketing mockup.
 * Kinnlevő ring: befizetett hányad a nyitott számlákon.
 */
export function OpenDueRing({
  openDue,
  openInvoiceGross
}: {
  openDue: number
  openInvoiceGross: number
}) {
  const collected = Math.max(0, openInvoiceGross - openDue)
  const paidRatio =
    openInvoiceGross > 0 ? collected / openInvoiceGross : openDue === 0 ? 1 : 0
  const r = 14
  const c = 2 * Math.PI * r
  const dash = paidRatio * c
  const hasRisk = openDue > 0

  return (
    <div className="flex items-center justify-start" aria-hidden>
      <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-border"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 18 18)"
          className={hasRisk ? 'text-warning-ink' : 'text-success-ink'}
        />
      </svg>
    </div>
  )
}

/**
 * Kapacitás / arány ring — monokróm charcoal (Midday).
 * tone: ink default; warning ≥85%; danger túlterhelés / elmaradás.
 */
export function CapacityRing({
  ratio,
  size = 36,
  strokeWidth = 3,
  tone = 'ink'
}: {
  /** 0…1+ (1 = teljes kör; >1 továbbra is full + danger javasolt) */
  ratio: number
  size?: number
  strokeWidth?: number
  tone?: 'ink' | 'warning' | 'danger' | 'success'
}) {
  const r = (size - strokeWidth) / 2 - 1
  const c = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, ratio))
  const dash = clamped * c
  const cx = size / 2
  const toneClass =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'success'
          ? 'text-success'
          : 'text-ink'

  return (
    <div className="flex items-center justify-start" aria-hidden>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
      >
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${cx} ${cx})`}
          className={toneClass}
        />
      </svg>
    </div>
  )
}

/** 7 napos mini oszlopsor napbetűkkel; a mai (utolsó) kiemelve. */
export function WeekBars({
  data,
  label
}: {
  data: { label: string; count: number }[]
  label: string
}) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-6 items-end gap-1">
        {data.map((d, i) => {
          const isToday = i === data.length - 1
          if (isToday && d.count === 0) {
            return (
              <div
                key={d.label}
                className="h-full flex-1 rounded-sm border border-dashed border-border-strong"
              />
            )
          }
          return (
            <div
              key={d.label}
              title={`${d.label}: ${d.count}`}
              className={cn('flex-1 rounded-sm', isToday ? 'bg-ink' : 'bg-border-strong')}
              style={{ height: `${Math.max(8, (d.count / max) * 100)}%` }}
            />
          )
        })}
      </div>
      <div className="mt-0.5 flex gap-1 text-[10px] leading-none text-ink-muted" aria-hidden>
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 text-center">
            {i === data.length - 1 ? 'ma' : d.label.split(' ')[0]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Átvételre várók kor szerint: 0–2 / 3–6 / 7+ nap, jelmagyarázattal. */
export function AgingBar({
  fresh,
  mid,
  old
}: {
  fresh: number
  mid: number
  old: number
}) {
  const total = fresh + mid + old
  return (
    <div role="img" aria-label={`0–2 napja: ${fresh}, 3–6 napja: ${mid}, 7+ napja: ${old}`}>
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-subtle">
        {total > 0 ? (
          <>
            {fresh > 0 ? <div className="h-full bg-ink" style={{ flexGrow: fresh }} /> : null}
            {mid > 0 ? <div className="h-full bg-ink-muted" style={{ flexGrow: mid }} /> : null}
            {old > 0 ? <div className="h-full bg-warning" style={{ flexGrow: old }} /> : null}
          </>
        ) : null}
      </div>
      <p className="mt-1 flex gap-2 text-[10px] leading-none tabular-nums text-ink-muted" aria-hidden>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-ink" />0–2 n: {fresh}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-ink-muted" />3–6 n: {mid}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-warning" />7+ n: {old}
        </span>
      </p>
    </div>
  )
}

/** Mai érték vs szokásos jelölő, jelmagyarázattal. */
export function BulletBar({ value, typical }: { value: number; typical: number }) {
  const scale = Math.max(1, value, typical) * 1.15
  return (
    <div role="img" aria-label={`Ma ${value}, ilyenkor átlagosan ${typical}`}>
      <div className="relative h-1.5 w-full rounded-full bg-subtle">
        <div
          className={cn(
            'h-full rounded-full',
            typical > 0 && value >= typical ? 'bg-success' : 'bg-ink'
          )}
          style={{ width: `${(value / scale) * 100}%` }}
        />
        {typical > 0 ? (
          <div
            className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink-secondary"
            style={{ left: `${(typical / scale) * 100}%` }}
          />
        ) : null}
      </div>
      <p className="mt-1 flex gap-2 text-[10px] leading-none text-ink-muted" aria-hidden>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-2.5 rounded-full bg-ink" />ma
        </span>
        {typical > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-0.5 rounded-full bg-ink-secondary" />ilyenkor átlag
          </span>
        ) : null}
      </p>
    </div>
  )
}
