import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ManualQueueClient } from '@/components/manual-orders/manual-queue-client'
import { getSessionUser } from '@/lib/auth/session'
import { listManualQueue, type MoQueueResult } from '@/lib/manual-orders/queries'
import { MO_QUEUE_VIEWS, parseMoQueueView, type MoQueueView } from '@/lib/manual-orders/types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Kézi várólista' }

type SearchParams = Promise<{ view?: string; q?: string; supplier?: string; page?: string }>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EMPTY: MoQueueResult = {
  groups: [],
  chips: [],
  counts: Object.fromEntries(MO_QUEUE_VIEWS.map((v) => [v, 0])) as Record<MoQueueView, number>,
  totalItems: 0,
  page: 1,
  totalPages: 1,
  lateCount: 0,
  shelfCount: 0,
  cancelledOrderedCount: 0
}

export default async function KeziVarolistaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()
  const supabase = await createClient()
  if (!supabase) notFound()

  const view = parseMoQueueView(params.view)
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const supplier =
    params.supplier === 'none' ? 'none' : params.supplier && UUID_RE.test(params.supplier) ? params.supplier : null

  let loadError: string | null = null
  const data = await listManualQueue(supabase, user.tenantId, { view, q, page, supplierId: supplier ?? undefined }).catch(
    (e: unknown) => {
      loadError = e instanceof Error ? e.message : 'Nem sikerült betölteni.'
      return EMPTY
    }
  )

  return (
    <ManualQueueClient
      data={data}
      view={view}
      q={q}
      supplier={supplier}
      canWrite={Boolean(user.role && user.role !== 'viewer')}
      loadError={loadError}
    />
  )
}
