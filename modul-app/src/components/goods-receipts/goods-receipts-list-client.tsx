'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { PackageCheck, Search } from 'lucide-react'

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
  RECEIPT_STATUS_LABEL,
  receiptStatusTone,
  type GoodsReceiptStatus
} from '@/lib/goods-receipts/parse'
import type { GoodsReceiptListItem } from '@/lib/goods-receipts/queries'
import { cn } from '@/lib/utils'

type StatusFilter = GoodsReceiptStatus | 'all'

type GoodsReceiptsListClientProps = {
  initialRows: GoodsReceiptListItem[]
  total: number
  page: number
  limit: number
  q: string
  status: StatusFilter
  statusCounts: Record<StatusFilter, number>
  canWrite: boolean
}

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'checking', label: 'Ellenőrzés' },
  { value: 'received', label: 'Bevételezve' }
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

export function GoodsReceiptsListClient({
  initialRows,
  total,
  page,
  limit,
  q: initialQ,
  status: initialStatus,
  statusCounts
}: GoodsReceiptsListClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQ)

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  function pushParams(next: {
    q?: string
    status?: StatusFilter
    page?: number
  }) {
    const params = new URLSearchParams()
    const q = next.q ?? search
    const status = next.status ?? initialStatus
    const p = next.page ?? 1
    if (q.trim()) params.set('q', q.trim())
    if (status !== 'all') params.set('status', status)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    router.push(qs ? `/beerkezesek?${qs}` : '/beerkezesek')
  }

  const emptyHint = useMemo(() => {
    return initialRows.length === 0 && !initialQ && initialStatus === 'all'
  }, [initialRows.length, initialQ, initialStatus])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Beérkezések"
        description="Számold meg a megérkezett árut, majd vedd készletre."
      />

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          pushParams({ q: search, page: 1 })
        }}
      >
        <div className="relative min-w-[14rem] flex-1">
          <label className="sr-only" htmlFor="receipt-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="receipt-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szám…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Keresés
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_CHIPS.map((chip) => {
          const count = statusCounts[chip.value] ?? 0
          const active = initialStatus === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() =>
                pushParams({
                  status: chip.value,
                  page: 1
                })
              }
              className={cn(
                'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
                active
                  ? 'bg-ink text-surface'
                  : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
              )}
            >
              {chip.label} ({count})
            </button>
          )
        })}
      </div>

      {emptyHint ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <PackageCheck className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">Még nincs beérkezés</p>
            <p className="mt-1 text-body text-ink-secondary">
              Nyiss egy beszállítói rendelést, jelöld megrendelve, majd az Áru
              megérkezett gombbal indítsd.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => router.push('/beszallitoi-rendelesek')}
          >
            Beszállítói rendelések
          </Button>
        </div>
      ) : initialRows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-body text-ink-secondary">
          Nincs találat a szűrőkkel.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Rendelés</DataTableHeaderCell>
              <DataTableHeaderCell>Beszállító</DataTableHeaderCell>
              <DataTableHeaderCell>Státusz</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Tételek</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => (
              <DataTableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(`/beerkezesek/${row.id}`)}
              >
                <DataTableCell>
                  <Link
                    href={`/beerkezesek/${row.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.receipt_number}
                  </Link>
                </DataTableCell>
                <DataTableCell>
                  <Link
                    href={`/beszallitoi-rendelesek/${row.purchase_order_id}`}
                    className="text-ink-secondary underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.po_number}
                  </Link>
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.supplier_name}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={receiptStatusTone(row.status)}>
                    {RECEIPT_STATUS_LABEL[row.status]}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="tabular-nums">{row.items_count}</span>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {formatDate(row.received_at ?? row.created_at)}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {total > 0 ? (
        <div className="flex items-center justify-between gap-2 text-body text-ink-secondary">
          <span>
            {from}–{to} / {total}
          </span>
          {totalPages > 1 ? (
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => pushParams({ page: page - 1 })}
              >
                Előző
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => pushParams({ page: page + 1 })}
              >
                Következő
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
