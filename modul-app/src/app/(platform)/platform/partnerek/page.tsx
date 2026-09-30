import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PlatformPartnersClient } from '@/components/platform/platform-partners-client'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { listPlatformPartners } from '@/lib/platform/partner-queries'

export const metadata: Metadata = {
  title: 'Partnerek'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  link?: string
}>

export default async function PlatformPartnersPage({
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
  const q = params.q?.trim() ?? ''
  const linkRaw = params.link
  const link =
    linkRaw === 'linked' || linkRaw === 'unlinked' ? linkRaw : 'all'

  const result = await listPlatformPartners(ctx.admin, {
    q,
    link,
    page,
    limit: 25
  })

  return (
    <Suspense
      fallback={
        <div className="space-y-3" aria-busy="true" aria-label="Betöltés">
          <div className="h-7 w-48 animate-pulse rounded bg-subtle" />
          <div className="h-10 max-w-sm animate-pulse rounded-md bg-subtle" />
          <div className="h-64 animate-pulse rounded-md border border-border bg-subtle" />
        </div>
      }
    >
      <PlatformPartnersClient
        rows={result.rows}
        total={result.total}
        page={result.page}
        limit={result.limit}
        initialQ={q}
        initialLink={link}
      />
    </Suspense>
  )
}
