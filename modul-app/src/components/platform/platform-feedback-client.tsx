'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  NPS_GROUP_LABEL,
  feedbackPromptVariant,
  feedbackTagLabel
} from '@/lib/partner/feedback-copy'
import { markPartnerFeedbackReviewedAction } from '@/lib/platform/feedback-actions'
import {
  NPS_MIN_RELIABLE_N,
  type PlatformFeedbackKindFilter,
  type PlatformFeedbackListItem,
  type PlatformFeedbackTagCount,
  type PlatformNpsSummary
} from '@/lib/platform/feedback-queries'
import { usePlatformHref } from '@/lib/platform/use-platform-href'
import { cn } from '@/lib/utils'

type Props = {
  rows: PlatformFeedbackListItem[]
  total: number
  page: number
  limit: number
  unreviewedCount: number
  onlyUnreviewed: boolean
  tagCounts: PlatformFeedbackTagCount[]
  activeTag: string | null
  kind: PlatformFeedbackKindFilter
  npsSummary: PlatformNpsSummary
}

const KIND_TABS: Array<{ id: PlatformFeedbackKindFilter; label: string }> = [
  { id: 'all', label: 'Mind' },
  { id: 'suggestion', label: 'Javaslatok' },
  { id: 'nps', label: 'Értékelések' },
  { id: 'detractor', label: 'Kritikusok' }
]

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('hu-HU', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function ScoreCell({ row }: { row: PlatformFeedbackListItem }) {
  if (row.kind === 'suggestion' || row.score === null) {
    return (
      <StatusBadge tone="info" variant="outline">
        Javaslat
      </StatusBadge>
    )
  }
  const group = feedbackPromptVariant(row.score)
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="tabular-nums">
        <span className="font-medium text-ink">{row.score}</span>
        <span className="text-ink-muted">/10</span>
      </span>
      <StatusBadge
        tone={group === 'low' ? 'danger' : group === 'mid' ? 'neutral' : 'success'}
      >
        {NPS_GROUP_LABEL[group]}
      </StatusBadge>
    </div>
  )
}

function NpsSummaryBar({ summary }: { summary: PlatformNpsSummary }) {
  if (summary.n === 0) {
    return (
      <p className="text-hint text-ink-secondary">
        NPS ({summary.windowDays} nap): még nincs értékelés.
      </p>
    )
  }
  const pct = (v: number) => `${Math.round((v / summary.n) * 100)}%`
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-hint text-ink-secondary">
          NPS ({summary.windowDays} nap)
        </span>
        <span className="text-[20px] font-semibold tabular-nums text-ink">
          {summary.nps !== null && summary.nps > 0 ? '+' : ''}
          {summary.nps}
        </span>
        <span className="text-hint text-ink-secondary">
          n = <span className="tabular-nums text-ink">{summary.n}</span>
        </span>
        {summary.n < NPS_MIN_RELIABLE_N ? (
          <StatusBadge tone="warning" variant="outline">
            Kevés adat
          </StatusBadge>
        ) : null}
      </div>
      <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-subtle" aria-hidden>
        <div className="bg-success" style={{ width: pct(summary.promoters) }} />
        <div className="bg-border-strong" style={{ width: pct(summary.passives) }} />
        <div className="bg-danger" style={{ width: pct(summary.detractors) }} />
      </div>
      <p className="mt-1.5 text-hint text-ink-secondary">
        Promóter {summary.promoters} ({pct(summary.promoters)}) · Passzív{' '}
        {summary.passives} ({pct(summary.passives)}) · Kritikus{' '}
        {summary.detractors} ({pct(summary.detractors)})
      </p>
    </div>
  )
}

