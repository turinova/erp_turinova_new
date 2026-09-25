'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Star } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  REVIEWS_PAGE_SIZE,
  type AdminReviewRow,
  type ReviewStatus
} from '@/lib/webshop/reviews'
import { moderateProductReview } from '@/lib/webshop/storefront-actions'

type Props = {
  rows: AdminReviewRow[]
  total: number
  pendingCount: number
  status: ReviewStatus | 'all'
  page: number
  canWrite: boolean
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Jóváhagyásra vár',
  approved: 'Megjelenik',
  rejected: 'Elutasítva'
}

const STATUS_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral'
} as const

const FILTERS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Jóváhagyásra vár' },
  { value: 'approved', label: 'Megjelenik' },
  { value: 'rejected', label: 'Elutasítva' },
  { value: 'all', label: 'Összes' }
]

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} / 5 csillag`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            'size-3.5',
            i <= rating ? 'fill-ink text-ink' : 'text-ink-muted'
          )}
          aria-hidden
        />
      ))}
      <span className="ml-1 text-hint tabular-nums text-ink-secondary">
        {rating}/5
      </span>
    </span>
  )
}

function ReviewCard({
  row,
  canWrite
}: {
  row: AdminReviewRow
  canWrite: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [reply, setReply] = useState(row.sellerReply ?? '')
  const [replyOpen, setReplyOpen] = useState(false)

  function run(input: { status?: ReviewStatus; sellerReply?: string }, msg: string) {
    startTransition(async () => {
      const result = await moderateProductReview({ id: row.id, ...input })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(msg)
      setReplyOpen(false)
      router.refresh()
    })
  }

  return (
    <li className="rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={row.rating} />
            <StatusBadge tone={STATUS_TONE[row.status]}>
              {STATUS_LABEL[row.status]}
            </StatusBadge>
          </div>
          <p className="text-body font-semibold text-ink">
            {row.title || 'Értékelés'}
          </p>
          <p className="text-hint text-ink-secondary">
            {row.authorName}
            {row.authorEmail ? ` · ${row.authorEmail}` : ''} ·{' '}
            {new Date(row.createdAt).toLocaleDateString('hu-HU')}
            {row.variantLabel ? ` · ${row.variantLabel}` : ''}
          </p>
          <p className="text-hint text-ink-secondary">
            Termék:{' '}
            {row.productSlug ? (
              <Link
                href={`/p/${encodeURIComponent(row.productSlug)}`}
                target="_blank"
                className="inline-flex items-center gap-1 font-medium text-ink underline-offset-2 hover:underline"
              >
                {row.productName}
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            ) : (
              <span className="font-medium text-ink">{row.productName}</span>
            )}
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-1.5">
            {row.status !== 'approved' ? (
              <Button
                type="button"
                size="sm"
                loading={pending}
                onClick={() => run({ status: 'approved' }, 'Értékelés jóváhagyva.')}
              >
                Jóváhagyás
              </Button>
            ) : null}
            {row.status !== 'rejected' ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ status: 'rejected' }, 'Értékelés elutasítva.')}
              >
                Elutasítás
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setReplyOpen((v) => !v)}
            >
              {row.sellerReply ? 'Válasz szerkesztése' : 'Válasz írása'}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-body text-ink">{row.body}</p>

      {row.sellerReply && !replyOpen ? (
        <div className="mt-2 rounded-md bg-subtle px-2.5 py-2">
          <p className="text-hint font-semibold text-ink">Eladó válasza</p>
          <p className="mt-0.5 whitespace-pre-wrap text-body text-ink-secondary">
            {row.sellerReply}
          </p>
        </div>
      ) : null}

      {replyOpen ? (
        <div className="mt-2 space-y-1.5">
          <label htmlFor={`reply-${row.id}`} className="text-label font-semibold text-ink">
            Nyilvános válasz
          </label>
          <Textarea
            id={`reply-${row.id}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={pending}
          />
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => setReplyOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              size="sm"
              loading={pending}
              onClick={() => run({ sellerReply: reply }, 'Válasz mentve.')}
            >
              Válasz mentése
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function WebshopReviewsClient({
  rows,
  total,
  pendingCount,
  status,
  page,
  canWrite
}: Props) {
  const pages = Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE))
  const href = (s: string, p: number) =>
    `/webshop/ertekelesek?status=${s}${p > 1 ? `&page=${p}` : ''}`

  return (
    <div className="pb-14">
      <PageHeader
        title="Értékelések"
        description="Vásárlói vélemények — csak a jóváhagyott jelenik meg a termékoldalon."
      />

      <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Szűrés státusz szerint">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(f.value, 1)}
            aria-current={status === f.value ? 'page' : undefined}
            className={cn(
              'inline-flex h-7 items-center rounded-md border px-2.5 text-hint font-medium',
              status === f.value
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
            )}
          >
            {f.label}
            {f.value === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p
          className="max-w-xl rounded-md border border-border bg-subtle p-3 text-body text-ink-secondary"
          role="status"
        >
          Nincs értékelés ebben a nézetben.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <ReviewCard key={row.id} row={row} canWrite={canWrite} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-hint text-ink-secondary">
          <span className="tabular-nums">
            {page}. oldal / {pages} · {total} értékelés
          </span>
          <div className="flex gap-1.5">
            {page > 1 ? (
              <Link
                href={href(status, page - 1)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 font-medium text-ink hover:bg-subtle"
              >
                Előző
              </Link>
            ) : null}
            {page < pages ? (
              <Link
                href={href(status, page + 1)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 font-medium text-ink hover:bg-subtle"
              >
                Következő
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
