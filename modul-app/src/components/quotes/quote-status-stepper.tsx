'use client'

import type { QuoteStatus } from '@/lib/quotes/queries'
import {
  QUOTE_PIPELINE_STEPS,
  QUOTE_STATUS_LABEL,
  quoteNextStepLabel
} from '@/lib/quotes/status-labels'
import { cn } from '@/lib/utils'

type QuoteStatusStepperProps = {
  status: QuoteStatus
  className?: string
}

export function QuoteStatusStepper({
  status,
  className
}: QuoteStatusStepperProps) {
  if (status === 'cancelled') {
    return (
      <p
        className={cn('text-body text-danger-ink', className)}
        role="status"
      >
        Törölve — nincs további gyártási lépés.
      </p>
    )
  }

  const currentIdx = QUOTE_PIPELINE_STEPS.indexOf(
    status as (typeof QUOTE_PIPELINE_STEPS)[number]
  )
  const next = quoteNextStepLabel(status)

  return (
    <div className={cn('space-y-1.5', className)}>
      <ol
        className="flex flex-wrap items-center gap-x-1 gap-y-1"
        aria-label="Gyártási állapot"
      >
        {QUOTE_PIPELINE_STEPS.map((step, idx) => {
          const done = currentIdx > idx
          const current = currentIdx === idx
          return (
            <li key={step} className="flex items-center gap-1">
              {idx > 0 ? (
                <span
                  className="mx-0.5 text-hint text-ink-muted"
                  aria-hidden
                >
                  →
                </span>
              ) : null}
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-hint',
                  current && 'bg-ink font-medium text-surface',
                  done && !current && 'font-medium text-ink',
                  !done && !current && 'text-ink-secondary'
                )}
                aria-current={current ? 'step' : undefined}
              >
                {QUOTE_STATUS_LABEL[step]}
              </span>
            </li>
          )
        })}
      </ol>
      {next ? (
        <p className="text-body text-ink-secondary" role="status">
          Következő: <span className="font-medium text-ink">{next}</span>
        </p>
      ) : status === 'finished' ? (
        <p className="text-body text-ink-secondary" role="status">
          Lezárva — nincs további lépés.
        </p>
      ) : null}
    </div>
  )
}
