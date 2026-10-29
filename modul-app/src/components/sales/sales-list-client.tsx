'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Archive,
  FileText,
  History,
  Plus,
  ScanBarcode,
  Search,
  ShoppingCart,
  X
} from 'lucide-react'
import { toast } from 'sonner'

import { CancelSaleDialog } from '@/components/sales/cancel-sale-dialog'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { CustomerListCell } from '@/components/patterns/customer-list-cell'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Textarea } from '@/components/ui/textarea'
import {
  SALE_INVOICE_STATUS_LABEL,
  saleInvoiceStatusTone
} from '@/lib/invoicing/invoice-rules'
import {
  bulkArchiveSalesAction,
  bulkCancelSalesAction,
  unarchiveSaleAction
} from '@/lib/sales/actions'
import { canArchiveSale, canUnarchiveSale, SALE_BULK_MAX } from '@/lib/sales/archive'
import {
  canCancelSale,
  SALE_CANCEL_REASON_LABEL,
  SALE_CANCEL_REASONS,
  type SaleCancelReason
} from '@/lib/sales/cancel'
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
  archivedOnly?: boolean
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
  { value: 'returned', label: 'Visszáru' },
  { value: 'cancelled', label: 'Lemondva' },
  { value: 'draft', label: 'Vázlat' }
]

const CHANNEL_OPTIONS = [
  { value: 'all', label: 'Csatorna: mind' },
  { value: 'pos', label: SALE_CHANNEL_LABEL.pos },
  { value: 'manual', label: SALE_CHANNEL_LABEL.manual },
  { value: 'webshop', label: SALE_CHANNEL_LABEL.webshop }
]

