import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type DueAmountProps = {
  /** Pl. „Fizetendő (bruttó)”, „Átvételkor fizet”. */
  label: string
  /** Formázott összeg (pénznemmel). */
  amount: string
  /** Kis sor az összeg alatt (hátralék, kifizetve, nem végleges…). */
  footnote?: ReactNode
  /** true = halvány (lezárt / nincs fizetendő). */
  muted?: boolean
  strike?: boolean
}

/** Jobb rail fizetendő kártya (desktop). */
export function DueAmountCard({
  label,
  amount,
  footnote,
  muted = false,
  strike = false,
  className
}: DueAmountProps & { className?: string }) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border-strong bg-surface p-3 shadow-sm',
        className
      )}
      aria-label={label}
    >
      <p className="text-[12px] font-medium text-ink-secondary">{label}</p>
      <p
        className={cn(
          'mt-1.5 text-[32px] font-bold leading-none tracking-tight tabular-nums',
          muted ? 'text-ink-secondary' : 'text-success-ink',
          strike && 'line-through'
        )}
      >
        {amount}
      </p>
      {footnote ? <div className="mt-1.5 text-hint">{footnote}</div> : null}
    </section>
  )
}

/** Keskeny viewport: rögzített alsó sáv (lg alatt). */
export function DueAmountBar({
  label,
  amount,
  footnote,
  muted = false,
  strike = false,
  action
}: DueAmountProps & { action?: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-surface px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:left-[var(--sidebar-width)] lg:hidden"
      role="status"
      aria-label={label}
    >
      <div className="mx-auto flex max-w-5xl items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-ink-secondary">{label}</p>
          {footnote ? <div className="text-hint">{footnote}</div> : null}
          {action ? (
            <p
              className={cn(
                'mt-0.5 text-[24px] font-bold leading-none tracking-tight tabular-nums',
                muted ? 'text-ink-secondary' : 'text-success-ink',
                strike && 'line-through'
              )}
            >
              {amount}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : (
          <p
            className={cn(
              'shrink-0 text-[30px] font-bold leading-none tracking-tight tabular-nums',
              muted ? 'text-ink-secondary' : 'text-success-ink',
              strike && 'line-through'
            )}
          >
            {amount}
          </p>
        )}
      </div>
    </div>
  )
}
