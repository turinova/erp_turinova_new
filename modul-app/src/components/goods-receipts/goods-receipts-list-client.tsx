'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { PackageCheck, Search, X } from 'lucide-react'

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
  const [pending, startTransition] = useTransition()
  const searching = Boolean(initialQ.trim())
  const statusValue: StatusFilter = searching ? 'all' : initialStatus

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  useEffect(() => {
    setSearch(initialQ)
  }, [initialQ])

  function pushParams(next: {
    q?: string
    status?: StatusFilter
    page?: number
  }) {
    const params = new URLSearchParams()
    const qRaw = next.q !== undefined ? next.q : search
    const q = qRaw.trim()
    let status: StatusFilter
    if (q) {
      status = 'all'
    } else if (next.status !== undefined) {
      status = next.status
    } else if (next.q !== undefined) {
      status = 'all'
    } else {
      status = initialStatus
    }
    const p = next.page ?? 1
    if (q) params.set('q', q)
    if (status !== 'all') params.set('status', status)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `/beerkezesek?${qs}` : '/beerkezesek')
    })
  }

  useEffect(() => {
    if (search === initialQ) return
    const t = window.setTimeout(() => {
      pushParams({ q: search, page: 1 })
    }, 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only on search text
  }, [search])

  const emptyHint = useMemo(() => {
    return initialRows.length === 0 && !initialQ && initialStatus === 'all'
  }, [initialRows.length, initialQ, initialStatus])

  function clearSearch() {
    setSearch('')
    pushParams({ q: '', status: 'all', page: 1 })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Beérkezések"
        description="Számold meg a megérkezett árut, majd vedd készletre."
      />

      <div className="flex flex-wrap items-center gap-2" role="search">
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                pushParams({ q: search, page: 1 })
              }
            }}
            placeholder="Szám, PO, beszállító, cikkszám, termék, vonalkód…"
            className="pl-8 pr-8"
            disabled={pending}
          />
          {search.trim() ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:bg-subtle hover:text-ink"
              aria-label="Keresés törlése"
              onClick={clearSearch}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {searching ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-subtle px-2 py-1 text-[12px] text-ink-secondary">
            Keresés: {initialQ.trim()}
            <button
              type="button"
              className="rounded p-0.5 hover:bg-surface"
              aria-label="Keresés törlése"
              onClick={clearSearch}
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
          <p className="text-[12px] text-ink-muted">
            Találatok minden státuszban
          </p>
          <Link
            href={`/beszallitoi-rendelesek?q=${encodeURIComponent(initialQ.trim())}`}
            className="text-[12px] text-ink-secondary underline-offset-2 hover:underline"
          >
            PO listán is →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {STATUS_CHIPS.map((chip) => {
          const count = statusCounts[chip.value] ?? 0
          const active = !searching && statusValue === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              disabled={pending || searching}
              onClick={() => {
                setSearch('')
                pushParams({
                  q: '',
                  status: chip.value,
                  page: 1
                })
              }}
              className={cn(
                'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
                active
                  ? 'bg-ink text-surface'
                  : searching
                    ? 'bg-subtle text-ink-muted'
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
          {searching
            ? 'Nincs találat ezzel a kereséssel.'
            : 'Nincs találat a szűrőkkel.'}
          <button
            type="button"
            className="ml-2 font-medium text-ink underline-offset-2 hover:underline"
            onClick={clearSearch}
          >
            Szűrők törlése
          </button>
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
                disabled={page <= 1 || pending}
                onClick={() => pushParams({ page: page - 1 })}
              >
                Előző
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages || pending}
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
