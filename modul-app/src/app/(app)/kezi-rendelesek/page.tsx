import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ManualOrdersListClient } from '@/components/manual-orders/manual-orders-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { listManualOrders, MO_PAGE_SIZE } from '@/lib/manual-orders/queries'
import { MO_ITEM_STATUSES, type MoItemStatus } from '@/lib/manual-orders/types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Kézi rendelések' }

type SearchParams = Promise<{ q?: string; page?: string; status?: string }>

type Filter = MoItemStatus | 'mind'

const EMPTY_COUNTS = Object.fromEntries(
  [...MO_ITEM_STATUSES, 'mind'].map((k) => [k, 0])
) as Record<Filter, number>

function asFilter(raw: string | undefined): Filter {
  if (raw === 'mind') return 'mind'
  return (MO_ITEM_STATUSES as readonly string[]).includes(raw ?? '') ? (raw as MoItemStatus) : 'nyitott'
}

export default async function KeziRendelesekPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()
  const supabase = await createClient()
  if (!supabase) notFound()

  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const status = asFilter(params.status)

  let data: Awaited<ReturnType<typeof listManualOrders>> = { rows: [], total: 0, counts: EMPTY_COUNTS }
  let loadError: string | null = null
  try {
    data = await listManualOrders(supabase, user.tenantId, { q, page, status })
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Nem sikerült betölteni.'
  }

  return (
    <ManualOrdersListClient
      rows={data.rows}
      total={data.total}
      counts={data.counts}
      page={page}
      pageSize={MO_PAGE_SIZE}
      status={status}
      q={q}
      canWrite={Boolean(user.role && user.role !== 'viewer')}
      loadError={loadError}
    />
  )
}
