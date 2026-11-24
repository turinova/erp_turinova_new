'use client'

import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export type KioskSectionState = 'todo' | 'active' | 'done'

/**
 * Egységes fehér szekció-kártya (Square „grouped section”).
 * Fejléc: állapotjel (szám / ✓) + cím.
 * Accordion: csak `active` (vagy forceOpen) mutatja a body-t — 24″ Adatok no-scroll.
 */
export function KioskSection({
  index,
  title,
  description,
  state,
  action,
  onFocusWithin,
  onHeaderClick,
  forceOpen = false,
  compact = false,
  bodyClassName,
  children,
  className
}: {
  index?: number
  title: string
  description?: string
  state?: KioskSectionState
  action?: React.ReactNode
  onFocusWithin?: () => void
  /** Összecsukott szekció megnyitása (accordion). */
  onHeaderClick?: () => void
  /** Body mindig nyitva (pl. rendelés összegző). */
  forceOpen?: boolean
  compact?: boolean
  bodyClassName?: string
  children: React.ReactNode
  className?: string
}) {
  const bodyOpen = forceOpen || state == null || state === 'active'
  const headerInteractive = Boolean(onHeaderClick) && !bodyOpen

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-surface transition-colors',
        state === 'active' ? 'border-ink' : 'border-border',
        className
      )}
      onFocus={onFocusWithin}
    >
      <header
        className={cn(
          'flex items-center gap-3 border-border',
          bodyOpen && 'border-b',
          compact ? 'min-h-12 px-4 py-2' : 'min-h-16 px-5 py-3',
          headerInteractive &&
            'cursor-pointer hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none'
        )}
        onClick={headerInteractive ? onHeaderClick : undefined}
        onKeyDown={
          headerInteractive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onHeaderClick?.()
                }
              }
            : undefined
        }
        role={headerInteractive ? 'button' : undefined}
        tabIndex={headerInteractive ? 0 : undefined}
        aria-expanded={bodyOpen}
      >
        {index != null ? (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums',
              compact ? 'size-7 text-[14px]' : 'size-8 text-[15px]',
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
          <h2
            className={cn(
              'font-semibold leading-tight text-ink',
              compact ? 'text-[17px]' : 'text-[19px]'
            )}
          >
            {title}
            {state === 'done' ? (
              <span className="sr-only"> (kész)</span>
            ) : null}
          </h2>
          {description && bodyOpen ? (
            <p
              className={cn(
                'leading-snug text-ink-secondary',
                compact ? 'mt-0 text-[13px]' : 'mt-0.5 text-[15px]'
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {bodyOpen ? (
        <div
          className={cn(
            compact ? 'p-3.5' : 'p-5',
            bodyClassName
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  )
}
