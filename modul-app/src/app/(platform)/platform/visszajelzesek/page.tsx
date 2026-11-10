import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PlatformFeedbackClient } from '@/components/platform/platform-feedback-client'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  listPlatformPartnerFeedback,
  type PlatformFeedbackKindFilter
} from '@/lib/platform/feedback-queries'

export const metadata: Metadata = {
  title: 'Visszajelzések'
}

type SearchParams = Promise<{
  page?: string
  unreviewed?: string
  tag?: string
  kind?: string
}>

function parseKind(raw: string | undefined): PlatformFeedbackKindFilter {
  if (raw === 'nps' || raw === 'suggestion' || raw === 'detractor') return raw
  return 'all'
}

export default async function PlatformFeedbackPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const page = Math.max(1, Number(params.page) || 1)
  const onlyUnreviewed = params.unreviewed === '1'
  const tag = params.tag?.trim() || null
  const kind = parseKind(params.kind)

  let result: Awaited<ReturnType<typeof listPlatformPartnerFeedback>>
  try {
    result = await listPlatformPartnerFeedback(ctx.admin, {
      page,
      limit: 25,
      onlyUnreviewed,
      tag,
      kind
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Nem sikerült betölteni.'
    return (
      <p className="text-body text-danger-ink" role="alert">
        {message}
      </p>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-3" aria-busy="true" aria-label="Betöltés">
          <div className="h-7 w-48 animate-pulse rounded bg-subtle" />
          <div className="h-64 animate-pulse rounded-md border border-border bg-subtle" />
        </div>
      }
    >
      <PlatformFeedbackClient
        rows={result.rows}
        total={result.total}
        page={result.page}
        limit={result.limit}
        unreviewedCount={result.unreviewedCount}
        onlyUnreviewed={onlyUnreviewed}
        tagCounts={result.tagCounts}
        activeTag={tag}
        kind={kind}
        npsSummary={result.npsSummary}
      />
    </Suspense>
  )
}
