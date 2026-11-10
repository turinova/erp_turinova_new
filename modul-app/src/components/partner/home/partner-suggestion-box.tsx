'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { ArrowRight, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'

import { FeedbackTagChips } from '@/components/partner/home/feedback-tag-chips'
import { submitPartnerSuggestionAction } from '@/lib/partner/feedback-actions'
import { SUGGESTION_COPY, type FeedbackTagId } from '@/lib/partner/feedback-copy'

type Phase = 'closed' | 'open' | 'thanks'

/** Mindig elérhető javaslat — küldés után nem tűnik el. */
export function PartnerSuggestionBox() {
  const labelId = useId()
  const tagsLabelId = useId()
  const [phase, setPhase] = useState<Phase>('closed')
  const [tags, setTags] = useState<FeedbackTagId[]>([])
  const [comment, setComment] = useState('')
  const [pending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function open() {
    setPhase('open')
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function reset() {
    setTags([])
    setComment('')
  }

  function handleSubmit() {
    if (!comment.trim() && tags.length === 0) {
      toast.error('Írj pár szót, vagy válassz egy címkét.')
      return
    }
    startTransition(async () => {
      const res = await submitPartnerSuggestionAction({ comment, tags })
      if (!res.ok) {
        toast.error(res.message ?? 'Nem sikerült elküldeni.')
        return
      }
      reset()
      setPhase('thanks')
      window.setTimeout(() => setPhase('closed'), 2500)
    })
  }

  return (
    <section
      className="rounded-lg border border-border border-l-[3px] border-l-tile-feedback-star bg-surface px-4 py-3"
      aria-labelledby={labelId}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tile-feedback-soft text-tile-feedback-ink"
            aria-hidden
          >
            <Lightbulb className="size-4" />
          </span>
          <div className="min-w-0">
            <h2
              id={labelId}
              className="text-[15px] font-semibold leading-snug text-ink sm:text-[16px]"
            >
              {SUGGESTION_COPY.title}
            </h2>
            <p className="text-[13px] text-ink-secondary sm:text-[14px]" aria-live="polite">
              {phase === 'thanks' ? SUGGESTION_COPY.thanks : SUGGESTION_COPY.hint}
            </p>
          </div>
        </div>
        {phase !== 'open' ? (
          <button
            type="button"
            onClick={open}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-md border border-border bg-surface px-3.5 text-[14px] font-medium text-ink transition-colors hover:bg-subtle sm:self-center"
          >
            {SUGGESTION_COPY.open}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {phase === 'open' ? (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3 sm:pl-11">
          <p id={tagsLabelId} className="text-[14px] text-ink-secondary">
            Miről szól? <span className="text-ink-muted">(opcionális)</span>
          </p>
          <FeedbackTagChips
            value={tags}
            onChange={setTags}
            disabled={pending}
            labelledBy={tagsLabelId}
          />
          <label className="block">
            <span className="sr-only">Javaslat</span>
            <textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={pending}
              rows={3}
              maxLength={2000}
              placeholder={SUGGESTION_COPY.placeholder}
              className="w-full resize-y rounded-md border border-border bg-app px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink disabled:opacity-60"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                reset()
                setPhase('closed')
              }}
              className="inline-flex h-9 items-center justify-center rounded-md px-3 text-[14px] font-medium text-ink-secondary hover:bg-subtle hover:text-ink disabled:opacity-60"
            >
              Mégse
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleSubmit}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3.5 text-[14px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? 'Küldés…' : 'Javaslat küldése'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
