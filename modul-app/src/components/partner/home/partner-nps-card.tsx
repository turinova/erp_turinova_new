'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

import { FeedbackTagChips } from '@/components/partner/home/feedback-tag-chips'
import {
  dismissPartnerProductFeedbackAction,
  saveNpsDetailAction,
  saveNpsScoreAction
} from '@/lib/partner/feedback-actions'
import {
  FEEDBACK_PROMPTS,
  NPS_COPY,
  feedbackPromptVariant,
  type FeedbackTagId
} from '@/lib/partner/feedback-copy'
import { cn } from '@/lib/utils'

const SCORES = Array.from({ length: 11 }, (_, i) => i)
const SAVE_DEBOUNCE_MS = 450

type Phase = 'idle' | 'thanks'

/** 0–10 NPS — pontszám kattintásra mentődik, a részletek utólag. */
export function PartnerNpsCard({ onDone }: { onDone: () => void }) {
  const labelId = useId()
  const hintId = useId()
  const questionId = useId()

  const [score, setScore] = useState<number | null>(null)
  const [tags, setTags] = useState<FeedbackTagId[]>([])
  const [comment, setComment] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [savedScore, setSavedScore] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const feedbackIdRef = useRef<string | null>(null)
  const inflightRef = useRef<Promise<void> | null>(null)
  const timerRef = useRef<number | null>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  function persistScore(value: number) {
    const run = async () => {
      // Előző beszúrás megvárása — különben dupla sor jönne létre
      if (inflightRef.current) await inflightRef.current
      const res = await saveNpsScoreAction({
        feedbackId: feedbackIdRef.current,
        score: value
      })
      if (!res.ok) {
        toast.error(res.message ?? 'Nem sikerült menteni.')
        return
      }
      if (res.feedbackId) feedbackIdRef.current = res.feedbackId
      setSavedScore(value)
    }
    const p = run().finally(() => {
      if (inflightRef.current === p) inflightRef.current = null
    })
    inflightRef.current = p
  }

  function selectScore(value: number) {
    setScore(value)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => persistScore(value), SAVE_DEBOUNCE_MS)
  }

  function handleKeyDown(e: React.KeyboardEvent, value: number) {
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(10, value + 1)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, value - 1)
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = 10
    if (next === null) return
    e.preventDefault()
    selectScore(next)
    buttonRefs.current[next]?.focus()
  }

  function handleSendDetail() {
    startTransition(async () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
        if (score !== null && score !== savedScore) persistScore(score)
      }
      if (inflightRef.current) await inflightRef.current
      if (!feedbackIdRef.current) {
        toast.error('Nem sikerült menteni. Próbáld újra.')
        return
      }
      if (tags.length > 0 || comment.trim()) {
        const res = await saveNpsDetailAction({
          feedbackId: feedbackIdRef.current,
          comment,
          tags
        })
        if (!res.ok) {
          toast.error(res.message ?? 'Nem sikerült elküldeni.')
          return
        }
      }
      setPhase('thanks')
      window.setTimeout(onDone, 2500)
    })
  }

  function handleDismiss() {
    // Ha már adott pontszámot, az mentve van — csak bezárjuk
    if (score !== null) {
      onDone()
      return
    }
    startTransition(async () => {
      const res = await dismissPartnerProductFeedbackAction()
      if (!res.ok) {
        toast.error(res.message ?? 'Nem sikerült elrejteni.')
        return
      }
      onDone()
    })
  }

  const shell =
    'rounded-lg border border-border border-l-[3px] border-l-tile-feedback-star bg-surface px-4 py-3'

  if (phase === 'thanks') {
    return (
      <section className={shell} aria-live="polite">
        <p className="text-[15px] font-medium text-ink">{NPS_COPY.thanks}</p>
      </section>
    )
  }

  const prompt = score !== null ? FEEDBACK_PROMPTS[feedbackPromptVariant(score)] : null
  const focusable = score ?? 0

  return (
    <section className={shell} aria-labelledby={labelId} aria-describedby={hintId}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tile-feedback-soft text-tile-feedback-ink"
            aria-hidden
          >
            <MessageSquare className="size-4" />
          </span>
          <div className="min-w-0">
            <h2
              id={labelId}
              className="text-[15px] font-semibold leading-snug text-ink sm:text-[16px]"
            >
              {NPS_COPY.question}
            </h2>
            <p id={hintId} className="text-[13px] text-ink-secondary sm:text-[14px]">
              {NPS_COPY.hint}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={handleDismiss}
          className="shrink-0 text-[14px] font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
        >
          {score !== null ? 'Bezárás' : 'Most nem'}
        </button>
      </div>

      <div className="mt-3 sm:pl-11">
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="grid grid-cols-6 gap-1 sm:flex sm:gap-1.5"
        >
          {SCORES.map((value) => {
            const selected = score === value
            return (
              <button
                key={value}
                ref={(el) => {
                  buttonRefs.current[value] = el
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${value} a 10-ből`}
                tabIndex={value === focusable ? 0 : -1}
                disabled={pending}
                onClick={() => selectScore(value)}
                onKeyDown={(e) => handleKeyDown(e, value)}
                className={cn(
                  'inline-flex h-9 items-center justify-center rounded-md border text-[14px] font-semibold tabular-nums transition-colors sm:w-10',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
                  'disabled:opacity-60',
                  selected
                    ? 'border-ink bg-ink text-white'
                    : 'border-border bg-surface text-ink hover:border-border-strong hover:bg-subtle'
                )}
              >
                {value}
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-[12px] text-ink-muted sm:max-w-[476px]">
          <span>{NPS_COPY.low}</span>
          <span>{NPS_COPY.high}</span>
        </div>
      </div>

      {prompt ? (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3 sm:pl-11">
          <p id={questionId} className="text-[15px] font-medium text-ink">
            {prompt.question}{' '}
            <span className="font-normal text-ink-muted">(opcionális)</span>
          </p>
          <FeedbackTagChips
            value={tags}
            onChange={setTags}
            disabled={pending}
            labelledBy={questionId}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1">
              <span className="sr-only">{prompt.question}</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={pending}
                rows={2}
                maxLength={2000}
                placeholder={prompt.placeholder}
                className="w-full resize-y rounded-md border border-border bg-app px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink disabled:opacity-60"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={handleSendDetail}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-primary px-3.5 text-[14px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? 'Küldés…' : 'Küldés'}
            </button>
          </div>
          <p className="text-[13px] text-ink-secondary" aria-live="polite">
            {savedScore !== null
              ? `Az értékelésed (${savedScore}) mentve. Minden üzenetet elolvasunk.`
              : 'Minden üzenetet elolvasunk.'}
          </p>
        </div>
      ) : null}
    </section>
  )
}
