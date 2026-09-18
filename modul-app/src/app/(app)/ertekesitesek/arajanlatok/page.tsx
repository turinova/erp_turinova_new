import type { Metadata } from 'next'

import { SalesQuotesListClient } from '@/components/sales-quotes/sales-quotes-list-client'
import { getSessionUser } from '@/lib/auth/session'
import type { SalesQuoteStatus } from '@/lib/sales-quotes/parse'
import {
  listSalesQuotes,
  type SalesQuoteListItem
} from '@/lib/sales-quotes/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Árajánlatok' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const STATUSES = new Set<SalesQuoteStatus>([
  'draft',
  'sent',
  'accepted',
  'lost',
  'expired',
  'cancelled'
])

export default async function ArajnlatokPage({
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
    statusRaw !== 'all' && STATUSES.has(statusRaw as SalesQuoteStatus)
      ? (statusRaw as SalesQuoteStatus)
      : ('all' as const)

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let rows: SalesQuoteListItem[] = []
  let total = 0
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const result = await listSalesQuotes(supabase, {
          tenantId: user.tenantId,
          q,
          status,
          page,
          limit: 25
        })
        rows = result.rows
        total = result.total
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az árajánlatokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError = 'Dev bypass módban nincs tenant adatbázis.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Árajánlatok</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260515_sales_quotes.sql
          </code>{' '}
          fájlt.
        </p>
      </div>
    )
  }

  return (
    <SalesQuotesListClient
      initialRows={rows}
      total={total}
      page={page}
      limit={25}
      q={q}
      status={status}
      canWrite={canWrite}
    />
  )
}