export function PlatformFeedbackClient({
  rows,
  total,
  page,
  limit,
  unreviewedCount,
  onlyUnreviewed,
  tagCounts,
  activeTag,
  kind,
  npsSummary
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const href = usePlatformHref()
  const [pending, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function markReviewed(id: string) {
    startTransition(async () => {
      const res = await markPartnerFeedbackReviewedAction(id)
      if (!res.ok) {
        toast.error(res.message ?? 'Nem sikerült.')
        return
      }
      toast.success('Megjelölve megnézveként.')
      router.refresh()
    })
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-h1 text-ink">Visszajelzések</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Partner portál: NPS értékelések (0–10) és szabad javaslatok.
        </p>
      </div>

      <div className="mb-3">
        <NpsSummaryBar summary={npsSummary} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Típus"
          className="inline-flex flex-wrap gap-0.5 rounded-[6px] border border-border bg-subtle p-0.5"
        >
          {KIND_TABS.map((tab) => {
            const active = kind === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  pushParams({
                    kind: tab.id === 'all' ? null : tab.id,
                    page: null
                  })
                }
                className={cn(
                  'inline-flex h-8 items-center rounded-[5px] px-2.5 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-ink text-white'
                    : 'text-ink-secondary hover:bg-surface hover:text-ink'
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          aria-pressed={onlyUnreviewed}
          onClick={() =>
            pushParams({ unreviewed: onlyUnreviewed ? null : '1', page: null })
          }
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors',
            onlyUnreviewed
              ? 'border-ink bg-ink text-white'
              : 'border-border bg-surface text-ink-secondary hover:text-ink'
          )}
        >
          Csak megnézetlen
          <span
            className={cn(
              'tabular-nums',
              onlyUnreviewed ? 'text-white/80' : 'text-ink-muted'
            )}
          >
            {unreviewedCount}
          </span>
        </button>
      </div>

      {tagCounts.length > 0 ? (
        <div className="mb-3">
          <p className="mb-1.5 text-hint text-ink-secondary">Miről szólnak:</p>
          <div className="flex flex-wrap gap-1.5">
            {tagCounts.map((t) => {
              const active = activeTag === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    pushParams({ tag: active ? null : t.id, page: null })
                  }
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium transition-colors',
                    active
                      ? 'border-ink bg-ink text-white'
                      : 'border-border bg-surface text-ink-secondary hover:text-ink'
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      'tabular-nums',
                      active ? 'text-white/80' : 'text-ink-muted'
                    )}
                  >
                    {t.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          {activeTag || kind !== 'all' || onlyUnreviewed
            ? 'Nincs visszajelzés ezzel a szűréssel.'
            : 'Még nem érkezett partner visszajelzés.'}
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Dátum</DataTableHeaderCell>
                <DataTableHeaderCell>Típus / pont</DataTableHeaderCell>
                <DataTableHeaderCell>Partner</DataTableHeaderCell>
                <DataTableHeaderCell>Cég</DataTableHeaderCell>
                <DataTableHeaderCell>Javaslat</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">Művelet</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="whitespace-nowrap text-hint">
                    {formatWhen(row.createdAt)}
                    {!row.reviewedAt ? (
                      <div className="mt-1">
                        <StatusBadge tone="warning">Új</StatusBadge>
                      </div>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>
                    <ScoreCell row={row} />
                  </DataTableCell>
                  <DataTableCell>
                    {row.partnerUserId ? (
                      <Link
                        href={href(`/partnerek/${row.partnerUserId}`)}
                        className="font-medium text-ink no-underline hover:underline"
                      >
                        {row.partnerName ?? '—'}
                      </Link>
                    ) : (
                      <span className="text-hint text-ink-muted">Törölt fiók</span>
                    )}
                    {row.partnerEmail ? (
                      <p className="text-hint text-ink-secondary">{row.partnerEmail}</p>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="text-body text-ink-secondary">
                    {row.companyName ?? '—'}
                  </DataTableCell>
                  <DataTableCell className="max-w-[320px]">
                    {row.tags.length > 0 ? (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {row.tags.map((t) => (
                          <StatusBadge key={t} tone="neutral" variant="outline">
                            {feedbackTagLabel(t)}
                          </StatusBadge>
                        ))}
                      </div>
                    ) : null}
                    {row.comment ? (
                      <p className="line-clamp-3 text-body text-ink">{row.comment}</p>
                    ) : row.tags.length === 0 ? (
                      <span className="text-hint text-ink-muted">—</span>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    {!row.reviewedAt ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => markReviewed(row.id)}
                      >
                        Megnézve
                      </Button>
                    ) : (
                      <span className="text-hint text-ink-muted">Kész</span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          <div className="mt-3 flex items-center justify-between gap-2 text-hint text-ink-secondary">
            <span>
              {from}–{to} / {total}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() =>
                  pushParams({ page: page <= 2 ? null : String(page - 1) })
                }
              >
                Előző
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => pushParams({ page: String(page + 1) })}
              >
                Következő
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
