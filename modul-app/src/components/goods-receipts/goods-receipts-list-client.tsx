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
  { value: 'all', label: 'Összes' },
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
  statusCounts,
  canWrite
}: GoodsReceiptsListClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQ)

  const totalPages = Math.max(1, Math.ceil(total / limit))

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
    if (initialRows.length === 0 && !initialQ && initialStatus === 'all') {
      return true
    }
    return false
  }, [initialRows.length, initialQ, initialStatus])

  return (
    <div>
      <PageHeader
        title="Beérkezések"
        description="Számold meg a megérkezett árut, majd vedd készletre."
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form
          className="relative max-w-sm flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            pushParams({ q: search, page: 1 })
          }}
        >
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
            placeholder="Keresés szám szerint…"
            className="pl-8"
          />
        </form>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((chip) => {
            const count = statusCounts[chip.value] ?? 0
            const active = initialStatus === chip.value
            return (
              <Button
                key={chip.value}
                type="button"
                size="sm"
                variant={active ? 'primary' : 'secondary'}
                onClick={() =>
                  pushParams({
                    status: chip.value,
                    page: 1
                  })
                }
              >
                {chip.label} ({count})
              </Button>
            )
          })}
        </div>
      </div>

      {emptyHint ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <PackageCheck className="size-8 text-ink-secondary" aria-hidden />
          <div className="space-y-1">
            <p className="text-body font-medium text-ink">Még nincs beérkezés</p>
            <p className="max-w-sm text-body text-ink-secondary">
              Nyiss egy beszállítói rendelést, jelöld megrendelve, majd kattints
              az <strong>Áru megérkezett</strong> gombra.
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
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat.
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Szám</DataTableHeaderCell>
                <DataTableHeaderCell>Rendelés</DataTableHeaderCell>
                <DataTableHeaderCell>Beszállító</DataTableHeaderCell>
                <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                <DataTableHeaderCell>Dátum</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Tételek</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Műveletek
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {initialRows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <Link
                      href={`/beerkezesek/${row.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {row.receipt_number}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={`/beszallitoi-rendelesek/${row.purchase_order_id}`}
                      className="text-ink-secondary underline-offset-2 hover:underline"
                    >
                      {row.po_number}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>{row.supplier_name}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={receiptStatusTone(row.status)}>
                      {RECEIPT_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell>
                    {formatDate(row.received_at ?? row.created_at)}
                  </DataTableCell>
                  <DataTableCell align="right">{row.items_count}</DataTableCell>
                  <DataTableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/beerkezesek/${row.id}`)}
                    >
                      {row.status === 'checking' && canWrite
                        ? 'Folytatás'
                        : 'Megnyitás'}
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          {totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-between text-body text-ink-secondary">
              <span>
                {total} beérkezés · oldal {page}/{totalPages}
              </span>
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
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
