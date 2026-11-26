import { AlertTriangle, ArrowRight, CheckCircle2, Star } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import type { GoogleRatingSummary } from '@/lib/reviews/google-rating'
import { cn } from '@/lib/utils'

export type ReviewTab = 'attekintes' | 'csatornak' | 'utemezett' | 'naplo'

export const REVIEW_TABS: { key: ReviewTab; label: string }[] = [
  { key: 'attekintes', label: 'Áttekintés' },
  { key: 'csatornak', label: 'Csatornák' },
  { key: 'utemezett', label: 'Ütemezett SMS' },
  { key: 'naplo', label: 'Napló' }
]

export function parseReviewTab(raw: string | undefined): ReviewTab {
  return REVIEW_TABS.some((t) => t.key === raw) ? (raw as ReviewTab) : 'attekintes'
}

const nf = new Intl.NumberFormat('hu-HU')

export function ReviewPageChrome({
  active,
  shortUrl,
  googleAvailable,
  rating,
  pendingCount
}: {
  active: ReviewTab
  shortUrl: string | null
  googleAvailable: boolean
  rating: GoogleRatingSummary
  pendingCount: number
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-border bg-surface px-3 py-2">
        {shortUrl ? (
          <p className="flex min-w-0 items-center gap-1.5 text-body text-ink">
            <CheckCircle2 className="size-4 shrink-0 text-success-ink" aria-hidden />
            <span className="truncate font-mono text-ink-secondary">{shortUrl}</span>
            <Link
              href="/beallitasok/cegadatok"
              className="ml-1 inline-flex shrink-0 items-center gap-0.5 text-hint font-medium text-ink hover:underline"
            >
              Módosítás
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-body text-warning-ink">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {googleAvailable
              ? 'Nincs értékelő link: egyik csatorna sem működik.'
              : 'Futtasd a 20261003 migrációt, majd add meg az értékelő linket.'}
            <Link
              href="/beallitasok/cegadatok"
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'ml-2')}
            >
              Értékelő link megadása
            </Link>
          </p>
        )}
        <RatingBadge rating={rating} />
      </div>

      <nav aria-label="Google értékelések nézetek" className="flex gap-1 border-b border-border">
        {REVIEW_TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'attekintes' ? '?' : `?tab=${t.key}`}
            aria-current={t.key === active ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-body no-underline transition-colors',
              t.key === active
                ? 'border-ink font-medium text-ink'
                : 'border-transparent text-ink-secondary hover:text-ink'
            )}
          >
            {t.label}
            {t.key === 'utemezett' && pendingCount > 0 ? (
              <span className="rounded-full bg-subtle px-1.5 text-hint tabular-nums text-ink-secondary">
                {nf.format(pendingCount)}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  )
}

function RatingBadge({ rating }: { rating: GoogleRatingSummary }) {
  if (!rating.available) return null
  if (rating.rating == null || rating.count == null) {
    return (
      <p className="text-hint text-ink-muted">
        {rating.hasPlaceId
          ? 'Google csillagátlag: első frissítés még nem futott.'
          : 'Csillagátlaghoz writereview link vagy Place ID (ChIJ…) kell a Cégadatokban.'}
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-body tabular-nums text-ink">
      <Star className="size-4 fill-current text-ink" aria-hidden />
      <span className="font-semibold">{rating.rating.toLocaleString('hu-HU')}</span>
      <span className="text-ink-secondary">· {nf.format(rating.count)} értékelés</span>
      {rating.delta30d != null && rating.delta30d > 0 ? (
        <span className="text-success-ink">· +{nf.format(rating.delta30d)} az utolsó 30 napban</span>
      ) : null}
    </p>
  )
}
