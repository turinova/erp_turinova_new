'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FileText, Plus, Search } from 'lucide-react'

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
import { formatMoneyFt } from '@/lib/sales/parse'
import {
  SALES_QUOTE_STATUS_LABEL,
  salesQuoteStatusTone,
  type SalesQuoteStatus
} from '@/lib/sales-quotes/parse'
import type { SalesQuoteListItem } from '@/lib/sales-quotes/queries'
import { cn } from '@/lib/utils'

type Props = {
  initialRows: SalesQuoteListItem[]
  total: number
  page: number
  limit: number
  q: string
  status: SalesQuoteStatus | 'all'
  canWrite: boolean
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

const STATUS_FILTERS: { value: SalesQuoteStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'draft', label: 'Piszkozat' },
  { value: 'sent', label: 'Kiküldve' },
  { value: 'accepted', label: 'Elfogadva' },
  { value: 'lost', label: 'Elveszett' },
  { value: 'expired', label: 'Lejárt' }
]

export function SalesQuotesListClient({
  initialRows,
  total,
  page,
  limit,
  q: initialQ,
  status: initialStatus,
  canWrite
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQ)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function pushParams(next: {
    q?: string
    page?: number
    status?: SalesQuoteStatus | 'all'
  }) {
    const params = new URLSearchParams()
    const q = next.q ?? search
    const p = next.page ?? 1
    const status = next.status ?? initialStatus
    if (q.trim()) params.set('q', q.trim())
    if (status && status !== 'all') params.set('status', status)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    router.push(
      qs
        ? `/ertekesitesek/arajanlatok?${qs}`
        : '/ertekesitesek/arajanlatok'
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Árajánlatok"
        description="Termék árajánlat — nincs készletmozgás, amíg eladás nem készül belőle. (Nem lapszabászat.)"
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => router.push('/ertekesitesek/arajanlatok/uj')}
            >
              <Plus className="size-3.5" aria-hidden />
              Új árajánlat
            </Button>
          ) : null
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
          <label className="sr-only" htmlFor="sq-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="sq-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szám / ügyfél…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Keresés
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const active = initialStatus === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => pushParams({ status: f.value, page: 1 })}
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

      {initialRows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <FileText className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">Még nincs árajánlat</p>
            <p className="mt-1 text-body text-ink-secondary">
              Írj papír árajánlatot termékekre — készlet csak az eladáskor
              csökken.
            </p>
          </div>
          {canWrite ? (
            <Button
              type="button"
              onClick={() => router.push('/ertekesitesek/arajanlatok/uj')}
            >
              Új árajánlat
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
              <DataTableHeaderCell>Raktár</DataTableHeaderCell>
              <DataTableHeaderCell align="right">
                Bruttó (Ft)
              </DataTableHeaderCell>
              <DataTableHeaderCell>Érvényes</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => (
              <DataTableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() =>
                  router.push(`/ertekesitesek/arajanlatok/${row.id}`)
                }
              >
                <DataTableCell>
                  <Link
                    href={`/ertekesitesek/arajanlatok/${row.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.quote_number}
                  </Link>
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.customer_name ?? '—'}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.warehouse_name}
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="font-semibold tabular-nums">
                    {formatMoneyFt(row.total_gross)} Ft
                  </span>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {formatDate(row.valid_until)}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={salesQuoteStatusTone(row.status)}>
                    {SALES_QUOTE_STATUS_LABEL[row.status]}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {formatDate(row.created_at)}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {total > 0 && totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-body text-ink-secondary">
          <span>
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => pushParams({ page: page - 1 })}
            >
              Előző
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
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
