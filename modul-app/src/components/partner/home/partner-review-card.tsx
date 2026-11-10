'use client'

import { Star } from 'lucide-react'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { GoogleGIcon } from '@/components/reviews/google-g-icon'
import {
  PARTNER_REVIEW_COPY,
  partnerReviewCopy,
  type PartnerReviewPrompt
} from '@/lib/partner/review-prompt'
import {
  dismissPartnerReviewAction,
  markPartnerReviewClickedAction,
  markPartnerReviewWrittenAction
} from '@/lib/partner/review-prompt-actions'
import { cn } from '@/lib/utils'

const SHELL =
  'rounded-lg border border-border border-l-[3px] border-l-tile-feedback-star bg-surface px-4 py-3'

function formatFinishedDate(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    month: 'short',
    day: 'numeric'
  }).format(new Date(iso))
}

/**
 * Google értékelés kérése a kapcsolt boltnak. Mindenki ugyanazt a linket kapja,
 * a csillagsor egyetlen link (nem lehet „választani” rajta).
 */
export function PartnerReviewCard({
  prompt,
  onDone
}: {
  prompt: PartnerReviewPrompt
  onDone: () => void
}) {
  const titleId = useId()
  const [clicked, setClicked] = useState(false)
  const [pending, startTransition] = useTransition()
  const copy = partnerReviewCopy(prompt.variant, prompt.companyName, prompt.finishedCount)

  function handleOpen() {
    setClicked(true)
    void markPartnerReviewClickedAction(prompt.tenantId)
  }

  function handleWritten() {
    startTransition(async () => {
      const res = await markPartnerReviewWrittenAction(prompt.tenantId)
      if (!res.ok) {
        toast.error(res.message ?? 'Nem sikerült menteni.')
        return
      }
      toast.success(PARTNER_REVIEW_COPY.selfReportedToast)
      onDone()
    })
  }

  function handleDismiss() {
    startTransition(async () => {
      const res = await dismissPartnerReviewAction(prompt.tenantId)
      if (!res.ok) {
        toast.error(res.message ?? 'Nem sikerült elrejteni.')
        return
      }
      toast.message(PARTNER_REVIEW_COPY.dismissedToast)
      onDone()
    })
  }

  if (clicked) {
    return (
      <section className={SHELL} aria-live="polite">
        <p className="text-[15px] font-medium text-ink">{PARTNER_REVIEW_COPY.thanksTitle}</p>
        <p className="text-[14px] text-ink-secondary">
          {PARTNER_REVIEW_COPY.thanksBody(prompt.companyName)}
        </p>
      </section>
    )
  }

  return (
    <section className={SHELL} aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tile-feedback-soft"
            aria-hidden
          >
            <GoogleGIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-[15px] font-semibold leading-snug text-ink sm:text-[16px]"
            >
              {copy.title}
            </h2>
            <p className="text-[13px] text-ink-secondary sm:text-[14px]">{copy.body}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={handleDismiss}
          className="shrink-0 text-[14px] font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
        >
          {PARTNER_REVIEW_COPY.notNow}
        </button>
      </div>

      <div className="mt-3 space-y-3 sm:pl-11">
        <div className="space-y-0.5 text-[13px] text-ink-muted">
          {prompt.lastOrder ? (
            <p>
              {PARTNER_REVIEW_COPY.lastOrder}:{' '}
              <span className="font-medium text-ink-secondary">{prompt.lastOrder.number}</span>,{' '}
              {formatFinishedDate(prompt.lastOrder.finishedAt)}
            </p>
          ) : null}
          <p>{PARTNER_REVIEW_COPY.topics}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href={prompt.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpen}
            className={cn(
              'inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-[14px] font-medium text-ink transition-colors hover:border-border-strong hover:bg-subtle sm:h-9',
              pending && 'pointer-events-none opacity-60'
            )}
          >
            <span className="flex text-tile-feedback-star" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="size-3.5 fill-current" strokeWidth={0} />
              ))}
            </span>
            {PARTNER_REVIEW_COPY.button}
          </a>
          <button
            type="button"
            disabled={pending}
            onClick={handleWritten}
            className="h-9 text-[14px] font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline disabled:opacity-60 sm:px-2"
          >
            {PARTNER_REVIEW_COPY.alreadyWrote}
          </button>
        </div>
      </div>
    </section>
  )
}
