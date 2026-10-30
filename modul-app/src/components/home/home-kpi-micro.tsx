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
 * Kinnlevő ring: befizetett hányad a nyitott számlákon
 * (openInvoiceGross − openDue) / openInvoiceGross.
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
