import type { Metadata } from 'next'

import { StockTransfersListClient } from '@/components/stock-transfers/stock-transfers-list-client'
import { getSessionUser } from '@/lib/auth/session'
import {
  listStockTransfers,
  type StockTransferListResult
} from '@/lib/stock-transfers/queries'
import { listActiveWarehouses } from '@/lib/warehouses/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Áttárolások'
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AtadasokPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let result: StockTransferListResult = {
    rows: [],
    total: 0,
    page: 1,
    limit: 25
  }
  let warehouseCount = 0
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [list, warehouses] = await Promise.all([
          listStockTransfers(supabase, {
            tenantId: user.tenantId,
            q,
            page,
            limit: 25
          }),
          listActiveWarehouses(supabase, user.tenantId)
        ])
        result = list
        warehouseCount = warehouses.length
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az áttárolásokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Futtasd a stock transfers migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Áttárolások</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260508_stock_transfers_and_movements.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben.
        </p>
      </div>
    )
  }

  return (
    <StockTransfersListClient
      initialRows={result.rows}
      total={result.total}
      page={result.page}
      limit={result.limit}
      q={q}
      canWrite={canWrite}
      warehouseCount={warehouseCount}
    />
  )
}