const BULK_REASON_OPTIONS = SALE_CANCEL_REASONS.map((value) => ({
  value,
  label: SALE_CANCEL_REASON_LABEL[value]
}))

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
  archivedOnly = false,
  canWrite,
  canPos = false
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialQ)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false)
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false)
  const [bulkReason, setBulkReason] = useState<SaleCancelReason>('test')
  const [bulkNote, setBulkNote] = useState('')
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<SaleListItem | null>(null)
  const [unarchiveTarget, setUnarchiveTarget] = useState<SaleListItem | null>(
    null
  )
  const [archivePending, setArchivePending] = useState(false)

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
    Boolean(shiftId) ||
    archivedOnly

  useEffect(() => {
    setSearch(initialQ)
  }, [initialQ])

  useEffect(() => {
    setSelectedIds([])
  }, [page, initialQ, initialStatus, initialChannel, initialPeriod, shiftId, archivedOnly])

  function pushParams(next: {
    q?: string
    page?: number
    status?: SaleStatus | 'all'
    channel?: SaleChannel | 'all'
    period?: SaleListPeriod
    archived?: boolean | null
    clearShift?: boolean
  }) {
    const params = new URLSearchParams()
    const q = (next.q !== undefined ? next.q : search).trim()
    const p = next.page ?? 1
    const channel = next.channel ?? initialChannel
    const period = next.period ?? initialPeriod
    const archived =
      next.archived === null
        ? false
        : next.archived !== undefined
          ? next.archived
          : archivedOnly

    let status: SaleStatus | 'all'
    if (q || archived) {
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
    if (archived) params.set('archived', '1')
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

  const selectedRows = useMemo(
    () => initialRows.filter((r) => selectedIds.includes(r.id)),
    [initialRows, selectedIds]
  )

  const cancelableSelected = selectedRows.filter((r) =>
    canCancelSale({
      status: r.status,
      archivedAt: r.archived_at,
      hasActiveFinalInvoice: false
    }).ok
  )
  const archiveableSelected = selectedRows.filter((r) =>
    canArchiveSale({ status: r.status, archivedAt: r.archived_at }).ok
  )
  const unarchiveableSelected = selectedRows.filter((r) =>
    canUnarchiveSale({ archivedAt: r.archived_at }).ok
  )

  const canBulkCancel =
    canWrite &&
    !archivedOnly &&
    cancelableSelected.length > 0 &&
    cancelableSelected.length === selectedRows.length
  const canBulkArchive =
    canWrite &&
    !archivedOnly &&
    archiveableSelected.length > 0 &&
    archiveableSelected.length === selectedRows.length
  const canBulkUnarchive =
    canWrite &&
    archivedOnly &&
    unarchiveableSelected.length > 0 &&
    unarchiveableSelected.length === selectedRows.length

  const bulkHint =
    selectedRows.length > 0 && !canBulkCancel && !canBulkArchive && !canBulkUnarchive
      ? 'A kijelölés vegyes — válassz azonos típusú sorokat (pl. csak átadásra váró / csak teljesített).'
      : null

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function toggleSelectAll() {
    if (selectedIds.length === initialRows.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(initialRows.map((r) => r.id).slice(0, SALE_BULK_MAX))
    }
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
  if (!searching && !archivedOnly && statusValue !== 'all') {
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
  if (archivedOnly) {
    activeChips.push({
      key: 'archived',
      label: 'Archívum',
      clear: () => pushParams({ archived: null, page: 1 })
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
            disabled={pending || searching || archivedOnly}
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
        <Button
          type="button"
          variant={archivedOnly ? 'primary' : 'secondary'}
          aria-pressed={archivedOnly}
          onClick={() =>
            pushParams({
              archived: archivedOnly ? null : true,
              status: 'all',
              page: 1
            })
          }
        >
          <Archive className="size-3.5" aria-hidden />
          Archívum
        </Button>
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

      {canWrite && initialRows.length > 0 && selectedIds.length > 0 ? (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 shadow-sm">
          <p className="text-hint text-ink-secondary">
            {selectedIds.length} kijelölve
            {selectedIds.length >= SALE_BULK_MAX
              ? ` (max ${SALE_BULK_MAX})`
              : ''}
            {bulkHint ? ` · ${bulkHint}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {canBulkCancel ? (
              <Button
                type="button"
                variant="secondary"
                disabled={bulkLoading}
                onClick={() => {
                  setBulkError(null)
                  setBulkReason('test')
                  setBulkNote('')
                  setBulkCancelOpen(true)
                }}
              >
                Eladásokat lemond
              </Button>
            ) : null}
            {canBulkArchive ? (
              <Button
                type="button"
                variant="secondary"
                disabled={bulkLoading}
                onClick={() => setBulkArchiveOpen(true)}
              >
                Eladásokat archivál
              </Button>
            ) : null}
            {canBulkUnarchive ? (
              <Button
                type="button"
                variant="secondary"
                disabled={bulkLoading}
                onClick={() => {
                  setBulkLoading(true)
                  void (async () => {
                    let done = 0
                    for (const row of unarchiveableSelected) {
                      const result = await unarchiveSaleAction(row.id)
                      if (result.ok) done += 1
                    }
                    toast.success(
                      done > 0
                        ? `${done} eladás visszakerült az aktív listába.`
                        : 'Nem sikerült visszavonni.'
                    )
                    setSelectedIds([])
                    setBulkLoading(false)
                    router.refresh()
                  })()
                }}
              >
                Archívumból vissza
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={bulkLoading}
              onClick={() => setSelectedIds([])}
            >
              Kijelölés törlése
            </Button>
          </div>
        </div>
      ) : null}

      {initialRows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <ShoppingCart className="size-5 text-ink-muted" aria-hidden />
          <div>
            {hasFilters ? (
              <>
                <p className="text-body font-medium text-ink">Nincs találat</p>
                <p className="mt-1 text-body text-ink-secondary">
                  {archivedOnly
                    ? 'Az archívum üres, vagy próbálj másik keresést.'
                    : 'Próbálj másik keresést, vagy tágítsd az időszakot / szűrőket.'}
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
              {canWrite ? (
                <DataTableHeaderCell className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Összes kijelölése az oldalon"
                    checked={
                      initialRows.length > 0 &&
                      selectedIds.length === initialRows.length
                    }
                    onChange={toggleSelectAll}
                    className="size-3.5 accent-ink"
                  />
                </DataTableHeaderCell>
              ) : null}
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
              <DataTableHeaderCell>Eladó</DataTableHeaderCell>
              <DataTableHeaderCell>Csatorna</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Bruttó (Ft)</DataTableHeaderCell>
              <DataTableHeaderCell>Fizetés</DataTableHeaderCell>
              <DataTableHeaderCell>Számlázás</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
              {canWrite ? (
                <DataTableHeaderCell className="w-[7rem]">
                  <span className="sr-only">Műveletek</span>
                </DataTableHeaderCell>
              ) : null}
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => {
              const selected = selectedIds.includes(row.id)
              const rowCancelOk = canCancelSale({
                status: row.status,
                archivedAt: row.archived_at,
                hasActiveFinalInvoice: false
              }).ok
              const rowArchiveOk = canArchiveSale({
                status: row.status,
                archivedAt: row.archived_at
              }).ok
              const rowUnarchiveOk = canUnarchiveSale({
                archivedAt: row.archived_at
              }).ok

              return (
                <DataTableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/ertekesitesek/${row.id}`)}
                >
                  {canWrite ? (
                    <DataTableCell
                      onClick={(e) => e.stopPropagation()}
                      className="w-10"
                    >
                      <input
                        type="checkbox"
                        aria-label={`${row.sale_number} kijelölése`}
                        checked={selected}
                        onChange={() => toggleSelect(row.id)}
                        className="size-3.5 accent-ink"
                      />
                    </DataTableCell>
                  ) : null}
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
                      {row.archived_at ? (
                        <p className="text-hint text-ink-muted">Archív</p>
                      ) : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <CustomerListCell
                      name={row.customer_name}
                      customerId={row.customer_id}
                      mobile={row.customer_mobile}
                      emptyLabel="Vendég"
                    />
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
                  {canWrite ? (
                    <DataTableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        {rowCancelOk ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-7 px-2 text-hint"
                            onClick={() => setCancelTarget(row)}
                          >
                            Lemond
                          </Button>
                        ) : null}
                        {rowArchiveOk ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-7 px-2 text-hint"
                            onClick={() => {
                              setBulkLoading(true)
                              void bulkArchiveSalesAction([row.id]).then(
                                (result) => {
                                  setBulkLoading(false)
                                  if (!result.ok) {
                                    toast.error(result.message)
                                    return
                                  }
                                  if (result.done > 0) {
                                    toast.success(
                                      `${row.sale_number} archiválva.`
                                    )
                                    router.refresh()
                                  } else {
                                    toast.error('Nem sikerült archiválni.')
                                  }
                                }
                              )
                            }}
                          >
                            Archív
                          </Button>
                        ) : null}
                        {rowUnarchiveOk ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-7 px-2 text-hint"
                            onClick={() => setUnarchiveTarget(row)}
                          >
                            Vissza
                          </Button>
                        ) : null}
                      </div>
                    </DataTableCell>
                  ) : null}
                </DataTableRow>
              )
            })}
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

      {cancelTarget ? (
        <CancelSaleDialog
          open={Boolean(cancelTarget)}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null)
          }}
          saleId={cancelTarget.id}
          saleNumber={cancelTarget.sale_number}
          customerName={cancelTarget.customer_name}
          totalGross={cancelTarget.total_gross}
          hasPayments={false}
          linkedCso={Boolean(cancelTarget.customer_special_order_id)}
          onSuccess={() => {
            setCancelTarget(null)
            router.refresh()
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(unarchiveTarget)}
        onOpenChange={(open) => {
          if (!open) setUnarchiveTarget(null)
        }}
        title="Archívumból vissza"
        description={`${unarchiveTarget?.sale_number ?? ''} újra megjelenik a normál listában.`}
        confirmLabel="Archívumból vissza"
        variant="primary"
        loading={archivePending}
        onConfirm={() => {
          if (!unarchiveTarget) return
          setArchivePending(true)
          void unarchiveSaleAction(unarchiveTarget.id).then((result) => {
            setArchivePending(false)
            if (!result.ok) {
              toast.error(result.message)
              return
            }
            toast.success(`${result.saleNumber} visszakerült.`)
            setUnarchiveTarget(null)
            router.refresh()
          })
        }}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title="Eladásokat archivál"
        description={`${archiveableSelected.length} eladás eltűnik a normál listából és a KPI-kból. Bármikor visszahozható. Készlet / fizetés nem változik.`}
        confirmLabel="Eladásokat archivál"
        variant="primary"
        loading={bulkLoading}
        onConfirm={() => {
          setBulkLoading(true)
          void bulkArchiveSalesAction(
            archiveableSelected.map((r) => r.id)
          ).then((result) => {
            setBulkLoading(false)
            setBulkArchiveOpen(false)
            if (!result.ok) {
              toast.error(result.message)
              return
            }
            const parts = [`${result.done} archiválva`]
            if (result.skipped > 0) parts.push(`${result.skipped} kihagyva`)
            toast.success(parts.join(' · '))
            setSelectedIds([])
            router.refresh()
          })
        }}
      />

      <ConfirmDialog
        open={bulkCancelOpen}
        onOpenChange={(open) => {
          setBulkCancelOpen(open)
          if (!open) setBulkError(null)
        }}
        title="Eladásokat lemond"
        description={`${cancelableSelected.length} átadásra váró / vázlat eladás lesz Lemondva. Fizetés nem törlődik.`}
        confirmLabel="Eladásokat lemond"
        variant="danger"
        loading={bulkLoading}
        onConfirm={() => {
          setBulkLoading(true)
          setBulkError(null)
          void bulkCancelSalesAction({
            ids: cancelableSelected.map((r) => r.id),
            reason: bulkReason,
            note: bulkNote
          }).then((result) => {
            setBulkLoading(false)
            if (!result.ok) {
              setBulkError(result.message)
              return
            }
            setBulkCancelOpen(false)
            const parts = [`${result.done} lemondva`]
            if (result.skipped > 0) parts.push(`${result.skipped} kihagyva`)
            toast.success(parts.join(' · '))
            setSelectedIds([])
            router.refresh()
          })
        }}
      >
        <div className="space-y-3">
          <FormField label="Ok" htmlFor="bulk-sale-cancel-reason">
            <MenuSelect
              id="bulk-sale-cancel-reason"
              value={bulkReason}
              options={BULK_REASON_OPTIONS}
              allowEmpty={false}
              disabled={bulkLoading}
              onChange={(v) => setBulkReason(v as SaleCancelReason)}
            />
          </FormField>
          <FormField label="Megjegyzés" htmlFor="bulk-sale-cancel-note">
            <Textarea
              id="bulk-sale-cancel-note"
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              rows={2}
              disabled={bulkLoading}
            />
          </FormField>
          {bulkError ? (
            <p className="text-body text-danger-ink" role="alert">
              {bulkError}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  )
}
