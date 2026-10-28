'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import {
  FileText,
  History,
  Plus,
  ScanBarcode,
  Search,
  ShoppingCart,
  X
} from 'lucide-react'

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
import {
  SALE_INVOICE_STATUS_LABEL,
  saleInvoiceStatusTone
} from '@/lib/invoicing/invoice-rules'
import type { SaleListPeriod } from '@/lib/sales/list-period'
import {
  formatMoneyFt,
  SALE_CHANNEL_LABEL,
  SALE_PAYMENT_STATUS_LABEL,
  SALE_STATUS_LABEL,
  salePaymentTone,
  saleStatusTone,
  type SaleChannel,
  type SalePaymentStatus,
  type SaleStatus
} from '@/lib/sales/parse'
import type { SaleListItem } from '@/lib/sales/queries'

type Props = {
  initialRows: SaleListItem[]
  total: number
  page: number
  limit: number
  q: string
  status: SaleStatus | 'all'
  channel: SaleChannel | 'all'
  period: SaleListPeriod
  shiftId?: string
  canWrite: boolean
  canPos?: boolean
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Időszak: mind' },
  { value: 'today', label: 'Ma' },
  { value: 'yesterday', label: 'Tegnap' },
  { value: '7d', label: '7 nap' },
  { value: '30d', label: '30 nap' }
]

const PERIOD_LABEL: Record<SaleListPeriod, string> = {
  all: 'Mind',
  today: 'Ma',
  yesterday: 'Tegnap',
  '7d': '7 nap',
  '30d': '30 nap'
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Állapot: mind' },
  { value: 'confirmed', label: 'Átadásra vár' },
  { value: 'fulfilled', label: 'Teljesítve' },
  { value: 'partially_returned', label: 'Részben visszáru' },
  { value: 'returned', label: 'Visszáru' }
]

const CHANNEL_OPTIONS = [
  { value: 'all', label: 'Csatorna: mind' },
  { value: 'pos', label: SALE_CHANNEL_LABEL.pos },
  { value: 'manual', label: SALE_CHANNEL_LABEL.manual },
  { value: 'webshop', label: SALE_CHANNEL_LABEL.webshop }
]

