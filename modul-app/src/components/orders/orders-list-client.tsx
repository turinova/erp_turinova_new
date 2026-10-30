'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ClipboardList, Factory, Search } from 'lucide-react'
import { toast } from 'sonner'

import { AssignProductionDialog } from '@/components/quotes/assign-production-dialog'
import { HandoverDialog } from '@/components/orders/handover-dialog'
import { ReopenQuoteDialog } from '@/components/quotes/reopen-quote-dialog'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { CustomerListCell } from '@/components/patterns/customer-list-cell'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import {
  archiveQuoteAction,
  unarchiveQuoteAction
} from '@/lib/quotes/actions'
import { quoteRemainingGross } from '@/lib/quotes/payment-labels'
import type {
  OrderListItem,
  OrderListStatusFilter
} from '@/lib/quotes/orders-queries'
import { QuoteReadySmsDialog } from '@/components/orders/quote-ready-sms-dialog'
import { SchedulerKpiStrip } from '@/components/orders/scheduler-kpi-strip'
import { markQuoteReady } from '@/lib/quotes/production-actions'
import type { SchedulerKpis } from '@/lib/orders/scheduler-kpi-queries'
import { QUOTE_STATUS_LABEL } from '@/lib/quotes/status-labels'
import type { ProductionMachineOption } from '@/lib/production-machines/queries'
import { budapestTodayYmd } from '@/lib/home/date'
import { previewQuoteReadySms } from '@/lib/scanner/actions'
import type { QuoteReadySmsCandidate } from '@/lib/sms/types'
import { cn } from '@/lib/utils'

type OrdersListClientProps = {
  rows: OrderListItem[]
  total: number
  page: number
  limit: number
  canWrite: boolean
  hasSmsAddon: boolean
  initialQ: string
  initialStatus: OrderListStatusFilter
  initialMachineId: string
  initialProductionDate: string
  initialOverdueOnly: boolean
  initialUnscheduledOnly: boolean
  initialTodayOnly: boolean
  initialArchivedOnly: boolean
  machines: ProductionMachineOption[]
  paymentMethods: PaymentMethodOption[]
  schedulerKpis: SchedulerKpis | null
}

const STATUS_CHIPS: Array<{
  value: OrderListStatusFilter
  label: string
}> = [
  { value: 'ordered', label: 'Megrendelve' },
  { value: 'in_production', label: 'Gyártásban' },
  { value: 'ready', label: 'Kész' },
  { value: 'finished', label: 'Lezárva' },
  { value: 'cancelled', label: 'Lemondva' },
  { value: 'all', label: 'Összes' }
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

/** YYYY-MM-DD a date input / production_date mezőből (ISO prefix). */
function productionYmd(iso: string | null): string | null {
  if (!iso) return null
  return iso.slice(0, 10)
}

function formatMeter(n: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(n)
}

/** Gép chip színek — nav soft tokenek, stabil hash az id/név alapján. */
const MACHINE_CHIP_STYLES = [
  'bg-nav-blue-soft text-nav-blue-ink',
  'bg-nav-teal-soft text-nav-teal-ink',
  'bg-nav-violet-soft text-nav-violet-ink',
  'bg-nav-amber-soft text-nav-amber-ink',
  'bg-nav-rose-soft text-nav-rose-ink',
  'bg-nav-emerald-soft text-nav-emerald-ink',
  'bg-nav-cyan-soft text-nav-cyan-ink'
] as const

function machineChipClass(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  }
  return MACHINE_CHIP_STYLES[h % MACHINE_CHIP_STYLES.length]!
}

function MachineChip({
  id,
  name
}: {
  id: string | null
  name: string | null
}) {
  if (!name) {
    return <span className="text-ink-muted">—</span>
  }
  return (
    <span
      className={cn(
        'inline-flex max-w-full truncate rounded-sm px-1.5 py-0.5 text-hint font-semibold',
        machineChipClass(id || name)
      )}
      title={name}
    >
      {name}
    </span>
  )
}

