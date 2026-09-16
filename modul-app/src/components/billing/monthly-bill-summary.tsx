import type { MonthlyBillEstimate } from '@/lib/billing/estimate'
import { formatHuf, formatHufAmount } from '@/lib/billing/estimate'
import { cn } from '@/lib/utils'

type Props = {
  estimate: MonthlyBillEstimate
  className?: string
  /** Platform: ops; tenant: közérthető ügyfél szöveg. */
  variant?: 'platform' | 'tenant'
  footnote?: string
}

export function MonthlyBillSummary({
  estimate,
  className,
  variant = 'platform',
  footnote
}: Props) {
  const monthLabel = new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(estimate.year, estimate.month - 1, 1)))

  const isTenant = variant === 'tenant'
  const title = isTenant
    ? `Mennyi jön ki ebben a hónapban? (${monthLabel})`
    : `Havi becslés — ${monthLabel}`
  const tip = isTenant
    ? 'Nettó árak (ÁFA nélkül). A számla külön érkezik.'
    : 'Manuális számlázás · nettó árak'

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface p-3',
        className
      )}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body font-semibold text-ink">{title}</h3>
        <p className="text-hint text-ink-secondary">{tip}</p>
      </div>

      {estimate.lines.length === 0 ? (
        <p className="text-body text-ink-secondary">
          {isTenant
            ? 'Még nincs tétel ezen a hónapon.'
            : 'Nincs számlázható tétel.'}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {estimate.lines.map((line) => (
            <li
              key={`${line.kind}-${line.key}`}
              className="flex items-start justify-between gap-3 py-1.5 text-body"
            >
              <div className="min-w-0">
                <p className="text-ink">{line.label}</p>
                {line.detail ? (
                  <p className="text-hint text-ink-secondary">{line.detail}</p>
                ) : line.kind === 'usage' ? (
                  <p className="text-hint text-ink-secondary">
                    {line.quantity} db × {formatHufAmount(line.unitPriceHuf)}
                  </p>
                ) : line.kind === 'addon' && isTenant ? (
                  <p className="text-hint text-ink-secondary">Kiegészítő · havi</p>
                ) : line.kind === 'plan' && isTenant ? (
                  <p className="text-hint text-ink-secondary">Alap csomag · havi</p>
                ) : null}
              </div>
              <p className="shrink-0 tabular-nums font-medium text-ink">
                {formatHufAmount(line.amountHuf)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        <p className="text-label font-semibold text-ink">
          {isTenant ? 'Kb. ennyi nettó ebben a hónapban' : 'Összesen (nettó)'}
        </p>
        <p className="tabular-nums text-body font-semibold text-ink">
          {formatHuf(estimate.totalHuf)}
        </p>
      </div>

      {footnote ? (
        <p className="mt-2 text-hint text-ink-secondary">{footnote}</p>
      ) : null}
    </div>
  )
}
