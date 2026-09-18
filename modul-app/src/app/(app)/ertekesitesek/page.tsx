import type { Metadata } from 'next'

import { SalesListClient } from '@/components/sales/sales-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { listSales, type SaleListResult } from '@/lib/sales/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Értékesítések' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ErtekesitesekPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const statusRaw = typeof sp.status === 'string' ? sp.status : 'all'
  const status =
    statusRaw === 'fulfilled' ||
    statusRaw === 'partially_returned' ||
    statusRaw === 'returned' ||
    statusRaw === 'cancelled' ||
    statusRaw === 'draft' ||
    statusRaw === 'confirmed'
      ? statusRaw
      : ('all' as const)
  const shiftId =
    typeof sp.shift === 'string' && sp.shift.length > 0 ? sp.shift : undefined

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')
  const canPos = Boolean(user?.allowedPages.includes('/pos'))

  let result: SaleListResult = { rows: [], total: 0, page: 1, limit: 25 }
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        result = await listSales(supabase, {
          tenantId: user.tenantId,
          q,
          status,
          page,
          limit: 25,
          posShiftId: shiftId
        })
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az értékesítéseket.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Futtasd a sales migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Értékesítések</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260509_sales_orders.sql
          </code>{' '}
          (+ visszáru:{' '}
          <code className="text-hint">20260513_sale_returns.sql</code>) fájlt.
        </p>
      </div>
    )
  }

  return (
    <SalesListClient
      initialRows={result.rows}
      total={result.total}
      page={result.page}
      limit={result.limit}
      q={q}
      status={status}
      shiftId={shiftId}
      canWrite={canWrite}
      canPos={canPos}
    />
  )
}