/** Szabás = info soft; él = amber soft — két külön chip, ne egy szürke string. */
function LoadMetersCell({
  cutting,
  edge
}: {
  cutting: number
  edge: number
}) {
  if (cutting <= 0 && edge <= 0) {
    return <span className="text-ink-muted">—</span>
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      {cutting > 0 ? (
        <span className="inline-flex items-center rounded-sm bg-info-soft px-1.5 py-0.5 text-hint font-semibold tabular-nums text-info-ink">
          {formatMeter(cutting)} m
          <span className="ml-1 font-medium opacity-80">szabás</span>
        </span>
      ) : null}
      {edge > 0 ? (
        <span className="inline-flex items-center rounded-sm bg-nav-amber-soft px-1.5 py-0.5 text-hint font-semibold tabular-nums text-nav-amber-ink">
          {formatMeter(edge)} m
          <span className="ml-1 font-medium opacity-80">él</span>
        </span>
      ) : null}
    </div>
  )
}

function DateStateCell({
  productionDate,
  ymd,
  isOverdue,
  isToday,
  needsSchedule
}: {
  productionDate: string | null
  ymd: string | null
  isOverdue: boolean
  isToday: boolean
  needsSchedule: boolean
}) {
  if (needsSchedule) {
    return (
      <DataTableCell className="border-l-[3px] border-l-warning bg-warning-soft/80">
        <span className="text-hint font-semibold text-warning-ink">
          Ütemezendő
        </span>
      </DataTableCell>
    )
  }

  if (isOverdue) {
    return (
      <DataTableCell className="border-l-[3px] border-l-danger bg-danger-soft">
        <span className="tabular-nums text-[13px] font-semibold text-danger-ink">
          {formatDate(productionDate)}
        </span>
        <div className="mt-0.5">
          <StatusBadge tone="danger" variant="soft">
            Lejárt
          </StatusBadge>
        </div>
      </DataTableCell>
    )
  }

  if (isToday) {
    return (
      <DataTableCell className="border-l-[3px] border-l-ink bg-primary-soft">
        <span className="tabular-nums text-[13px] font-semibold text-ink">
          {formatDate(productionDate)}
        </span>
        <div className="mt-0.5">
          <StatusBadge tone="neutral" variant="soft">
            Ma
          </StatusBadge>
        </div>
      </DataTableCell>
    )
  }

  return (
    <DataTableCell>
      <span className="tabular-nums font-medium text-ink">
        {ymd ? formatDate(productionDate) : '—'}
      </span>
    </DataTableCell>
  )
}

function toastAfterReady(
  orderNumber: string,
  sms: { status: string; error?: string } | null | undefined
) {
  if (!sms) {
    toast.success(`${orderNumber} készre állítva.`)
    return
  }
  if (sms.status === 'sent') {
    toast.success(`${orderNumber} készre állítva + SMS elküldve.`)
    return
  }
  if (sms.status === 'failed') {
    toast.warning(
      `${orderNumber} készre állítva, SMS sikertelen${sms.error ? `: ${sms.error}` : '.'}`
    )
    return
  }
  toast.success(`${orderNumber} készre állítva.`)
}

