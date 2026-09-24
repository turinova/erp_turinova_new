import type { Metadata } from 'next'

import {
  InvoicesListClient,
  type InvoiceListView
} from '@/components/invoicing/invoices-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { enrichInvoiceRow } from '@/lib/invoicing/invoice-rules'
import {
  listInvoicePeersForSources,
  listInvoices,
  listInvoicesByIds
} from '@/lib/invoicing/queries'
import type {
  InvoiceListItem,
  InvoiceSourceType,
  InvoiceType
} from '@/lib/invoicing/types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Lapszabászat bizonylatok'
}

type SearchParams = Promise<{
  page?: string
  q?: string
  search?: string
  view?: string
  type?: string
  lifecycle?: string
}>

const VIEWS = new Set(['awaiting', 'all', 'invoices', 'stornos'])
const SOURCE_TYPE: InvoiceSourceType = 'opti_order'

function resolveView(sp: {
  view?: string
  type?: string
  lifecycle?: string
}): InvoiceListView {
  if (sp.view && VIEWS.has(sp.view)) return sp.view as InvoiceListView
  if (sp.lifecycle === 'pending_proforma') return 'awaiting'
  if (sp.type === 'szamla') return 'invoices'
  if (sp.type === 'sztorno') return 'stornos'
  if (sp.type === 'dijbekero') return 'awaiting'
  return 'awaiting'
}

export default async function AjanlatokBizonylatokPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Bizonylatok</h1>
        <p className="text-body text-ink-secondary">Nincs aktív munkamenet.</p>
      </div>
    )
  }

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const q = (sp.q ?? sp.search)?.trim() || ''
  const view = resolveView(sp)
  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const limit = 25

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Bizonylatok</h1>
        <p className="text-body text-danger-ink">Nincs adatbázis kapcsolat.</p>
      </div>
    )
  }

  let rows: InvoiceListItem[] = []
  let total = 0
  let peers: InvoiceListItem[] = []
  let lookupRows: InvoiceListItem[] = []
  let awaitingCount = 0
  let awaitingSumFt = 0

  try {
    if (view === 'awaiting') {
      const dijPool = await listInvoices(supabase, user.tenantId, {
        page: 1,
        limit: 200,
        search: q || undefined,
        type: 'dijbekero',
        sourceType: SOURCE_TYPE
      })
      const dijPeers = await listInvoicePeersForSources(
        supabase,
        user.tenantId,
        dijPool.rows
          .filter((r) => r.related_source_id)
          .map((r) => ({
            type: r.related_source_type,
            id: r.related_source_id as string
          }))
      )
      const peersBySource = new Map<string, InvoiceListItem[]>()
      for (const p of dijPeers) {
        if (!p.related_source_id) continue
        const key = `${p.related_source_type}:${p.related_source_id}`
        const arr = peersBySource.get(key) ?? []
        arr.push(p)
        peersBySource.set(key, arr)
      }
      const awaitingRows = dijPool.rows.filter((row) => {
        const key = row.related_source_id
          ? `${row.related_source_type}:${row.related_source_id}`
          : ''
        const rowPeers = key ? (peersBySource.get(key) ?? [row]) : [row]
        return enrichInvoiceRow(row, rowPeers, dijPeers).lifecycle === 'pending'
      })
      awaitingCount = awaitingRows.length
      awaitingSumFt = awaitingRows.reduce(
        (s, r) => s + (r.gross_total ?? 0),
        0
      )
      total = awaitingRows.length
      const from = (page - 1) * limit
      rows = awaitingRows.slice(from, from + limit)
      peers = dijPeers
    } else {
      const typeMap: Record<
        Exclude<InvoiceListView, 'awaiting' | 'all'>,
        InvoiceType
      > = {
        invoices: 'szamla',
        stornos: 'sztorno'
      }
      const typeFilter =
        view === 'all' ? ('all' as const) : typeMap[view]

      const result = await listInvoices(supabase, user.tenantId, {
        page,
        limit,
        search: q,
        type: typeFilter,
        sourceType: SOURCE_TYPE
      })
      rows = result.rows
      total = result.total
      peers = await listInvoicePeersForSources(
        supabase,
        user.tenantId,
        rows
          .filter((r) => r.related_source_id)
          .map((r) => ({
            type: r.related_source_type,
            id: r.related_source_id as string
          }))
      )
    }

    const stornoTargetIds = rows
      .filter((r) => r.invoice_type === 'sztorno' && r.is_storno_of_invoice_id)
      .map((r) => r.is_storno_of_invoice_id as string)
    const missing = stornoTargetIds.filter(
      (id) => !peers.some((p) => p.id === id) && !rows.some((r) => r.id === id)
    )
    if (missing.length > 0) {
      lookupRows = await listInvoicesByIds(supabase, user.tenantId, missing)
    }
  } catch (err) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Bizonylatok</h1>
        <p className="rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink">
          {err instanceof Error ? err.message : 'Betöltési hiba.'}
        </p>
      </div>
    )
  }

  return (
    <InvoicesListClient
      initialRows={rows}
      peers={peers}
      lookupRows={lookupRows}
      total={total}
      page={page}
      limit={limit}
      q={q}
      view={view}
      canWrite={canWrite}
      awaitingCount={awaitingCount}
      awaitingSumFt={awaitingSumFt}
      basePath="/ajanlatok/bizonylatok"
      title="Bizonylatok"
      description="Díjbekérő, előleg, számla — lapszabászati megrendelések."
      emptyCtaHref="/ajanlatok"
      emptyCtaLabel="Lapszabászati ajánlatok"
      sourceColumnLabel="Megrendelés"
    />
  )
}
