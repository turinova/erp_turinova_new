'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { ClipboardList, PackageCheck, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

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
import { MenuSelect } from '@/components/ui/menu-select'
import { formatMoneyFt } from '@/lib/accessories/parse'
import { openOrCreateGoodsReceipt } from '@/lib/goods-receipts/actions'
import {
  PO_ORDER_KIND_LABEL,
  PO_STATUS_LABEL,
  poOrderKindTone,
  poStatusTone,
  type PurchaseOrderListStatusFilter,
  type PurchaseOrderStatus
} from '@/lib/purchase-orders/parse'
import type {
  PurchaseOrderListItem,
  PurchaseOrderStatusCounts
} from '@/lib/purchase-orders/queries'
import { cn } from '@/lib/utils'

type PurchaseOrdersListClientProps = {
  rows: PurchaseOrderListItem[]
  total: number
  page: number
  limit: number
  canWrite: boolean
  initialQ: string
  initialStatus: PurchaseOrderListStatusFilter
  statusCounts: PurchaseOrderStatusCounts
}

const STATUS_OPTIONS: { value: PurchaseOrderListStatusFilter; label: string }[] =
  [
    { value: 'open', label: 'Nyitott' },
    { value: 'draft', label: 'Vázlat' },
    { value: 'ordered', label: 'Elküldve' },
    { value: 'partial', label: 'Részben' },
    { value: 'received', label: 'Beérkezett' },
    { value: 'cancelled', label: 'Visszavonva' },
    { value: 'all', label: 'Mind' }
  ]

function todayLocalIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isOverdue(
  expected: string | null,
  status: PurchaseOrderStatus
): boolean {
  if (!expected) return false
  if (status !== 'ordered' && status !== 'partial') return false
  return expected.slice(0, 10) < todayLocalIso()
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const day = iso.slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3])
    ).toLocaleDateString('hu-HU')
  }
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

