'use client'

import { Star } from 'lucide-react'
import { useState, useTransition } from 'react'

import { buttonVariants } from '@/components/ui/button'
import type { PublicPdpReviews } from '@/lib/storefront/pdp'
import { submitProductReview } from '@/lib/storefront/review-actions'
import { cn } from '@/lib/utils'

type Props = {
  accessoryId: string
  variantLabel: string | null
  reviews: PublicPdpReviews
  privacyUrl: string | null
}

export function Stars({
  value,
  size = 'sm'
}: {
  value: number
  size?: 'sm' | 'md'
}) {
  const cls = size === 'md' ? 'size-5' : 'size-3.5'
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            cls,
            i <= Math.round(value) ? 'fill-ink text-ink' : 'text-stone-300'
          )}
        />
      ))}
    </span>
  )
}

const inputCls =
  'h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-[15px] text-ink outline-none focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink disabled:opacity-60'

function ReviewForm({
  accessoryId,
  variantLabel,
  privacyUrl,
  onDone
}: {
  accessoryId: string
  variantLabel: string | null
  privacyUrl: string | null
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [rating, setRating] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await submitProductReview({
        accessoryId,
        authorName: name,
        authorEmail: email,
        rating,
        title: title || undefined,
        body,
        variantLabel: variantLabel ?? undefined,
        website: honeypot
      })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setMessage(result.message)
        return
      }
      setErrors({})
      onDone()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border border-stone-200 p-4" noValidate>
      <fieldset>
        <legend className="text-[14px] font-semibold text-ink">
          Értékelésed <span className="text-danger-ink">*</span>
        </legend>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Csillagok">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i} csillag`}
              onClick={() => setRating(i)}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md hover:bg-stone-100"
            >
              <Star
                className={cn(
                  'size-6',
                  i <= rating ? 'fill-ink text-ink' : 'text-stone-300'
                )}
                aria-hidden
              />
            </button>
          ))}
        </div>
        {errors.rating ? (
          <p className="mt-1 text-[13px] text-danger-ink">{errors.rating}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="rv-name" className="text-[14px] font-semibold text-ink">
            Neved <span className="text-danger-ink">*</span>
          </label>
          <input
            id="rv-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            className={inputCls}
            disabled={pending}
          />
          <p className="text-[12px] text-ink-muted">Ez jelenik meg az értékelés mellett.</p>
          {errors.authorName ? (
            <p className="text-[13px] text-danger-ink">{errors.authorName}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rv-email" className="text-[14px] font-semibold text-ink">
            E-mail <span className="text-danger-ink">*</span>
          </label>
          <input
            id="rv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputCls}
            disabled={pending}
          />
          <p className="text-[12px] text-ink-muted">
            Nem tesszük közzé; csak az értékeléssel kapcsolatos kérdés esetén
            írunk rá.
          </p>
          {errors.authorEmail ? (
            <p className="text-[13px] text-danger-ink">{errors.authorEmail}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="rv-title" className="text-[14px] font-semibold text-ink">
          Cím <span className="font-normal text-ink-muted">(nem kötelező)</span>
        </label>
        <input
          id="rv-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className={inputCls}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="rv-body" className="text-[14px] font-semibold text-ink">
          Véleményed <span className="text-danger-ink">*</span>
        </label>
        <textarea
          id="rv-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          className={cn(inputCls, 'h-auto py-2.5 leading-relaxed')}
          disabled={pending}
        />
        <p className="text-[12px] text-ink-muted">
          Mire használtad, hogyan vált be? Legalább 10 karakter.
        </p>
        {errors.body ? (
          <p className="text-[13px] text-danger-ink">{errors.body}</p>
        ) : null}
      </div>

      <div className="hidden" aria-hidden>
        <label htmlFor="rv-website">Weboldal</label>
        <input
          id="rv-website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {message ? (
        <p className="text-[13px] text-danger-ink" role="alert">
          {message}
        </p>
      ) : null}

      <p className="text-[12px] leading-snug text-ink-muted">
        A beküldött nevet, e-mail címet és értékelést az értékelés
        megjelenítéséhez és moderálásához kezeljük.
        {privacyUrl ? (
          <>
            {' '}
            Részletek az{' '}
            <a
              href={privacyUrl}
              className="cursor-pointer underline underline-offset-2 hover:text-ink"
            >
              adatkezelési tájékoztatóban
            </a>
            .
          </>
        ) : null}
      </p>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className={cn(buttonVariants({ size: 'lg' }), 'h-11 px-5 text-[14px] font-semibold')}
        >
          {pending ? 'Küldés…' : 'Értékelés küldése'}
        </button>
      </div>
    </form>
  )
}

export function StorefrontPdpReviews({
  accessoryId,
  variantLabel,
  reviews,
  privacyUrl
}: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [sent, setSent] = useState(false)

  if (!reviews.enabled) return null

  const max = Math.max(1, ...reviews.distribution)

  return (
    <div className="space-y-5 text-ink">
      {reviews.count > 0 ? (
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="space-y-1">
            <p className="text-[36px] font-semibold leading-none tabular-nums text-ink">
              {reviews.average.toLocaleString('hu-HU', { minimumFractionDigits: 1 })}
            </p>
            <Stars value={reviews.average} size="md" />
            <p className="text-[13px] text-ink-secondary">
              {reviews.count} értékelés alapján
            </p>
          </div>
          <ul className="space-y-1.5" aria-label="Értékelések megoszlása">
            {reviews.distribution.map((n, i) => {
              const stars = 5 - i
              return (
                <li key={stars} className="flex items-center gap-2 text-[13px]">
                  <span className="w-12 shrink-0 tabular-nums text-ink-secondary">
                    {stars} csillag
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <span
                      className="block h-full rounded-full bg-ink"
                      style={{ width: `${(n / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right tabular-nums text-ink-secondary">
                    {n}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : !formOpen && !sent ? (
        <p className="text-[14px] text-ink-secondary">
          Még nincs értékelés. Ha vásároltál már ilyet, segíts a többieknek.
        </p>
      ) : null}

      {sent ? (
        <p
          className="rounded-md border border-stone-200 bg-stone-50 p-3 text-[14px] text-ink"
          role="status"
        >
          Köszönjük! Az értékelésed ellenőrzés után jelenik meg.
        </p>
      ) : null}

      {formOpen ? (
        <ReviewForm
          accessoryId={accessoryId}
          variantLabel={variantLabel}
          privacyUrl={privacyUrl}
          onDone={() => {
            setFormOpen(false)
            setSent(true)
          }}
        />
      ) : null}

      {reviews.items.length > 0 ? (
        <ul className="divide-y divide-stone-200 border-y border-stone-200">
          {reviews.items.map((r) => (
            <li key={r.id} className="space-y-2 py-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Stars value={r.rating} />
                <span className="sr-only">{r.rating} / 5 csillag</span>
                {r.title ? (
                  <p className="text-[14px] font-semibold text-ink">{r.title}</p>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                {r.body}
              </p>
              <p className="text-[12px] text-ink-muted">
                {r.authorName} ·{' '}
                {new Date(r.createdAt).toLocaleDateString('hu-HU')}
                {r.variantLabel ? ` · ${r.variantLabel}` : ''}
              </p>
              {r.sellerReply ? (
                <div className="rounded-r-md border-l-2 border-ink bg-stone-50 px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-ink">Az eladó válasza</p>
                  <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink-secondary">
                    {r.sellerReply}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!formOpen && !sent ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className={cn(
            buttonVariants({ variant: 'secondary', size: 'lg' }),
            'h-11 w-full px-4 text-[14px] font-medium sm:w-auto'
          )}
        >
          Értékelés írása
        </button>
      ) : null}

      <p className="text-[12px] leading-snug text-ink-muted">
        Minden termékről szóló, nem sértő véleményt közzéteszünk. A vásárlást
        nem ellenőrizzük.
      </p>
    </div>
  )
}
