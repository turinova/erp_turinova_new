'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Download, Receipt, Search, Settings } from 'lucide-react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  enrichInvoiceRow,
  INVOICE_LIFECYCLE_LABEL,
  invoiceLifecycleTone
} from '@/lib/invoicing/invoice-rules'
import {
  invoiceTypeLabel,
  type InvoiceListItem
} from '@/lib/invoicing/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

export type InvoiceListView =
  | 'awaiting'
  | 'all'
  | 'invoices'
  | 'stornos'

type Props = {
  initialRows: InvoiceListItem[]
  peers: InvoiceListItem[]
  lookupRows?: InvoiceListItem[]
  total: number
  page: number
  limit: number
  q: string
  view: InvoiceListView
  canWrite: boolean
  awaitingCount?: number
  awaitingSumFt?: number
  /** Lista base path (default /szamlak) */
  basePath?: string
  title?: string
  description?: string
  /** Üres lista CTA */
  emptyCtaHref?: string
  emptyCtaLabel?: string
  /** Forrás oszlop fejléc */
  sourceColumnLabel?: string
}

const VIEW_FILTERS: { value: InvoiceListView; label: string }[] = [
  { value: 'awaiting', label: 'Fizetésre vár' },
  { value: 'all', label: 'Mind' },
  { value: 'invoices', label: 'Számlák' },
  { value: 'stornos', label: 'Sztornók' }
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

function invoiceTypeTone(
  type: InvoiceListItem['invoice_type']
): 'warning' | 'success' | 'danger' | 'info' | 'neutral' {
  if (type === 'dijbekero') return 'warning'
  if (type === 'szamla') return 'success'
  if (type === 'sztorno') return 'danger'
  if (type === 'elolegszamla') return 'info'
  return 'neutral'
}

function displayNumber(row: InvoiceListItem) {
  return row.provider_invoice_number?.trim() || row.internal_number
}

function sourceHref(row: InvoiceListItem): string | null {
  if (!row.related_source_id) return null
  if (row.related_source_type === 'sale') {
    return `/ertekesitesek/${row.related_source_id}`
  }
  if (row.related_source_type === 'opti_order') {
    return `/ajanlatok/${row.related_source_id}`
  }
  return null
}

export function InvoicesListClient({
  initialRows,
  peers,
  lookupRows = [],
  total,
  page,
  limit,
  q: initialQ,
  view,
  canWrite,
  awaitingCount,
  awaitingSumFt,
  basePath = '/szamlak',
  title = 'Bizonylatok',
  description = 'Díjbekérő, számla, sztornó — eladás és lapszabászat megrendelés.',
  emptyCtaHref = '/ertekesitesek',
  emptyCtaLabel = 'Értékesítések',
  sourceColumnLabel = 'Eladás'
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQ)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const peersBySource = useMemo(() => {
    const map = new Map<string, InvoiceListItem[]>()
    for (const p of peers) {
      if (!p.related_source_id) continue
      const key = `${p.related_source_type}:${p.related_source_id}`
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    return map
  }, [peers])

  const lookupAll = useMemo(() => {
    const byId = new Map<string, InvoiceListItem>()
    for (const r of [...peers, ...lookupRows, ...initialRows]) {
      byId.set(r.id, r)
    }
    return [...byId.values()]
  }, [peers, lookupRows, initialRows])

  const enriched = useMemo(() => {
    return initialRows.map((row) => {
      const key = row.related_source_id
        ? `${row.related_source_type}:${row.related_source_id}`
        : ''
      const rowPeers = key ? (peersBySource.get(key) ?? [row]) : [row]
      return {
        row,
        meta: enrichInvoiceRow(row, rowPeers, lookupAll)
      }
    })
  }, [initialRows, peersBySource, lookupAll])

  function pushParams(next: {
    q?: string
    page?: number
    view?: InvoiceListView
  }) {
    const params = new URLSearchParams()
    const q = next.q ?? search
    const p = next.page ?? 1
    const v = next.view ?? view
    if (q.trim()) params.set('q', q.trim())
    if (v && v !== 'awaiting') params.set('view', v)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/beallitasok/szamlazas')}
          >
            <Settings className="size-3.5" aria-hidden />
            Beállítások
          </Button>
        }
      />

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          pushParams({ q: search, page: 1 })
        }}
      >
        <div className="relative min-w-[14rem] flex-1">
          <label className="sr-only" htmlFor="inv-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="inv-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szám / vevő…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Keresés
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {VIEW_FILTERS.map((f) => {
          const active = view === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => pushParams({ view: f.value, page: 1 })}
              className={cn(
                'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
                active
                  ? 'bg-ink text-surface'
                  : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {view === 'awaiting' &&
      awaitingCount != null &&
      awaitingCount > 0 &&
      awaitingSumFt != null ? (
        <p
          className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary"
          role="status"
        >
          Kinnlevő ·{' '}
          <span className="font-semibold tabular-nums text-ink">
            {formatMoneyFt(awaitingSumFt)} Ft
          </span>
          <span className="text-ink-muted">
            {' '}
            · {awaitingCount} díjbekérő
          </span>
        </p>
      ) : null}

      {initialRows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <Receipt className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">
              {view === 'awaiting'
                ? 'Nincs fizetésre váró díjbekérő'
                : 'Még nincs bizonylat'}
            </p>
            <p className="mt-1 text-body text-ink-secondary">
              {view === 'awaiting'
                ? 'Nincs kinnlevő tétel.'
                : emptyCtaHref.includes('ajanlat')
                  ? 'Állíts ki bizonylatot egy lapszabászati megrendelésről.'
                  : 'Állíts ki bizonylatot egy értékesítésről.'}
            </p>
          </div>
          {view !== 'awaiting' && canWrite ? (
            <Button
              type="button"
              onClick={() => router.push(emptyCtaHref)}
            >
              {emptyCtaLabel}
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Vevő</DataTableHeaderCell>
              <DataTableHeaderCell>{sourceColumnLabel}</DataTableHeaderCell>
              <DataTableHeaderCell>Típus</DataTableHeaderCell>
              <DataTableHeaderCell align="right">
                Bruttó (Ft)
              </DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell>
                {view === 'awaiting' ? 'Határidő' : 'Dátum'}
              </DataTableHeaderCell>
              <DataTableHeaderCell className="w-[4.5rem]">
                <span className="sr-only">PDF</span>
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {enriched.map(({ row, meta }) => {
              const href = sourceHref(row)
              const number = displayNumber(row)
              const dateIso =
                view === 'awaiting'
                  ? row.payment_due_date || row.created_at
                  : row.created_at
              const overdue =
                view === 'awaiting' &&
                row.payment_due_date != null &&
                row.payment_due_date.slice(0, 10) <
                  new Date().toISOString().slice(0, 10)

              const statusLabel = meta.lifecycle
                ? INVOICE_LIFECYCLE_LABEL[meta.lifecycle]
                : row.invoice_type === 'szamla'
                  ? 'Kiállítva'
                  : row.invoice_type === 'sztorno'
                    ? 'Sztornó'
                    : '—'
              const statusTone = meta.lifecycle
                ? invoiceLifecycleTone(meta.lifecycle)
                : row.invoice_type === 'szamla'
                  ? 'success'
                  : row.invoice_type === 'sztorno'
                    ? 'danger'
                    : 'neutral'
              const statusSolid =
                meta.lifecycle === 'pending' || row.invoice_type === 'szamla'

              return (
                <DataTableRow
                  key={row.id}
                  className={href ? 'cursor-pointer' : undefined}
                  onClick={() => {
                    if (href) router.push(href)
                  }}
                >
                  <DataTableCell>
                    {href ? (
                      <Link
                        href={href}
                        className="font-medium tabular-nums text-ink underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {number}
                      </Link>
                    ) : (
                      <span className="font-medium tabular-nums text-ink">
                        {number}
                      </span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.customer_name || '—'}
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {href && row.related_source_number ? (
                      <Link
                        href={href}
                        className="underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.related_source_number}
                      </Link>
                    ) : (
                      row.related_source_number || '—'
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={invoiceTypeTone(row.invoice_type)}
                      variant="soft"
                    >
                      {invoiceTypeLabel(row.invoice_type)}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell align="right">
                    <span className="font-semibold tabular-nums">
                      {row.gross_total == null
                        ? '—'
                        : `${formatMoneyFt(row.gross_total)} Ft`}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={statusTone}
                      variant={statusSolid ? 'solid' : 'soft'}
                    >
                      {statusLabel}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell
                    className={cn(
                      'tabular-nums text-ink-secondary',
                      overdue && 'font-medium text-warning-ink'
                    )}
                  >
                    {formatDate(dateIso)}
                  </DataTableCell>
                  <DataTableCell>
                    <a
                      href={`/api/invoices/${row.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-hint font-medium text-ink-secondary no-underline hover:bg-subtle hover:text-ink"
                      onClick={(e) => e.stopPropagation()}
                      title="PDF megnyitása"
                    >
                      <Download className="size-3.5" aria-hidden />
                      PDF
                    </a>
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-body text-ink-secondary">
          <span>
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => pushParams({ page: page - 1 })}
            >
              Előző
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => pushParams({ page: page + 1 })}
            >
              Következő
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
