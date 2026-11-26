'use client'

import { ExternalLink, Star } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { RatingStars } from '@/components/reviews/rating-stars'
import type { TopbarGoogleRating as TopbarGoogleRatingData } from '@/lib/reviews/google-rating'
import { cn } from '@/lib/utils'

const nf = new Intl.NumberFormat('hu-HU')
const ratingFmt = new Intl.NumberFormat('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const timeFmt = new Intl.DateTimeFormat('hu-HU', {
  timeZone: 'Europe/Budapest',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

function storageKey(tenantId: string, what: 'seen' | 'celebrated' | 'toastDay') {
  return `turinova.googleRating.${what}.${tenantId}`
}

function readNumber(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function write(key: string, value: string | number) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    /* privát mód: nincs „új” jelzés, nem baj */
  }
}

function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest' }).format(new Date())
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <p className="text-hint text-ink-muted">A grafikon pár nap mentés után jelenik meg.</p>
  }
  const w = 248
  const h = 36
  const min = Math.min(...values)
  const span = Math.max(1, Math.max(...values) - min)
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`)
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block" aria-hidden>
      <polyline points={pts} fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}

export function TopbarGoogleRating({
  data,
  tenantId,
  canManage
}: {
  data: TopbarGoogleRatingData
  tenantId: string
  canManage: boolean
}) {
  const [open, setOpen] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const seenKey = storageKey(tenantId, 'seen')
    const seen = readNumber(seenKey)
    if (seen == null || seen > data.count) {
      write(seenKey, data.count)
      setNewCount(0)
      return
    }
    const fresh = data.count - seen
    setNewCount(fresh)
    if (fresh <= 0) return

    const celebratedKey = storageKey(tenantId, 'celebrated')
    if (readNumber(celebratedKey) !== data.count) {
      write(celebratedKey, data.count)
      setCelebrate(true)
    }
    const toastKey = storageKey(tenantId, 'toastDay')
    const today = todayYmd()
    try {
      if (window.localStorage.getItem(toastKey) !== today) {
        write(toastKey, today)
        toast.success(
          fresh === 1 ? 'Új Google-értékelés érkezett' : `${nf.format(fresh)} új Google-értékelés érkezett`,
          { description: 'Köszönjük a jó munkát!' }
        )
      }
    } catch {
      /* ignore */
    }
  }, [data.count, tenantId])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    setOpen((v) => !v)
    if (newCount > 0) {
      write(storageKey(tenantId, 'seen'), data.count)
      setNewCount(0)
    }
  }

  const ratingText = ratingFmt.format(data.rating)
  const reviewsUrl = `https://search.google.com/local/reviews?placeid=${encodeURIComponent(data.placeId)}`

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Google-értékelés: ${ratingText}, ${nf.format(data.count)} értékelés${
          newCount > 0 ? `, ${nf.format(newCount)} új` : ''
        }`}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
      >
        <span
          className={cn('hidden sm:inline-flex', celebrate && 'motion-safe:animate-[gr-pop_700ms_ease-out_1]')}
          onAnimationEnd={() => setCelebrate(false)}
        >
          <RatingStars rating={data.rating} size={18} />
        </span>
        <Star className="size-[18px] fill-amber-400 text-amber-500 sm:hidden" strokeWidth={1.5} aria-hidden />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[15px] font-semibold tabular-nums text-ink">{ratingText}</span>
          <span className="hidden text-[11px] tabular-nums text-ink-secondary sm:block">
            {nf.format(data.count)} értékelés · Google
          </span>
        </span>
        {newCount > 0 ? (
          <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            +{nf.format(newCount)} új
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Google-értékelések"
          className="absolute right-0 top-full z-40 mt-1.5 w-[280px] rounded-md border border-border bg-surface p-3 shadow-md"
        >
          <div className="flex items-center gap-2">
            <RatingStars rating={data.rating} size={20} />
            <span className="text-[20px] font-semibold tabular-nums text-ink">{ratingText}</span>
          </div>
          <p className="mt-0.5 text-body text-ink-secondary">
            {nf.format(data.count)} értékelés a Google-ön
          </p>

          <div className="mt-3 border-t border-border pt-3">
            <p className="text-body text-ink">
              {data.delta30d == null
                ? 'Az elmúlt 30 nap változása pár nap múlva látszik.'
                : `+${nf.format(data.delta30d)} értékelés az elmúlt 30 napban`}
            </p>
            <div className="mt-2">
              <Sparkline values={data.series} />
            </div>
          </div>

          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <a
              href={reviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border text-[13px] font-medium text-ink no-underline hover:bg-subtle"
            >
              Értékelések megnyitása a Google-ön
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <p className="flex items-center justify-between text-hint text-ink-muted">
              <span>
                {data.fetchedAt ? `Frissítve: ${timeFmt.format(new Date(data.fetchedAt))}` : null} · Forrás: Google
              </span>
              {canManage ? (
                <Link
                  href="/beallitasok/google-ertekelesek"
                  onClick={() => setOpen(false)}
                  className="text-ink-secondary no-underline hover:underline"
                >
                  Beállítások
                </Link>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
