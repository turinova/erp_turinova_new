'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ClipboardList, Factory, Search } from 'lucide-react'
import { toast } from 'sonner'

import { AssignProductionDialog } from '@/components/quotes/assign-production-dialog'
import { HandoverDialog } from '@/components/orders/handover-dialog'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import {
  PAYMENT_STATUS_LABEL,
  paymentStatusTone,
  quoteRemainingGross
} from '@/lib/quotes/payment-labels'
import type {
  OrderListItem,
  OrderListStatusFilter
} from '@/lib/quotes/orders-queries'
import { QuoteReadySmsDialog } from '@/components/orders/quote-ready-sms-dialog'
import { markQuoteReady } from '@/lib/quotes/production-actions'
import {
  QUOTE_STATUS_LABEL,
  quoteStatusTone
} from '@/lib/quotes/status-labels'
import type { ProductionMachineOption } from '@/lib/production-machines/queries'
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
  machines: ProductionMachineOption[]
  paymentMethods: PaymentMethodOption[]
}

const STATUS_CHIPS: Array<{
  value: OrderListStatusFilter
  label: string
}> = [
  { value: 'ordered', label: 'Megrendelve' },
  { value: 'in_production', label: 'Gyártásban' },
  { value: 'ready', label: 'Kész' },
  { value: 'finished', label: 'Lezárva' },
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
  machines,
  paymentMethods
}: OrdersListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)
  const [productionTarget, setProductionTarget] =
    useState<OrderListItem | null>(null)
  const [handoverTarget, setHandoverTarget] = useState<OrderListItem | null>(
    null
  )
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
        initialStatus !== 'ordered'),
    [total, initialQ, initialMachineId, initialProductionDate, initialStatus]
  )

  return (
    <div>
      <PageHeader
        title="Megrendelések"
        description="Gyártás szervezése: gép, dátum, vonalkód. A részletek az árajánlat oldalon."
      />

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Státusz szűrő">
        {STATUS_CHIPS.map((chip) => {
          const active = initialStatus === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() =>
                pushParams({
                  status: chip.value === 'ordered' ? null : chip.value,
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
            placeholder="O-szám, ügyfél, vonalkód…"
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
                  page: '1'
                })
              }
            />
          </div>
          {initialMachineId || initialProductionDate ? (
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  pushParams({ machine: null, date: null, page: '1' })
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
                <DataTableHeaderCell>Megrendelés</DataTableHeaderCell>
                <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Bruttó
                </DataTableHeaderCell>
                <DataTableHeaderCell>Fizetés</DataTableHeaderCell>
                <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                <DataTableHeaderCell>Vonalkód</DataTableHeaderCell>
                <DataTableHeaderCell>Gyártás</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Műveletek
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const canProduce =
                  canWrite &&
                  (row.status === 'ordered' || row.status === 'in_production')
                const canReady =
                  canWrite && row.status === 'in_production'
                const canHandover = canWrite && row.status === 'ready'
                const productionLabel = [
                  row.production_machine_name,
                  row.production_date ? formatDate(row.production_date) : null
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <DataTableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-subtle"
                    onClick={() => router.push(`/ajanlatok/${row.id}`)}
                  >
                    <DataTableCell>
                      <Link
                        href={`/ajanlatok/${row.id}`}
                        className="font-medium text-ink no-underline hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.order_number}
                      </Link>
                      {row.project_name ? (
                        <p className="text-hint text-ink-secondary">
                          {row.project_name}
                        </p>
                      ) : null}
                    </DataTableCell>
                    <DataTableCell className="text-ink">
                      {row.customer_name}
                    </DataTableCell>
                    <DataTableCell className="text-right tabular-nums font-medium text-ink">
                      {formatQuotePrice(row.total_gross, row.currency)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge tone={paymentStatusTone(row.payment_status)}>
                        {PAYMENT_STATUS_LABEL[row.payment_status]}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge tone={quoteStatusTone(row.status)}>
                        {QUOTE_STATUS_LABEL[row.status] ?? row.status}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell className="max-w-[7.5rem]">
                      <span
                        className="block truncate font-mono text-hint text-ink"
                        title={row.barcode ?? undefined}
                      >
                        {row.barcode || '—'}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="max-w-[10rem]">
                      <span
                        className="block truncate text-ink"
                        title={productionLabel || undefined}
                      >
                        {productionLabel || '—'}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canProduce ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setProductionTarget(row)}
                          >
                            <Factory className="size-3.5" aria-hidden />
                            Gyártás
                          </Button>
                        ) : null}
                        {canReady ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={pending}
                            onClick={() => handleMarkReady(row)}
                          >
                            Kész
                          </Button>
                        ) : null}
                        {canHandover ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setHandoverTarget(row)}
                          >
                            Átadás
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
