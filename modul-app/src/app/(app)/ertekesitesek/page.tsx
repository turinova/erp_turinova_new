import type { Metadata } from 'next'

import { SalesListClient } from '@/components/sales/sales-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { saleInvoiceListStatus } from '@/lib/invoicing/invoice-rules'
import { listInvoicePeersForSources } from '@/lib/invoicing/queries'
import type { InvoiceListItem } from '@/lib/invoicing/types'
import {
  parseSaleListPeriod,
  saleListPeriodRange,
  type SaleListPeriod
} from '@/lib/sales/list-period'
import type { SaleChannel, SaleStatus } from '@/lib/sales/parse'
import { listSales, type SaleListResult } from '@/lib/sales/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Értékesítések' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseStatus(raw: string | undefined): SaleStatus | 'all' {
  if (
    raw === 'fulfilled' ||
    raw === 'partially_returned' ||
    raw === 'returned' ||
    raw === 'cancelled' ||
    raw === 'draft' ||
    raw === 'confirmed'
  ) {
    return raw
  }
  return 'all'
}

function parseChannel(raw: string | undefined): SaleChannel | 'all' {
  if (raw === 'pos' || raw === 'manual' || raw === 'webshop') return raw
  return 'all'
}

export default async function ErtekesitesekPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  /** Kereséskor a státusz UI-n is „Mind” — a query amúgy is ignore-olja. */
  const status: SaleStatus | 'all' = q
    ? 'all'
    : parseStatus(typeof sp.status === 'string' ? sp.status : undefined)
  const channel = parseChannel(
    typeof sp.channel === 'string' ? sp.channel : undefined
  )
  const period: SaleListPeriod = parseSaleListPeriod(
    typeof sp.period === 'string' ? sp.period : undefined
  )
  const { createdFrom, createdTo } = saleListPeriodRange(period)
  const shiftId =
    typeof sp.shift === 'string' && sp.shift.length > 0 ? sp.shift : undefined
  const archivedOnly = sp.archived === '1'

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
          status: archivedOnly ? 'all' : status,
          channel,
          createdFrom,
          createdTo,
          page,
          limit: 25,
          posShiftId: shiftId,
          archivedOnly
        })

        if (result.rows.length > 0) {
          const peers = await listInvoicePeersForSources(
            supabase,
            user.tenantId,
            result.rows.map((r) => ({ type: 'sale', id: r.id }))
          )
          const bySale = new Map<string, InvoiceListItem[]>()
          for (const inv of peers) {
            if (
              inv.related_source_type !== 'sale' ||
              !inv.related_source_id
            ) {
              continue
            }
            const arr = bySale.get(inv.related_source_id) ?? []
            arr.push(inv)
            bySale.set(inv.related_source_id, arr)
          }
          result = {
            ...result,
            rows: result.rows.map((row) => ({
              ...row,
              invoice_status: saleInvoiceListStatus(bySale.get(row.id) ?? [])
            }))
          }
        }
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
      status={archivedOnly ? 'all' : status}
      channel={channel}
      period={period}
      shiftId={shiftId}
      archivedOnly={archivedOnly}
      canWrite={canWrite}
      canPos={canPos}
    />
  )
}
