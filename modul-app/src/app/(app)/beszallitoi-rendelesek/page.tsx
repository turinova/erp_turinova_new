import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PurchaseOrdersListClient } from '@/components/purchase-orders/purchase-orders-list-client'
import { getSessionUser } from '@/lib/auth/session'
import type { PurchaseOrderStatus } from '@/lib/purchase-orders/parse'
import { PO_STATUSES } from '@/lib/purchase-orders/parse'
import { listPurchaseOrders } from '@/lib/purchase-orders/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Beszállítói rendelések'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  status?: string
}>

function parseStatus(raw?: string): PurchaseOrderStatus | 'all' {
  if (raw && (PO_STATUSES as readonly string[]).includes(raw)) {
    return raw as PurchaseOrderStatus
  }
  return 'all'
}

export default async function BeszallitoiRendelesekPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const status = parseStatus(params.status)

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof listPurchaseOrders>>['rows'] = []
  let total = 0
  let limit = 25
  let statusCounts: Awaited<
    ReturnType<typeof listPurchaseOrders>
  >['statusCounts'] = {
    all: 0,
    draft: 0,
    ordered: 0,
    partial: 0,
    received: 0,
    cancelled: 0
  }

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const result = await listPurchaseOrders(supabase, {
          tenantId: user.tenantId,
          q: q || undefined,
          status,
          page,
          limit: 25
        })
        rows = result.rows
        total = result.total
        limit = result.limit
        statusCounts = result.statusCounts
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a rendeléseket.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a purchase_orders migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Beszállítói rendelések</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260502_purchase_orders.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <PurchaseOrdersListClient
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        canWrite={canWrite}
        initialQ={q}
        initialStatus={status}
        statusCounts={statusCounts}
      />
    </Suspense>
  )
}
