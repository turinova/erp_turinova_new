'use client'

import { Star } from 'lucide-react'
import { useState } from 'react'

import { GoogleGIcon } from '@/components/reviews/google-g-icon'
import type { OrderStatusReview } from '@/lib/order-status/types'
import { STATUS_REVIEW_COPY, STATUS_REVIEW_THANKS } from '@/lib/reviews/status-cta'
import { cn } from '@/lib/utils'

function Stars({ size }: { size: 'sm' | 'md' }) {
  return (
    <div className="flex justify-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'fill-current text-tile-feedback-star',
            size === 'md' ? 'size-5' : 'size-4'
          )}
          strokeWidth={0}
        />
      ))}
    </div>
  )
}

/**
 * Google értékelés kérése a vevői státusz oldalon.
 * Mindenki ugyanazt a linket kapja (nincs elégedettség szerinti szűrés).
 */
export function OrderStatusReviewCard({
  review,
  disabled = false
}: {
  review: OrderStatusReview
  /** Beállítások előnézet — nem kattintható. */
  disabled?: boolean
}) {
  const [clicked, setClicked] = useState(false)
  if (review.mode === 'thanks' || clicked) {
    return (
      <section className="rounded-lg border border-border bg-surface px-4 py-3 text-center">
        <Stars size="sm" />
        <p className="mt-1.5 text-body font-medium text-ink">{STATUS_REVIEW_THANKS.title}</p>
        <a
          href={disabled ? undefined : review.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={disabled || undefined}
          className={cn(
            'mt-1 inline-block text-hint text-ink-secondary underline-offset-2 hover:underline',
            disabled && 'pointer-events-none'
          )}
        >
          {STATUS_REVIEW_THANKS.again}
        </a>
      </section>
    )
  }

  const copy = STATUS_REVIEW_COPY[review.mode]
  const primary = review.mode === 'primary'
  const linkProps = {
    href: disabled ? undefined : review.href,
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-disabled': disabled || undefined,
    onClick: () => {
      if (!disabled) setClicked(true)
    }
  }

  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-surface px-4 text-center',
        primary ? 'py-5' : 'py-4'
      )}
    >
      <h2
        className={cn(
          'font-semibold tracking-tight text-ink',
          primary ? 'text-[18px] leading-snug' : 'text-body'
        )}
      >
        {copy.title}
      </h2>
      <p className="mt-1 text-body text-ink-secondary">{copy.body}</p>
      <a
        {...linkProps}
        aria-label={copy.button}
        className={cn(
          'mx-auto mt-2.5 flex w-fit gap-1 rounded-md p-1 text-tile-feedback-star transition-transform active:scale-95',
          disabled && 'pointer-events-none'
        )}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn('fill-current', primary ? 'size-8' : 'size-7')}
            strokeWidth={0}
          />
        ))}
      </a>
      <a
        {...linkProps}
        className={cn(
          'mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md text-body font-medium',
          primary
            ? 'bg-ink text-white active:bg-ink/90'
            : 'border border-border bg-surface text-ink hover:bg-subtle active:bg-subtle',
          disabled && 'pointer-events-none opacity-90'
        )}
      >
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-full',
            primary ? 'bg-white' : null
          )}
        >
          <GoogleGIcon className="size-4" />
        </span>
        {copy.button}
      </a>
    </section>
  )
}
