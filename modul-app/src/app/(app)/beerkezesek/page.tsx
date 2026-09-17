import type { Metadata } from 'next'

import { GoodsReceiptsListClient } from '@/components/goods-receipts/goods-receipts-list-client'
import { getSessionUser } from '@/lib/auth/session'
import {
  listGoodsReceipts,
  type GoodsReceiptListResult
} from '@/lib/goods-receipts/queries'
import type { GoodsReceiptStatus } from '@/lib/goods-receipts/parse'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Beérkezések'
}

const STATUSES = new Set<GoodsReceiptStatus>([
  'checking',
  'received',
  'cancelled'
])

function parseStatus(raw: string | undefined): GoodsReceiptStatus | 'all' {
  if (!raw || raw === 'all') return 'all'
  if (STATUSES.has(raw as GoodsReceiptStatus)) {
    return raw as GoodsReceiptStatus
  }
  return 'all'
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function BeerkezesekPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  const status = parseStatus(typeof sp.status === 'string' ? sp.status : undefined)
  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let result: GoodsReceiptListResult = {
    rows: [],
    total: 0,
    page: 1,
    limit: 25,
    statusCounts: { all: 0, checking: 0, received: 0, cancelled: 0 }
  }
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        result = await listGoodsReceipts(supabase, {
          tenantId: user.tenantId,
          q,
          status,
          page,
          limit: 25
        })
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a beérkezéseket.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Futtasd a goods receipts migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Beérkezések</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260504_goods_receipts_and_stock.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben.
        </p>
      </div>
    )
  }

  return (
    <GoodsReceiptsListClient
      initialRows={result.rows}
      total={result.total}
      page={result.page}
      limit={result.limit}
      q={q}
      status={status}
      statusCounts={result.statusCounts}
      canWrite={canWrite}
    />
  )
}
