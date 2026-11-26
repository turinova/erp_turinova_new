import { Check } from 'lucide-react'
import Link from 'next/link'

import { formatReviewDate, formatReviewWhen } from '@/lib/reviews/format'
import type { ReviewLogPeriod, ReviewLogStatusFilter, ReviewQueueRow } from '@/lib/reviews/queue-queries'
import { REVIEW_CANCEL_REASON_LABEL, REVIEW_QUEUE_STATUS_LABEL } from '@/lib/reviews/queue-rules'
import { THANK_SMS_SKIP_LABEL, type ThankSmsSkipReason } from '@/lib/reviews/thank-sms'
import { cn } from '@/lib/utils'

const STATUS_FILTERS: { key: ReviewLogStatusFilter; label: string }[] = [
  { key: 'all', label: 'Mind' },
  { key: 'sent', label: 'Elküldve' },
  { key: 'skipped', label: 'Kihagyva' },
  { key: 'cancelled', label: 'Törölve' },
  { key: 'failed', label: 'Sikertelen' }
]
const PERIODS: ReviewLogPeriod[] = [7, 30, 90]

const STATUS_TONE: Record<string, string> = {
  sent: 'bg-success-soft text-success-ink',
  skipped: 'bg-subtle text-ink-secondary',
  cancelled: 'bg-subtle text-ink-secondary',
  failed: 'bg-danger-soft text-danger-ink'
}

function reasonText(r: ReviewQueueRow): string | null {
  if (r.status === 'cancelled') {
    const label = r.cancelReason ? REVIEW_CANCEL_REASON_LABEL[r.cancelReason] : null
    return [label, r.cancelNote].filter(Boolean).join(' · ') || null
  }
  if (r.status === 'skipped' && r.skipReason) {
    return THANK_SMS_SKIP_LABEL[r.skipReason as ThankSmsSkipReason] ?? r.skipReason
  }
  if (r.status === 'failed') return r.skipReason
  return null
}

export function ReviewLogFilters({
  status,
  days,
  hrefFor
}: {
  status: ReviewLogStatusFilter
  days: ReviewLogPeriod
  hrefFor: (p: { status?: ReviewLogStatusFilter; days?: ReviewLogPeriod }) => string
}) {
  const chip = (active: boolean) =>
    cn(
      'rounded-md px-2 py-1 text-hint no-underline transition-colors',
      active ? 'bg-ink text-white' : 'text-ink-secondary hover:bg-subtle hover:text-ink'
    )
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1" aria-label="Státusz">
        {STATUS_FILTERS.map((f) => (
          <Link key={f.key} href={hrefFor({ status: f.key })} className={chip(f.key === status)}>
            {f.label}
          </Link>
        ))}
      </div>
      <div className="flex gap-1" aria-label="Időszak">
        {PERIODS.map((d) => (
          <Link key={d} href={hrefFor({ days: d })} className={chip(d === days)}>
            {d} nap
          </Link>
        ))}
      </div>
    </div>
  )
}

export function ReviewLogTable({ rows }: { rows: ReviewQueueRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-6 text-center text-body text-ink-secondary">
        Ebben az időszakban nincs feldolgozott köszönő SMS.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-body">
        <thead className="border-b border-border text-left text-hint text-ink-secondary">
          <tr>
            <th className="px-3 py-2 font-medium">Vevő</th>
            <th className="px-3 py-2 font-medium">Rendelés</th>
            <th className="px-3 py-2 font-medium">Átadva</th>
            <th className="px-3 py-2 font-medium">Állapot</th>
            <th className="px-3 py-2 font-medium">Megnyitotta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const reason = reasonText(r)
            const when = r.status === 'cancelled' ? r.cancelledAt : r.processedAt
            return (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <Link href={`/ugyfelek/${r.customerId}`} className="text-ink hover:underline">
                    {r.customerName}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {r.orderHref && r.orderNumber ? (
                    <Link href={r.orderHref} className="text-ink hover:underline">
                      {r.orderNumber}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-secondary">{formatReviewDate(r.handedOverAt)}</td>
                <td className="px-3 py-2">
                  <span className={cn('rounded px-1.5 py-0.5 text-hint font-medium', STATUS_TONE[r.status])}>
                    {REVIEW_QUEUE_STATUS_LABEL[r.status]}
                  </span>
                  {when ? (
                    <span className="ml-1.5 text-hint tabular-nums text-ink-muted">{formatReviewWhen(when)}</span>
                  ) : null}
                  {reason ? <span className="block text-hint text-ink-secondary">{reason}</span> : null}
                </td>
                <td className="px-3 py-2">
                  {r.opened ? (
                    <span className="inline-flex items-center gap-1 text-hint text-success-ink">
                      <Check className="size-3.5" aria-hidden />
                      Igen
                    </span>
                  ) : (
                    <span className="text-hint text-ink-muted">Nem</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