export function SalesListClient({
  initialRows,
  total,
  page,
  limit,
  q: initialQ,
  status: initialStatus,
  channel: initialChannel,
  period: initialPeriod,
  shiftId,
  canWrite,
  canPos = false
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialQ)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const searching = initialQ.trim().length > 0
  const statusValue: SaleStatus | 'all' = searching ? 'all' : initialStatus
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1
  const rangeEnd = Math.min(page * limit, total)
  const hasFilters =
    searching ||
    statusValue !== 'all' ||
    initialChannel !== 'all' ||
    initialPeriod !== 'all' ||
    Boolean(shiftId)

  useEffect(() => {
    setSearch(initialQ)
  }, [initialQ])

  function pushParams(next: {
    q?: string
    page?: number
    status?: SaleStatus | 'all'
    channel?: SaleChannel | 'all'
    period?: SaleListPeriod
    clearShift?: boolean
  }) {
    const params = new URLSearchParams()
    const q = (next.q !== undefined ? next.q : search).trim()
    const p = next.page ?? 1
    const channel = next.channel ?? initialChannel
    const period = next.period ?? initialPeriod

    let status: SaleStatus | 'all'
    if (q) {
      status = 'all'
    } else if (next.status !== undefined) {
      status = next.status
    } else if (next.q !== undefined && !q) {
      status = 'all'
    } else {
      status = initialStatus
    }

    if (q) params.set('q', q)
    if (status && status !== 'all') params.set('status', status)
    if (channel && channel !== 'all') params.set('channel', channel)
    if (period && period !== 'all') params.set('period', period)
    if (shiftId && !next.clearShift) params.set('shift', shiftId)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `/ertekesitesek?${qs}` : '/ertekesitesek')
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

  function clearAllFilters() {
    setSearch('')
    startTransition(() => {
      router.push('/ertekesitesek')
    })
  }

  const activeChips: { key: string; label: string; clear: () => void }[] = []
  if (initialQ.trim()) {
    activeChips.push({
      key: 'q',
      label: `Keresés: ${initialQ.trim()}`,
      clear: () => {
        setSearch('')
        pushParams({ q: '', page: 1 })
      }
    })
  }
  if (initialPeriod !== 'all') {
    activeChips.push({
      key: 'period',
      label: `Időszak: ${PERIOD_LABEL[initialPeriod]}`,
      clear: () => pushParams({ period: 'all', page: 1 })
    })
  }
  if (!searching && statusValue !== 'all') {
    activeChips.push({
      key: 'status',
      label: `Állapot: ${SALE_STATUS_LABEL[statusValue] ?? statusValue}`,
      clear: () => pushParams({ status: 'all', page: 1 })
    })
  }
  if (initialChannel !== 'all') {
    activeChips.push({
      key: 'channel',
      label: `Csatorna: ${SALE_CHANNEL_LABEL[initialChannel] ?? initialChannel}`,
      clear: () => pushParams({ channel: 'all', page: 1 })
    })
  }
  if (shiftId) {
    activeChips.push({
      key: 'shift',
      label: 'Műszak',
      clear: () => pushParams({ clearShift: true, page: 1 })
    })
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Értékesítések"
        description="Termék eladás — pult vagy iroda."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/ertekesitesek/arajanlatok')}
            >
              <FileText className="size-3.5" aria-hidden />
              Árajánlatok
            </Button>
            {canPos ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/ertekesitesek/muszakok')}
              >
                <History className="size-3.5" aria-hidden />
                Műszakok
              </Button>
            ) : null}
            {canWrite ? (
              <>
                {canPos ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push('/pos')}
                  >
                    <ScanBarcode className="size-3.5" aria-hidden />
                    POS
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => router.push('/ertekesitesek/uj')}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Új értékesítés
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <label className="sr-only" htmlFor="sales-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="sales-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                pushParams({ q: search, page: 1 })
              }
            }}
            placeholder="Szám, ügyfél, cikkszám vagy termék…"
            className="pl-8"
          />
        </div>
        <div className="w-[9.5rem] shrink-0">
          <label className="sr-only" htmlFor="sales-list-period">
            Időszak
          </label>
          <MenuSelect
            id="sales-list-period"
            value={initialPeriod}
            options={PERIOD_OPTIONS}
            allowEmpty={false}
            disabled={pending}
            onChange={(v) =>
              pushParams({ period: v as SaleListPeriod, page: 1 })
            }
          />
        </div>
        <div className="w-[10.5rem] shrink-0">
          <label className="sr-only" htmlFor="sales-list-status">
            Állapot
          </label>
          <MenuSelect
            id="sales-list-status"
            value={statusValue}
            options={STATUS_OPTIONS}
            allowEmpty={false}
            disabled={pending || searching}
            onChange={(v) =>
              pushParams({ status: v as SaleStatus | 'all', page: 1 })
            }
          />
        </div>
        <div className="w-[9.5rem] shrink-0">
          <label className="sr-only" htmlFor="sales-list-channel">
            Csatorna
          </label>
          <MenuSelect
            id="sales-list-channel"
            value={initialChannel}
            options={CHANNEL_OPTIONS}
            allowEmpty={false}
            disabled={pending}
            onChange={(v) =>
              pushParams({ channel: v as SaleChannel | 'all', page: 1 })
            }
          />
        </div>
        <p className="shrink-0 text-hint tabular-nums text-ink-muted">
          {rangeStart}–{rangeEnd} / {total}
        </p>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-border bg-surface px-2 text-hint text-ink-secondary transition-colors hover:border-ink/20 hover:text-ink"
              aria-label={`${chip.label} szűrő törlése`}
            >
              <span className="truncate">{chip.label}</span>
              <X className="size-3 shrink-0" aria-hidden />
            </button>
          ))}
          {searching ? (
            <p className="text-hint text-ink-muted">
              Keresés minden állapotban.
            </p>
          ) : null}
          <button
            type="button"
            onClick={clearAllFilters}
            className="h-7 px-1.5 text-hint font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
          >
            Összes törlése
          </button>
        </div>
      ) : searching ? (
        <p className="text-hint text-ink-muted">Keresés minden állapotban.</p>
      ) : null}

      {initialRows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <ShoppingCart className="size-5 text-ink-muted" aria-hidden />
          <div>
            {hasFilters ? (
              <>
                <p className="text-body font-medium text-ink">Nincs találat</p>
                <p className="mt-1 text-body text-ink-secondary">
                  Próbálj másik keresést, vagy tágítsd az időszakot / szűrőket.
                </p>
              </>
            ) : (
              <>
                <p className="text-body font-medium text-ink">
                  Még nincs értékesítés
                </p>
                <p className="mt-1 text-body text-ink-secondary">
                  Rögzíts egy eladást — a készlet automatikusan csökken.
                </p>
              </>
            )}
          </div>
          {hasFilters ? (
            <Button
              type="button"
              variant="secondary"
              onClick={clearAllFilters}
            >
              Szűrők törlése
            </Button>
          ) : canWrite ? (
            <Button
              type="button"
              onClick={() => router.push('/ertekesitesek/uj')}
            >
              Új értékesítés
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
              <DataTableHeaderCell>Eladó</DataTableHeaderCell>
              <DataTableHeaderCell>Csatorna</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Bruttó (Ft)</DataTableHeaderCell>
              <DataTableHeaderCell>Fizetés</DataTableHeaderCell>
              <DataTableHeaderCell>Számlázás</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => (
              <DataTableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(`/ertekesitesek/${row.id}`)}
              >
                <DataTableCell>
                  <div className="flex flex-col gap-0.5">
                    <Link
                      href={`/ertekesitesek/${row.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.sale_number}
                    </Link>
                    {row.customer_special_order_id && row.cso_order_number ? (
                      <Link
                        href={`/ugyfelrendelesek/${row.customer_special_order_id}`}
                        className="text-hint text-ink-secondary underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        UR · {row.cso_order_number}
                      </Link>
                    ) : null}
                  </div>
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.customer_name ?? 'Vendég'}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.created_by_label ?? '—'}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {SALE_CHANNEL_LABEL[row.channel] ?? row.channel}
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="font-semibold tabular-nums">
                    {formatMoneyFt(row.total_gross)} Ft
                  </span>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    tone={salePaymentTone(
                      row.payment_status as SalePaymentStatus
                    )}
                    variant="solid"
                  >
                    {SALE_PAYMENT_STATUS_LABEL[
                      row.payment_status as SalePaymentStatus
                    ] ?? row.payment_status}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    tone={saleInvoiceStatusTone(row.invoice_status)}
                    variant={
                      row.invoice_status === 'invoiced' ||
                      row.invoice_status === 'proforma'
                        ? 'solid'
                        : 'soft'
                    }
                  >
                    {SALE_INVOICE_STATUS_LABEL[row.invoice_status]}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    tone={saleStatusTone(row.status as SaleStatus)}
                    variant="soft"
                  >
                    {SALE_STATUS_LABEL[row.status as SaleStatus] ?? row.status}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {formatDate(row.fulfilled_at ?? row.created_at)}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-body text-ink-secondary">
          <span>
            {rangeStart}–{rangeEnd} / {total}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1 || pending}
              onClick={() => pushParams({ page: page - 1 })}
            >
              Előző
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= totalPages || pending}
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