export function PurchaseOrdersListClient({
  rows,
  total,
  page,
  limit,
  canWrite,
  initialQ,
  initialStatus,
  statusCounts
}: PurchaseOrdersListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(initialQ)
  const [pending, startTransition] = useTransition()
  const [receivingId, setReceivingId] = useState<string | null>(null)

  const searching = Boolean(initialQ.trim())
  const statusValue: PurchaseOrderListStatusFilter = searching
    ? 'all'
    : initialStatus

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  useEffect(() => {
    setSearch(initialQ)
  }, [initialQ])

  function pushParams(patch: {
    q?: string
    status?: PurchaseOrderListStatusFilter | null
    page?: number
  }) {
    const next = new URLSearchParams(searchParams.toString())

    const q =
      patch.q !== undefined ? patch.q.trim() : (next.get('q') ?? '').trim()

    let status: PurchaseOrderListStatusFilter | null
    if (q) {
      status = 'all'
    } else if (patch.status !== undefined) {
      status = patch.status
    } else if (patch.q !== undefined) {
      status = 'open'
    } else {
      const raw = next.get('status')
      status = (raw as PurchaseOrderListStatusFilter | null) ?? 'open'
    }

    const p = patch.page ?? 1

    if (q) next.set('q', q)
    else next.delete('q')

    if (!status || status === 'open') next.delete('status')
    else next.set('status', status)

    if (p > 1) next.set('page', String(p))
    else next.delete('page')

    const qs = next.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
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

  function handleReceive(row: PurchaseOrderListItem) {
    setReceivingId(row.id)
    startTransition(async () => {
      const result = await openOrCreateGoodsReceipt(row.id)
      setReceivingId(null)
      if (!result.ok) {
        toast.error(result.message)
        router.refresh()
        return
      }
      router.push(`/beerkezesek/${result.id}`)
      router.refresh()
    })
  }

  const trulyEmpty = statusCounts.all === 0
  const openEmpty =
    !trulyEmpty &&
    total === 0 &&
    !searching &&
    statusValue === 'open'
  const filteredEmpty = total === 0 && !trulyEmpty && !openEmpty

  return (
    <div className="space-y-3">
      <PageHeader
        title="Beszállítói rendelések"
        description="Termék vagy anyag rendelés beszállítótól — nyitott tételek először."
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => router.push('/beszallitoi-rendelesek/uj')}
            >
              <Plus className="size-3.5" aria-hidden />
              Új rendelés
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <label className="sr-only" htmlFor="po-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="po-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                pushParams({ q: search, page: 1 })
              }
            }}
            placeholder="Szám, beszállító, cikkszám vagy tétel…"
            className="pl-8"
          />
        </div>
        <div className="w-[10.5rem] shrink-0">
          <label className="sr-only" htmlFor="po-list-status">
            Állapot
          </label>
          <MenuSelect
            id="po-list-status"
            value={statusValue}
            options={STATUS_OPTIONS}
            allowEmpty={false}
            disabled={pending || searching}
            onChange={(v) =>
              pushParams({
                status: v as PurchaseOrderListStatusFilter,
                page: 1
              })
            }
          />
        </div>
        <p className="shrink-0 text-hint tabular-nums text-ink-muted">
          {from}–{to} / {total}
          {!searching && statusValue === 'open' && statusCounts.open > 0
            ? ` · ${statusCounts.open} nyitott`
            : null}
        </p>
      </div>

      {trulyEmpty ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <ClipboardList className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">
              Még nincs beszállítói rendelés
            </p>
            <p className="mt-1 text-body text-ink-secondary">
              Válassz beszállítót, add hozzá a termékeket, majd jelöld
              megrendelve.
            </p>
          </div>
          {canWrite ? (
            <Button
              type="button"
              onClick={() => router.push('/beszallitoi-rendelesek/uj')}
            >
              <Plus className="size-3.5" aria-hidden />
              Új rendelés
            </Button>
          ) : null}
        </div>
      ) : openEmpty ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <PackageCheck className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">
              Nincs nyitott rendelés
            </p>
            <p className="mt-1 text-body text-ink-secondary">
              Minden rendelés beérkezett vagy visszavonva. Nézd meg a teljes
              listát, vagy indíts újat.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => pushParams({ status: 'all', page: 1 })}
            >
              Teljes lista
            </Button>
            {canWrite ? (
              <Button
                type="button"
                onClick={() => router.push('/beszallitoi-rendelesek/uj')}
              >
                <Plus className="size-3.5" aria-hidden />
                Új rendelés
              </Button>
            ) : null}
          </div>
        </div>
      ) : filteredEmpty ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-body text-ink-secondary">
          Nincs találat a szűrőkkel.
          <button
            type="button"
            className="ml-2 font-medium text-ink underline-offset-2 hover:underline"
            onClick={() => {
              setSearch('')
              pushParams({ q: '', status: 'open', page: 1 })
            }}
          >
            Szűrők törlése
          </button>
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Beszállító</DataTableHeaderCell>
              <DataTableHeaderCell>Státusz</DataTableHeaderCell>
              <DataTableHeaderCell>Várható</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Tételek</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Nettó</DataTableHeaderCell>
              {canWrite ? (
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Következő
                </DataTableHeaderCell>
              ) : null}
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => {
              const overdue = isOverdue(row.expected_date, row.status)
              const canReceive =
                canWrite &&
                (row.status === 'ordered' || row.status === 'partial')
              return (
                <DataTableRow
                  key={row.id}
                  className={cn(
                    'cursor-pointer',
                    row.order_kind === 'material' &&
                      'border-l-[3px] border-l-info'
                  )}
                  onClick={() =>
                    router.push(`/beszallitoi-rendelesek/${row.id}`)
                  }
                >
                  <DataTableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/beszallitoi-rendelesek/${row.id}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.po_number}
                      </Link>
                      <StatusBadge tone={poOrderKindTone(row.order_kind)}>
                        {PO_ORDER_KIND_LABEL[row.order_kind]}
                      </StatusBadge>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.supplier_name}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={poStatusTone(row.status)}>
                      {PO_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell
                    className={cn(
                      'tabular-nums',
                      overdue
                        ? 'font-medium text-warning-ink'
                        : 'text-ink-secondary'
                    )}
                  >
                    {formatDate(row.expected_date)}
                    {overdue ? (
                      <span className="ml-1.5 text-hint font-medium">
                        Késik
                      </span>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell align="right">
                    <span className="tabular-nums">{row.items_count}</span>
                  </DataTableCell>
                  <DataTableCell align="right">
                    <span className="tabular-nums font-medium">
                      {formatMoneyFt(row.net_total)}
                    </span>
                  </DataTableCell>
                  {canWrite ? (
                    <DataTableCell className="text-right">
                      {canReceive ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pending || receivingId === row.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReceive(row)
                          }}
                        >
                          <PackageCheck className="size-3.5" aria-hidden />
                          Beérkezés
                        </Button>
                      ) : (
                        <span className="text-hint text-ink-muted">—</span>
                      )}
                    </DataTableCell>
                  ) : null}
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      {total > 0 && totalPages > 1 ? (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 1 || pending}
            onClick={() => pushParams({ page: Math.max(1, page - 1) })}
          >
            Előző
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page >= totalPages || pending}
            onClick={() =>
              pushParams({ page: Math.min(totalPages, page + 1) })
            }
          >
            Következő
          </Button>
        </div>
      ) : null}
    </div>
  )
}