export function OrdersListClient({
  rows,
  total,
  page,
  limit,
  canWrite,
  hasSmsAddon,
  initialQ,
  initialStatus,
  initialMachineId,
  initialProductionDate,
  initialOverdueOnly,
  initialUnscheduledOnly,
  initialTodayOnly,
  initialArchivedOnly,
  machines,
  paymentMethods,
  schedulerKpis
}: OrdersListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const todayYmd = budapestTodayYmd()
  /** Vegyes listán soft státusz a O-szám alatt — külön oszlop nincs. */
  const showStatusHint =
    initialStatus === 'all' ||
    initialArchivedOnly ||
    initialOverdueOnly ||
    initialUnscheduledOnly ||
    initialTodayOnly
  const [qDraft, setQDraft] = useState(initialQ)
  const [productionTarget, setProductionTarget] =
    useState<OrderListItem | null>(null)
  const [handoverTarget, setHandoverTarget] = useState<OrderListItem | null>(
    null
  )
  const [reopenTarget, setReopenTarget] = useState<OrderListItem | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<OrderListItem | null>(
    null
  )
  const [unarchiveTarget, setUnarchiveTarget] =
    useState<OrderListItem | null>(null)
  const [archivePending, setArchivePending] = useState(false)
  const [smsDialogOpen, setSmsDialogOpen] = useState(false)
  const [smsCandidates, setSmsCandidates] = useState<QuoteReadySmsCandidate[]>(
    []
  )
  const [smsTargetIds, setSmsTargetIds] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    pushParams({ q: qDraft.trim() || null, page: '1' })
  }

  function runMarkReady(quoteIds: string[], smsQuoteIds?: string[]) {
    startTransition(async () => {
      for (const id of quoteIds) {
        const wantsSms =
          smsQuoteIds !== undefined ? smsQuoteIds.includes(id) : undefined
        const result = await markQuoteReady(
          id,
          wantsSms === undefined ? undefined : { sendSms: wantsSms }
        )
        if (!result.ok) {
          toast.error(result.message)
          continue
        }
        const row = rows.find((r) => r.id === id)
        toastAfterReady(row?.order_number ?? id, result.sms)
      }
      setSmsDialogOpen(false)
      router.refresh()
    })
  }

  function handleMarkReady(row: OrderListItem) {
    if (!hasSmsAddon) {
      runMarkReady([row.id])
      return
    }
    startTransition(async () => {
      const preview = await previewQuoteReadySms([row.id])
      if (!preview.ok) {
        toast.error(preview.message)
        return
      }
      if (!preview.hasAddon) {
        runMarkReady([row.id])
        return
      }
      setSmsTargetIds([row.id])
      setSmsCandidates(preview.candidates)
      setSmsDialogOpen(true)
    })
  }

  const emptyFiltered = useMemo(
    () =>
      total === 0 &&
      (Boolean(initialQ) ||
        Boolean(initialMachineId) ||
        Boolean(initialProductionDate) ||
        initialOverdueOnly ||
        initialUnscheduledOnly ||
        initialTodayOnly ||
        initialArchivedOnly ||
        initialStatus !== 'ordered'),
    [
      total,
      initialQ,
      initialMachineId,
      initialProductionDate,
      initialOverdueOnly,
      initialUnscheduledOnly,
      initialTodayOnly,
      initialArchivedOnly,
      initialStatus
    ]
  )

  return (
    <div>
      <PageHeader
        title="Megrendelések"
        description="Gyártás: nap → gép → terhelés. A következő lépés mindig jobbra."
      />

      {schedulerKpis && !initialArchivedOnly ? (
        <SchedulerKpiStrip
          data={schedulerKpis}
          activeToday={initialTodayOnly}
          activeOverdue={initialOverdueOnly}
          activeUnscheduled={initialUnscheduledOnly}
          activeMachineId={initialMachineId}
        />
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Státusz szűrő">
        {STATUS_CHIPS.map((chip) => {
          const active =
            !initialArchivedOnly &&
            !initialOverdueOnly &&
            !initialUnscheduledOnly &&
            !initialTodayOnly &&
            initialStatus === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() =>
                pushParams({
                  status: chip.value === 'ordered' ? null : chip.value,
                  archived: null,
                  overdue: null,
                  unscheduled: null,
                  today: null,
                  date: null,
                  page: '1'
                })
              }
              className={cn(
                'rounded-md border px-2.5 py-1 text-label font-semibold transition-colors',
                active
                  ? 'border-ink bg-ink text-white'
                  : 'border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink'
              )}
            >
              {chip.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() =>
            pushParams({
              today: '1',
              date: null,
              status: null,
              overdue: null,
              unscheduled: null,
              archived: null,
              page: '1'
            })
          }
          className={cn(
            'rounded-md border px-2.5 py-1 text-label font-semibold transition-colors',
            initialTodayOnly
              ? 'border-ink bg-ink text-white'
              : 'border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink'
          )}
        >
          Ma
        </button>
        <button
          type="button"
          onClick={() =>
            pushParams({
              overdue: '1',
              archived: null,
              unscheduled: null,
              today: null,
              status: null,
              date: null,
              page: '1'
            })
          }
          className={cn(
            'rounded-md border px-2.5 py-1 text-label font-semibold transition-colors',
            initialOverdueOnly
              ? 'border-danger bg-danger-soft text-danger-ink'
              : 'border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink'
          )}
        >
          Elmaradás
        </button>
        <button
          type="button"
          onClick={() =>
            pushParams({
              unscheduled: '1',
              overdue: null,
              today: null,
              archived: null,
              status: null,
              date: null,
              page: '1'
            })
          }
          className={cn(
            'rounded-md border px-2.5 py-1 text-label font-semibold transition-colors',
            initialUnscheduledOnly
              ? 'border-warning bg-warning-soft text-warning-ink'
              : 'border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink'
          )}
        >
          Nincs ütemezve
        </button>
        <button
          type="button"
          onClick={() =>
            pushParams({
              archived: '1',
              status: 'all',
              overdue: null,
              unscheduled: null,
              today: null,
              date: null,
              page: '1'
            })
          }
          className={cn(
            'rounded-md border px-2.5 py-1 text-label font-semibold transition-colors',
            initialArchivedOnly
              ? 'border-ink bg-ink text-white'
              : 'border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink'
          )}
        >
          Archívum
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end">
        <form
          onSubmit={handleSearchSubmit}
          className="relative max-w-sm flex-1"
        >
          <label className="sr-only" htmlFor="order-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="order-search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="O-szám, ügyfél, anyag, vonalkód…"
            className="pl-8"
          />
        </form>

        <div className="flex flex-wrap gap-2">
          <div className="min-w-[160px]">
            <label
              className="mb-1 block text-hint text-ink-secondary"
              htmlFor="order-machine-filter"
            >
              Gyártógép
            </label>
            <MenuSelect
              id="order-machine-filter"
              value={initialMachineId}
              emptyLabel="Összes gép"
              options={machines.map((m) => ({
                value: m.id,
                label: m.name
              }))}
              onChange={(v) =>
                pushParams({
                  machine: v || null,
                  page: '1'
                })
              }
            />
          </div>
          <div className="min-w-[150px]">
            <label
              className="mb-1 block text-hint text-ink-secondary"
              htmlFor="order-date-filter"
            >
              Gyártás napja
            </label>
            <Input
              id="order-date-filter"
              type="date"
              value={initialProductionDate}
              onChange={(e) =>
                pushParams({
                  date: e.target.value || null,
                  overdue: null,
                  unscheduled: null,
                  today: null,
                  page: '1'
                })
              }
            />
          </div>
          {initialMachineId ||
          initialProductionDate ||
          initialOverdueOnly ||
          initialUnscheduledOnly ||
          initialTodayOnly ? (
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  pushParams({
                    machine: null,
                    date: null,
                    overdue: null,
                    unscheduled: null,
                    today: null,
                    page: '1'
                  })
                }
              >
                Szűrők törlése
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {total === 0 && !emptyFiltered ? (
        <EmptyOrders />
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs találat a megadott szűrésre.
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Gyártás napja</DataTableHeaderCell>
                <DataTableHeaderCell>Gép</DataTableHeaderCell>
                <DataTableHeaderCell>Megrendelés</DataTableHeaderCell>
                <DataTableHeaderCell>Terhelés</DataTableHeaderCell>
                <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Következő
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const canProduce =
                  canWrite &&
                  !row.archived_at &&
                  (row.status === 'ordered' || row.status === 'in_production')
                const canReady =
                  canWrite &&
                  !row.archived_at &&
                  row.status === 'in_production'
                const canHandover =
                  canWrite && !row.archived_at && row.status === 'ready'
                const canReopen =
                  canWrite && !row.archived_at && row.status === 'finished'
                const canArchiveRow =
                  canWrite &&
                  !row.archived_at &&
                  (row.status === 'finished' || row.status === 'cancelled')
                const canUnarchiveRow = canWrite && Boolean(row.archived_at)
                const ymd = productionYmd(row.production_date)
                const isOpenProduction =
                  row.status === 'ordered' || row.status === 'in_production'
                const isOverdue =
                  Boolean(ymd) && isOpenProduction && ymd! < todayYmd
                const isToday =
                  Boolean(ymd) && isOpenProduction && ymd === todayYmd
                const needsSchedule = isOpenProduction && !ymd

                return (
                  <DataTableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-subtle"
                    onClick={() => router.push(`/ajanlatok/${row.id}`)}
                  >
                    <DateStateCell
                      productionDate={row.production_date}
                      ymd={ymd}
                      isOverdue={isOverdue}
                      isToday={isToday}
                      needsSchedule={needsSchedule}
                    />

                    <DataTableCell>
                      <MachineChip
                        id={row.production_machine_id}
                        name={row.production_machine_name}
                      />
                    </DataTableCell>

                    <DataTableCell>
                      {row.project_name ? (
                        <Link
                          href={`/ajanlatok/${row.id}`}
                          className="block truncate text-[14px] font-semibold text-ink no-underline hover:underline"
                          onClick={(e) => e.stopPropagation()}
                          title={row.project_name}
                        >
                          {row.project_name}
                        </Link>
                      ) : null}
                      <Link
                        href={`/ajanlatok/${row.id}`}
                        className={cn(
                          'font-mono text-hint text-ink-muted no-underline hover:underline',
                          !row.project_name &&
                            'text-[14px] font-semibold text-ink'
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.order_number}
                      </Link>
                      {row.archived_at ? (
                        <p className="text-hint text-ink-muted">Archív</p>
                      ) : null}
                      {showStatusHint ? (
                        <div className="mt-0.5">
                          <StatusBadge tone="neutral" variant="outline">
                            {QUOTE_STATUS_LABEL[row.status] ?? row.status}
                          </StatusBadge>
                        </div>
                      ) : null}
                    </DataTableCell>

                    <DataTableCell>
                      <LoadMetersCell
                        cutting={row.cutting_length_m}
                        edge={row.edge_length_m}
                      />
                    </DataTableCell>

                    <DataTableCell>
                      <CustomerListCell
                        name={row.customer_name}
                        customerId={row.customer_id}
                        mobile={row.customer_mobile}
                      />
                    </DataTableCell>

                    <DataTableCell className="text-right">
                      <div
                        className="flex min-w-[9.5rem] flex-nowrap items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canReady && canProduce ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setProductionTarget(row)}
                          >
                            Átütemez
                          </Button>
                        ) : null}
                        {canReady ? (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={pending}
                            onClick={() => handleMarkReady(row)}
                          >
                            Kész
                          </Button>
                        ) : null}
                        {canProduce && !canReady ? (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setProductionTarget(row)}
                          >
                            <Factory className="size-3.5" aria-hidden />
                            Gyártásba
                          </Button>
                        ) : null}
                        {canHandover ? (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setHandoverTarget(row)}
                          >
                            Átadás
                          </Button>
                        ) : null}
                        {canReopen ? (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setReopenTarget(row)}
                          >
                            Újranyitás
                          </Button>
                        ) : null}
                        {canArchiveRow ? (
                          <Button
                            type="button"
                            variant={canReopen ? 'ghost' : 'primary'}
                            size="sm"
                            onClick={() => setArchiveTarget(row)}
                          >
                            Archív
                          </Button>
                        ) : null}
                        {canUnarchiveRow ? (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setUnarchiveTarget(row)}
                          >
                            Vissza
                          </Button>
                        ) : null}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-hint text-ink-secondary">
              {from}–{to} / {total} elem
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => pushParams({ page: String(page - 1) })}
              >
                Előző
              </Button>
              <span className="px-2 text-hint text-ink-secondary">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => pushParams({ page: String(page + 1) })}
              >
                Következő
              </Button>
            </div>
          </div>
        </>
      )}

      {productionTarget ? (
        <AssignProductionDialog
          open={Boolean(productionTarget)}
          onOpenChange={(open) => {
            if (!open) setProductionTarget(null)
          }}
          quoteId={productionTarget.id}
          orderNumber={productionTarget.order_number}
          machines={machines}
          existing={{
            productionMachineId: productionTarget.production_machine_id,
            productionDate: productionTarget.production_date,
            barcode: productionTarget.barcode
          }}
          onSuccess={() => {
            setProductionTarget(null)
            router.refresh()
          }}
        />
      ) : null}

      {handoverTarget ? (
        <HandoverDialog
          open={Boolean(handoverTarget)}
          onOpenChange={(open) => {
            if (!open) setHandoverTarget(null)
          }}
          quoteId={handoverTarget.id}
          orderNumber={handoverTarget.order_number}
          customerName={handoverTarget.customer_name}
          remaining={quoteRemainingGross(
            handoverTarget.total_gross,
            handoverTarget.total_paid
          )}
          currency={handoverTarget.currency}
          paymentMethods={paymentMethods}
          onSuccess={() => {
            setHandoverTarget(null)
            router.refresh()
          }}
        />
      ) : null}

      {reopenTarget ? (
        <ReopenQuoteDialog
          open={Boolean(reopenTarget)}
          onOpenChange={(open) => {
            if (!open) setReopenTarget(null)
          }}
          quoteId={reopenTarget.id}
          orderNumber={reopenTarget.order_number}
          customerName={reopenTarget.customer_name}
          totalGross={reopenTarget.total_gross}
          currency={reopenTarget.currency}
          totalPaid={reopenTarget.total_paid}
          onSuccess={() => {
            setReopenTarget(null)
            router.refresh()
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null)
        }}
        title="Archívumba helyezés"
        description={`${archiveTarget?.order_number ?? ''} eltűnik a normál listából. Bármikor visszahozható.`}
        confirmLabel="Archívumba"
        variant="primary"
        loading={archivePending}
        onConfirm={() => {
          if (!archiveTarget) return
          setArchivePending(true)
          void archiveQuoteAction(archiveTarget.id).then((result) => {
            setArchivePending(false)
            if (!result.ok) {
              toast.error(result.message)
              return
            }
            toast.success(
              `Megrendelés ${result.orderNumber} az archívumban.`
            )
            setArchiveTarget(null)
            router.refresh()
          })
        }}
      />

      <ConfirmDialog
        open={Boolean(unarchiveTarget)}
        onOpenChange={(open) => {
          if (!open) setUnarchiveTarget(null)
        }}
        title="Archívumból vissza"
        description={`${unarchiveTarget?.order_number ?? ''} újra megjelenik a normál listában.`}
        confirmLabel="Visszaállítás"
        variant="primary"
        loading={archivePending}
        onConfirm={() => {
          if (!unarchiveTarget) return
          setArchivePending(true)
          void unarchiveQuoteAction(unarchiveTarget.id).then((result) => {
            setArchivePending(false)
            if (!result.ok) {
              toast.error(result.message)
              return
            }
            toast.success(
              `Megrendelés ${result.orderNumber} vissza az aktív listába.`
            )
            setUnarchiveTarget(null)
            router.refresh()
          })
        }}
      />

      <QuoteReadySmsDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        candidates={smsCandidates}
        loading={pending}
        onConfirm={(smsQuoteIds) => runMarkReady(smsTargetIds, smsQuoteIds)}
      />
    </div>
  )
}

function EmptyOrders() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
      <ClipboardList className="size-8 text-ink-secondary" aria-hidden />
      <div className="space-y-1">
        <p className="text-body font-medium text-ink">
          Nincs gyártásra váró megrendelés
        </p>
        <p className="max-w-sm text-body text-ink-secondary">
          A piszkozat árajánlatból a részletoldalon készíthetsz megrendelést,
          utána itt szervezed a gyártást.
        </p>
      </div>
      <Link
        href="/ajanlatok"
        className={buttonVariants({ variant: 'secondary' })}
      >
        Árajánlatok
      </Link>
    </div>
  )
}
