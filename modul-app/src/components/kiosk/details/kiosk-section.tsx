'use client'

import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export type KioskSectionState = 'todo' | 'active' | 'done'

/**
 * Egységes fehér szekció-kártya (Square „grouped section”).
 * Fejléc: állapotjel (szám / ✓) + cím + opcionális jobb oldali akció.
 */
export function KioskSection({
  index,
  title,
  description,
  state,
  action,
  onFocusWithin,
  children,
  className
}: {
  index?: number
  title: string
  description?: string
  state?: KioskSectionState
  action?: React.ReactNode
  onFocusWithin?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-surface transition-colors',
        state === 'active' ? 'border-ink' : 'border-border',
        className
      )}
      onFocus={onFocusWithin}
    >
      <header className="flex min-h-16 items-center gap-3 border-b border-border px-5 py-3">
        {index != null ? (
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums',
              state === 'done' && 'bg-success text-white',
              state === 'active' && 'bg-ink text-white',
              (state === 'todo' || state == null) &&
                'border-2 border-border-strong text-ink-secondary'
            )}
            aria-hidden
          >
            {state === 'done' ? (
              <Check className="size-4 stroke-[3]" />
            ) : (
              index
            )}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold leading-tight text-ink">
            {title}
            {state === 'done' ? (
              <span className="sr-only"> (kész)</span>
            ) : null}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[15px] leading-snug text-ink-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}
