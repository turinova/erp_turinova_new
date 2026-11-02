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
