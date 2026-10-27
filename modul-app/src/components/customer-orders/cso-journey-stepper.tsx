'use client'

import type { CsoJourneyStep } from '@/lib/customer-orders/types'
import { cn } from '@/lib/utils'

type Props = {
  steps: CsoJourneyStep[]
  /** Rövid címke → „Következő: …” (ajánlat-minta). */
  nextLabel?: string | null
  /** Ha nincs következő (kész) — plain szöveg a stepper alatt. */
  footer?: string | null
  className?: string
}

function fmtHint(iso: string) {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso))
}

/** Vízszintes rendelés-út — QuoteStatusStepper ritmus. */
export function CsoJourneyStepper({
  steps,
  nextLabel,
  footer,
  className
}: Props) {
  if (steps.length === 0) return null

  const firstPending = steps.findIndex((s) => !s.done)
  const currentIdx =
    firstPending === -1 ? steps.length - 1 : firstPending

  return (
    <div className={cn('space-y-1.5', className)}>
      <ol
        className="flex flex-wrap items-center gap-x-1 gap-y-1"
        aria-label="Rendelés útja"
      >
        {steps.map((step, idx) => {
          const done = step.done && idx !== currentIdx
          const current = idx === currentIdx
          return (
            <li key={step.key} className="flex items-center gap-1">
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
                  done && 'font-medium text-ink',
                  !done && !current && 'text-ink-secondary'
                )}
                title={
                  [
                    step.at ? fmtHint(step.at) : step.done ? undefined : 'még nem',
                    step.hint
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                aria-current={current ? 'step' : undefined}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
      {nextLabel ? (
        <p className="text-body text-ink-secondary" role="status">
          Következő:{' '}
          <span className="font-medium text-ink">{nextLabel}</span>
        </p>
      ) : footer ? (
        <p className="text-body text-ink-secondary" role="status">
          {footer}
        </p>
      ) : null}
    </div>
  )
}
