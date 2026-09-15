import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PlatformTenantsClient } from '@/components/platform/platform-tenants-client'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { listPlatformTenants } from '@/lib/platform/queries'
import type { TenantStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = {
  title: 'Cégek'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  status?: string
}>

const STATUSES: TenantStatus[] = [
  'provisioning',
  'active',
  'read_only',
  'suspended',
  'churned'
]

export default async function PlatformTenantsPage({
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

  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const statusRaw = params.status?.trim()
  const status =
    statusRaw && STATUSES.includes(statusRaw as TenantStatus)
      ? (statusRaw as TenantStatus)
      : 'all'

  const result = await listPlatformTenants(ctx.admin, {
    q: q || undefined,
    status,
    page,
    limit: 25
  })

  return (
    <Suspense fallback={null}>
      <PlatformTenantsClient
        rows={result.rows}
        total={result.total}
        page={result.page}
        limit={result.limit}
        initialQ={q}
        initialStatus={status}
      />
    </Suspense>
  )
}
