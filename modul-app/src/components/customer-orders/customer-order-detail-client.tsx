'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Pencil, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import {
  CsoAddItemDialog,
  CsoHeaderEditDialog,
  CsoItemEditDialog
} from '@/components/customer-orders/cso-detail-dialogs'
import { CsoLeadOrderDialog } from '@/components/customer-orders/cso-lead-order-dialog'
import { CsoReadySmsDialog } from '@/components/customer-orders/cso-ready-sms-dialog'
import {
  CsoTotalsFooter,
  csoHasPrice,
  csoLineGross,
  csoQtyByUnit
} from '@/components/customer-orders/cso-lines'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
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
import { MenuSelect } from '@/components/ui/menu-select'
import {
  cancelSpecialOrderAction,
  handOverSpecialOrderItemsAction,
  hideSpecialOrderAction,
  markSpecialOrderItemsArrivedAction,
  previewSpecialOrderReadySmsAction,
  restoreSpecialOrderAction,
  restoreSpecialOrderItemAction,
  sendSpecialOrderReadySmsAction,
  updateSpecialOrderItemAction
} from '@/lib/customer-orders/actions'
import {
  CSO_STATUS_LABEL,
  csoComputeNextStep,
  csoItemProgressLabel,
  csoPartialArriveHint,
  csoPoLinkLabel,
  csoStatusTone,
  orderCanBeCancelled,
  type CsoItemStatus,
  type CustomerSpecialOrderDetail,
  type CustomerSpecialOrderItemRow
} from '@/lib/customer-orders/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { CsoReadySmsCandidate } from '@/lib/sms/types'
import type { SupplierSelectOption } from '@/lib/suppliers/queries'
import type { UnitListItem } from '@/lib/units/queries'
import { cn } from '@/lib/utils'

type Props = {
  order: CustomerSpecialOrderDetail
  suppliers: SupplierSelectOption[]
  units: UnitListItem[]
  canWrite: boolean
}

const PROGRESS_ORDER: CsoItemStatus[] = [
  'felveve',
  'rendelve',
  'itt_van',
  'atadva'
]

const dateFmt = new Intl.DateTimeFormat('hu-HU', {
  timeZone: 'Europe/Budapest',
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})
const dateTimeFmt = new Intl.DateTimeFormat('hu-HU', {
  timeZone: 'Europe/Budapest',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

function fmtDate(iso: string) {
  return dateFmt.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso))
}
function fmtDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso))
}
function fmtQty(q: number) {
  return q.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

/** Miért nem tehető listára egy Felvéve tétel (null = listázható). */
function leadBlocker(item: CustomerSpecialOrderItemRow): string | null {
  if (item.status !== 'felveve') return null
  if (!item.accessoryId) {
    return 'Szabad tétel — listára helyezéshez rendelj hozzá katalógus terméket.'
  }
  if (!item.supplierId) return 'Válassz beszállítót a listára helyezéshez.'
  return null
}

type Confirm =
  | { kind: 'arrive'; ids: string[]; fromStatus: 'felveve' | 'rendelve' }
  | { kind: 'handover'; ids: string[] }
  | { kind: 'cancel-order' }
  | { kind: 'hide-order' }
  | null

function cancelLineOutcome(item: CustomerSpecialOrderItemRow) {
  if (item.status === 'felveve') return '→ lemondva'
  if (item.status === 'itt_van') {
    return '→ foglalás feloldva, áru a polcon marad'
  }
  if (item.status === 'rendelve') {
    if (item.poStatus === 'draft' || item.poStatus === null) {
      return item.poNumber
        ? `→ kikerül a vázlatból (${item.poNumber})`
        : '→ kikerül a beszállítói vázlatból'
    }
    return item.poNumber
      ? `→ ${item.poNumber} már elment; ha megjön, polcra kerül`
      : '→ a beszállítói rendelés már elment; ha megjön, polcra kerül'
  }
  return ''
}

export function CustomerOrderDetailClient({
  order,
  suppliers,
  units,
  canWrite
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [headerOpen, setHeaderOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [leadOpen, setLeadOpen] = useState(false)
  const [leadDialogIds, setLeadDialogIds] = useState<string[]>([])
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsCandidates, setSmsCandidates] = useState<CsoReadySmsCandidate[]>([])
  const [smsLoading, setSmsLoading] = useState(false)

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers]
  )
  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.shortform, label: u.shortform, hint: u.name })),
    [units]
  )
  const defaultUnit =
    units.find((u) => u.shortform === 'db')?.shortform ?? units[0]?.shortform ?? 'db'

  const activeItems = order.items.filter((i) => i.status !== 'torolve')
  const cancelledItems = order.items.filter((i) => i.status === 'torolve')
  const editItem = order.items.find((i) => i.id === editItemId) ?? null

  const counts = PROGRESS_ORDER.map((s) => ({
    status: s,
    n: activeItems.filter((i) => i.status === s).length
  }))
  const readyCount = activeItems.filter((i) => i.status === 'itt_van').length

  const selectable = activeItems.filter((i) => i.status !== 'atadva')
  const selectedItems = selectable.filter((i) => selected.has(i.id))
  const scope = selectedItems.length > 0 ? selectedItems : activeItems

  const leadIds = scope
    .filter((i) => i.status === 'felveve' && !leadBlocker(i))
    .map((i) => i.id)
  const handoverIds = scope.filter((i) => i.status === 'itt_van').map((i) => i.id)
  const arriveCandidates = selectedItems.filter(
    (i) => i.status === 'felveve' || i.status === 'rendelve'
  )

  const primary: 'handover' | 'lead' | null =
    handoverIds.length > 0 ? 'handover' : leadIds.length > 0 ? 'lead' : null

  const nextStep = csoComputeNextStep({
    items: activeItems,
    smsSentAt: order.smsSentAt
  })

  const onWayWithPo = activeItems.filter(
    (i) => i.status === 'rendelve' && i.poId
  )
  const draftPoLink = onWayWithPo.find(
    (i) => !i.poStatus || i.poStatus === 'draft'
  )
  const orderedPoLink = onWayWithPo.find(
    (i) => i.poStatus === 'ordered' || i.poStatus === 'partial'
  )

  const totalGross = activeItems.reduce(
    (sum, i) => sum + csoLineGross(i.unitPriceGross, i.qty),
    0
  )
  const missingPriceCount = activeItems.filter(
    (i) => !csoHasPrice(i.unitPriceGross)
  ).length

  function run(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    after?: () => void
  ) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.message ?? 'Hiba történt.')
        return
      }
      toast.success(res.message ?? 'Kész.')
      setSelected(new Set())
      after?.()
      router.refresh()
    })
  }

  function openLead(ids: string[]) {
    setLeadDialogIds(ids)
    setLeadOpen(true)
  }

  function openSmsDialog() {
    setSmsLoading(true)
    setSmsOpen(true)
    startTransition(async () => {
      const res = await previewSpecialOrderReadySmsAction({ orderId: order.id })
      setSmsLoading(false)
      if (!res.ok) {
        toast.error(res.message)
        setSmsOpen(false)
        return
      }
      setSmsCandidates(res.candidates)
    })
  }

  function confirmSms(orderIds: string[]) {
    startTransition(async () => {
      const res = await sendSpecialOrderReadySmsAction({ orderIds })
      if (!res.ok) {
        toast.error(res.message ?? 'SMS sikertelen.')
        return
      }
      toast.success(res.message ?? 'SMS elküldve.')
      setSmsOpen(false)
      router.refresh()
    })
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected =
    selectable.length > 0 && selectable.every((i) => selected.has(i.id))

  const canCancelOrder =
    canWrite &&
    orderCanBeCancelled(order.status) &&
    !activeItems.some((i) => i.status === 'atadva')
  const fullyCancelled =
    canWrite &&
    order.status === 'torolve' &&
    activeItems.length === 0 &&
    cancelledItems.length > 0

  // Átadás dialógus összegek
  const handoverItems =
    confirm?.kind === 'handover'
      ? activeItems.filter((i) => confirm.ids.includes(i.id))
      : []
  const handoverGross = handoverItems.reduce(
    (s, i) => s + csoLineGross(i.unitPriceGross, i.qty),
    0
  )
  const firstHandover = !activeItems.some((i) => i.status === 'atadva')
  const deposit = order.depositAmount ?? 0
  const depositApplied = firstHandover && deposit > 0
  const handoverDue = depositApplied
    ? Math.max(0, handoverGross - deposit)
    : handoverGross

  return (
    <div className="space-y-3">
      <PageHeader
        title={order.orderNumber}
        description={`${order.customerName} · ${order.customerMobile}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/ugyfelrendelesek')}
            >
              Vissza a listához
            </Button>
            {canWrite && primary === 'handover' ? (
              <Button
                type="button"
                loading={pending}
                onClick={() => setConfirm({ kind: 'handover', ids: handoverIds })}
              >
                Átadás a vevőnek ({handoverIds.length})
              </Button>
            ) : null}
            {canWrite && primary === 'lead' ? (
              <Button
                type="button"
                loading={pending}
                onClick={() => openLead(leadIds)}
              >
                Beszállítói listára ({leadIds.length})
              </Button>
            ) : null}
          </div>
        }
      />

      {canWrite && nextStep && nextStep.kind !== 'done' ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-label font-semibold text-ink">{nextStep.title}</p>
            <p className="mt-0.5 text-body text-ink-secondary">{nextStep.body}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {nextStep.href ? (
              <Link
                href={nextStep.href}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                {nextStep.hrefLabel ?? 'Megnyitás'}
              </Link>
            ) : null}
            {nextStep.kind === 'sms' ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={openSmsDialog}
              >
                SMS az ügyfélnek
              </Button>
            ) : null}
            {nextStep.kind === 'lead' && leadIds.length > 0 ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => openLead(leadIds)}
              >
                Beszállítói listára
              </Button>
            ) : null}
            {nextStep.kind === 'handover' && handoverIds.length > 0 ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  setConfirm({ kind: 'handover', ids: handoverIds })
                }
              >
                Átadás a vevőnek
              </Button>
            ) : null}
            {nextStep.kind === 'receive' ? (
              <Link
                href="/beerkezesek"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Beérkezések
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {canWrite && !primary && nextStep?.kind === 'receive' ? (
        <p className="text-hint text-ink-secondary">
          Kézi „Megérkezett” csak kivétel (pl. polcról / nincs PO). Preferált:{' '}
          <Link
            href={
              orderedPoLink?.poId
                ? `/beszallitoi-rendelesek/${orderedPoLink.poId}`
                : '/beerkezesek'
            }
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            bevételezés
          </Link>
          .
        </p>
      ) : null}

      {/* Haladás + fejadatok */}
      <section className="space-y-2 rounded-md border border-border bg-surface px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-label text-ink-secondary">Haladás</span>
          {counts.map(({ status, n }) => (
            <span
              key={status}
              className={cn('inline-flex items-center gap-1.5', n === 0 && 'opacity-50')}
            >
              <StatusBadge tone={csoStatusTone(status)}>
                {CSO_STATUS_LABEL[status]}
              </StatusBadge>
              <span className="text-body font-semibold tabular-nums text-ink">
                {n}
              </span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-body">
            <div className="flex gap-1.5">
              <dt className="text-ink-secondary">Felvéve:</dt>
              <dd className="text-ink">{fmtDateTime(order.createdAt)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-secondary">Ígért nap:</dt>
              <dd className="text-ink">
                {order.promisedDate ? fmtDate(order.promisedDate) : '—'}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-secondary">Előleg:</dt>
              <dd className="tabular-nums text-ink">
                {order.depositAmount != null
                  ? `${formatMoneyFt(order.depositAmount)} Ft`
                  : '—'}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-secondary">SMS:</dt>
              <dd className="text-ink">
                {order.smsSentAt
                  ? `elküldve ${fmtDateTime(order.smsSentAt)}`
                  : readyCount > 0
                    ? 'még nem ment ki'
                    : 'küldés a rendelésről / várólistáról'}
              </dd>
            </div>
            {order.note ? (
              <div className="flex gap-1.5">
                <dt className="text-ink-secondary">Megjegyzés:</dt>
                <dd className="whitespace-normal break-words text-ink">{order.note}</dd>
              </div>
            ) : null}
          </dl>
          {canWrite ? (
            <div className="flex flex-wrap gap-1.5">
              {canWrite &&
              readyCount > 0 &&
              (order.smsSentAt || nextStep?.kind !== 'sms') ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={openSmsDialog}
                >
                  {order.smsSentAt ? 'SMS újraküldése' : 'SMS az ügyfélnek'}
                </Button>
              ) : null}
              {canWrite ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setHeaderOpen(true)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Adatok szerkesztése
                </Button>
              ) : null}
              {canCancelOrder ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger-ink hover:text-danger-ink"
                  disabled={pending}
                  onClick={() => setConfirm({ kind: 'cancel-order' })}
                >
                  Rendelés lemondása
                </Button>
              ) : null}
              {fullyCancelled ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => restoreSpecialOrderAction({ orderId: order.id }))
                    }
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Összes tétel visszaállítása
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirm({ kind: 'hide-order' })}
                  >
                    Elrejtés a listáról
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* Kijelölési sáv */}
      {canWrite && selectedItems.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-border-strong bg-subtle px-3 py-2"
          role="region"
          aria-label="Kijelölt tételek műveletei"
        >
          <span className="text-body font-semibold text-ink">
            {selectedItems.length} tétel kijelölve
          </span>
          {primary !== 'lead' && leadIds.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => openLead(leadIds)}
            >
              Beszállítói listára ({leadIds.length})
            </Button>
          ) : null}
          {arriveCandidates.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                setConfirm({
                  kind: 'arrive',
                  ids: arriveCandidates.map((i) => i.id),
                  fromStatus: arriveCandidates.some((i) => i.status === 'rendelve')
                    ? 'rendelve'
                    : 'felveve'
                })
              }
            >
              Kivétel: kézi megérkezett ({arriveCandidates.length})
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            Kijelölés törlése
          </Button>
        </div>
      ) : null}

      <DataTable>
        <DataTableHead>
          <DataTableRow>
            {canWrite ? (
              <DataTableHeaderCell className="w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  onChange={() =>
                    setSelected(
                      allSelected ? new Set() : new Set(selectable.map((i) => i.id))
                    )
                  }
                  aria-label="Összes tétel kijelölése"
                  className="size-3.5 accent-[var(--color-primary,#18181B)]"
                />
              </DataTableHeaderCell>
            ) : null}
            <DataTableHeaderCell>Termék</DataTableHeaderCell>
            <DataTableHeaderCell>Beszállító</DataTableHeaderCell>
            <DataTableHeaderCell className="text-right">Menny.</DataTableHeaderCell>
            <DataTableHeaderCell className="text-right">Bruttó / egys.</DataTableHeaderCell>
            <DataTableHeaderCell className="text-right">Sor bruttó</DataTableHeaderCell>
            <DataTableHeaderCell>Státusz</DataTableHeaderCell>
            {canWrite ? (
              <DataTableHeaderCell className="text-right">Művelet</DataTableHeaderCell>
            ) : null}
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {activeItems.length === 0 ? (
            <DataTableRow>
              <DataTableCell colSpan={canWrite ? 8 : 6} className="py-6 text-ink-secondary">
                Nincs aktív tétel.
              </DataTableCell>
            </DataTableRow>
          ) : null}
          {activeItems.map((item) => {
            const blocker = leadBlocker(item)
            const hasPrice = csoHasPrice(item.unitPriceGross)
            return (
              <DataTableRow key={item.id} className="align-top">
                {canWrite ? (
                  <DataTableCell className="pt-3 align-top">
                    {item.status !== 'atadva' ? (
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        aria-label={`${item.name} kijelölése`}
                        className="size-3.5 accent-[var(--color-primary,#18181B)]"
                      />
                    ) : null}
                  </DataTableCell>
                ) : null}
                <DataTableCell className="py-2 align-top">
                  <div className="min-w-[14rem] max-w-md space-y-0.5">
                    <p className="whitespace-normal break-words text-[14px] font-semibold leading-snug text-ink">
                      {item.name}
                    </p>
                    <p className="whitespace-normal break-all text-body text-ink-secondary">
                      <span className="font-mono">{item.sku || 'nincs SKU'}</span>
                      {item.accessoryId ? ' · Katalógus' : ' · Szabad tétel'}
                    </p>
                    {item.poId && item.poNumber ? (
                      <p className="text-body text-ink-secondary">
                        Beszállítói rendelés:{' '}
                        <Link
                          href={`/beszallitoi-rendelesek/${item.poId}`}
                          className="font-medium text-ink underline underline-offset-2"
                        >
                          {csoPoLinkLabel(item.poNumber, item.poStatus)}
                        </Link>
                      </p>
                    ) : null}
                    {(() => {
                      const hint = csoPartialArriveHint({
                        status: item.status,
                        qty: item.qty,
                        unitShortform: item.unitShortform,
                        poQtyOrdered: item.poQtyOrdered,
                        poQtyReceived: item.poQtyReceived
                      })
                      return hint ? (
                        <p className="text-body font-medium text-warning-ink">
                          {hint}
                        </p>
                      ) : null
                    })()}
                    {item.status === 'itt_van' && item.reservedQty != null ? (
                      <p className="text-body text-success-ink">
                        Foglalva a vevőnek: {fmtQty(item.reservedQty)} {item.unitShortform}
                      </p>
                    ) : null}
                    {blocker ? (
                      <p className="text-body font-medium text-warning-ink">{blocker}</p>
                    ) : null}
                    {item.note ? (
                      <p className="whitespace-normal break-words text-body text-ink-secondary">
                        Megjegyzés: {item.note}
                      </p>
                    ) : null}
                  </div>
                </DataTableCell>
                <DataTableCell className="min-w-[10rem] py-2 align-top">
                  {canWrite && item.status === 'felveve' ? (
                    <MenuSelect
                      id={`cso-item-supplier-${item.id}`}
                      value={item.supplierId ?? ''}
                      onChange={(v) =>
                        run(() =>
                          updateSpecialOrderItemAction({
                            orderId: order.id,
                            itemId: item.id,
                            patch: { supplierId: v || null }
                          })
                        )
                      }
                      allowEmpty
                      emptyLabel="Nincs beszállító"
                      placeholder="Válassz beszállítót"
                      searchable={suppliers.length > 8}
                      options={supplierOptions}
                      disabled={pending}
                      wrap
                      triggerClassName={cn(
                        item.accessoryId && !item.supplierId && 'border-warning text-warning-ink'
                      )}
                    />
                  ) : (
                    <span className="block pt-1 text-body text-ink">
                      {item.supplierName ?? '—'}
                    </span>
                  )}
                </DataTableCell>
                <DataTableCell className="whitespace-nowrap pt-2.5 text-right align-top tabular-nums">
                  {fmtQty(item.qty)} {item.unitShortform}
                </DataTableCell>
                <DataTableCell className="whitespace-nowrap pt-2.5 text-right align-top tabular-nums">
                  {hasPrice ? (
                    `${formatMoneyFt(item.unitPriceGross ?? 0)} Ft`
                  ) : (
                    <span className="font-semibold text-warning-ink">Ár kell</span>
                  )}
                </DataTableCell>
                <DataTableCell className="whitespace-nowrap pt-2.5 text-right align-top text-[15px] font-semibold tabular-nums text-ink">
                  {hasPrice
                    ? `${formatMoneyFt(csoLineGross(item.unitPriceGross, item.qty))} Ft`
                    : '—'}
                </DataTableCell>
                <DataTableCell className="pt-2.5 align-top">
                  <StatusBadge tone={csoStatusTone(item.status)}>
                    {csoItemProgressLabel(item.status, item.poStatus)}
                  </StatusBadge>
                  {item.status === 'rendelve' ? (
                    <p className="mt-1 max-w-[9rem] text-hint text-ink-secondary">
                      Bevételezéskor automatikusan „Itt van”.
                    </p>
                  ) : null}
                </DataTableCell>
                {canWrite ? (
                  <DataTableCell className="py-2 text-right align-top">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {item.status === 'felveve' && !blocker ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pending}
                          onClick={() => openLead([item.id])}
                        >
                          Megrendel
                        </Button>
                      ) : null}
                      {item.status === 'itt_van' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pending}
                          onClick={() => setConfirm({ kind: 'handover', ids: [item.id] })}
                        >
                          Átadás
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditItemId(item.id)}
                        aria-label={`${item.name} szerkesztése`}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Szerkesztés
                      </Button>
                    </div>
                  </DataTableCell>
                ) : null}
              </DataTableRow>
            )
          })}
        </DataTableBody>
      </DataTable>

      <div className="overflow-hidden rounded-md border border-border">
        {canWrite ? (
          <div className="border-b border-border bg-surface px-3 py-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="size-3.5" aria-hidden />
              Tétel hozzáadása
            </Button>
          </div>
        ) : null}
        <CsoTotalsFooter
          itemCount={activeItems.length}
          qtyByUnit={csoQtyByUnit(activeItems)}
          totalGross={totalGross}
          deposit={order.depositAmount}
          missingPriceCount={missingPriceCount}
        />
      </div>

      {cancelledItems.length > 0 ? (
        <details className="rounded-md border border-border bg-surface">
          <summary className="cursor-pointer px-3 py-2 text-body font-medium text-ink-secondary">
            {cancelledItems.length} lemondott tétel
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {cancelledItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="whitespace-normal break-words text-body font-semibold text-ink-secondary line-through">
                    {item.name}
                  </p>
                  <p className="text-body text-ink-secondary">
                    <span className="font-mono">{item.sku || 'nincs SKU'}</span> ·{' '}
                    {fmtQty(item.qty)} {item.unitShortform}
                  </p>
                </div>
                {canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        restoreSpecialOrderItemAction({
                          orderId: order.id,
                          itemId: item.id
                        })
                      )
                    }
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Visszaállítás
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <CsoHeaderEditDialog open={headerOpen} onOpenChange={setHeaderOpen} order={order} />

      <CsoItemEditDialog
        open={editItem != null}
        onOpenChange={(o) => {
          if (!o) setEditItemId(null)
        }}
        orderId={order.id}
        item={editItem}
        supplierOptions={supplierOptions}
        supplierSearchable={suppliers.length > 8}
      />

      <CsoAddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        orderId={order.id}
        supplierOptions={supplierOptions}
        supplierSearchable={suppliers.length > 8}
        unitOptions={unitOptions}
        defaultUnit={defaultUnit}
      />

      <CsoLeadOrderDialog
        open={leadOpen}
        onOpenChange={setLeadOpen}
        itemIds={leadDialogIds}
        orderId={order.id}
        onSuccess={() => {
          setSelected(new Set())
          router.refresh()
        }}
      />

      <CsoReadySmsDialog
        open={smsOpen}
        onOpenChange={setSmsOpen}
        candidates={smsCandidates}
        loading={pending || smsLoading}
        onConfirm={confirmSms}
      />

      <ConfirmDialog
        open={confirm?.kind === 'arrive'}
        onOpenChange={(o) => {
          if (!o) setConfirm(null)
        }}
        variant="primary"
        title="Kézi megérkezett — kivétel?"
        description={
          confirm?.kind === 'arrive' && confirm.fromStatus === 'rendelve'
            ? 'Normál út: Beérkezések → ott lesz „Átvehető” és a készlet is jó. Kézi jelölésnél későbbi bevételezésnél a készlet mínuszba mehet.'
            : 'Csak ha polcról adod ki, és nincs beszállítói bevételezés. A tétel „Átvehető” lesz és a vevőnek foglalódik.'
        }
        confirmLabel="Igen, kézi megérkezett"
        loading={pending}
        onConfirm={() => {
          if (confirm?.kind !== 'arrive') return
          const ids = confirm.ids
          run(
            () => markSpecialOrderItemsArrivedAction({ orderId: order.id, itemIds: ids }),
            () => setConfirm(null)
          )
        }}
      >
        {confirm?.kind === 'arrive' && confirm.fromStatus === 'rendelve' ? (
          <p className="text-body text-ink-secondary">
            Preferált:{' '}
            <Link
              href={
                orderedPoLink?.poId
                  ? `/beszallitoi-rendelesek/${orderedPoLink.poId}`
                  : draftPoLink?.poId
                    ? `/beszallitoi-rendelesek/${draftPoLink.poId}`
                    : '/beerkezesek'
              }
              className="font-medium text-ink underline underline-offset-2"
            >
              beszállítói rendelés / bevételezés
            </Link>
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'handover'}
        onOpenChange={(o) => {
          if (!o) setConfirm(null)
        }}
        variant="primary"
        title={`Átadod a vevőnek? (${handoverItems.length} tétel)`}
        description="A tételek „Átadva” lesznek, a készletből kivezetjük. Fizetés a pulton (POS / készpénz)."
        confirmLabel="Átadás"
        loading={pending}
        onConfirm={() => {
          if (confirm?.kind !== 'handover') return
          const ids = confirm.ids
          run(
            () => handOverSpecialOrderItemsAction({ orderId: order.id, itemIds: ids }),
            () => setConfirm(null)
          )
        }}
      >
        <div className="space-y-2">
          <ul className="max-h-48 divide-y divide-border overflow-auto rounded-md border border-border">
            {handoverItems.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-2.5 py-1.5">
                <span className="min-w-0 whitespace-normal break-words text-body text-ink">
                  {i.name}{' '}
                  <span className="text-ink-secondary">
                    · {fmtQty(i.qty)} {i.unitShortform}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-body font-semibold tabular-nums text-ink">
                  {csoHasPrice(i.unitPriceGross)
                    ? `${formatMoneyFt(csoLineGross(i.unitPriceGross, i.qty))} Ft`
                    : 'Nincs ár'}
                </span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-right text-body">
            <dt className="text-ink-secondary">Tételek (bruttó)</dt>
            <dd className="tabular-nums text-ink">{formatMoneyFt(handoverGross)} Ft</dd>
            {depositApplied ? (
              <>
                <dt className="text-ink-secondary">Előleg levonva</dt>
                <dd className="tabular-nums text-ink">−{formatMoneyFt(deposit)} Ft</dd>
              </>
            ) : null}
            <dt className="font-semibold text-ink">Fizetendő most</dt>
            <dd className="text-[18px] font-semibold tabular-nums text-ink">
              {formatMoneyFt(handoverDue)} Ft
            </dd>
          </dl>
          <ul className="space-y-1 rounded-md border border-border bg-subtle px-2.5 py-2 text-body text-ink">
            <li>✓ Áru átadva a vevőnek</li>
            <li>
              ✓ Fizetés beszedve
              {handoverDue > 0
                ? ` (${formatMoneyFt(handoverDue)} Ft)`
                : ' (nincs fennmaradó)'}
            </li>
            {depositApplied ? (
              <li>✓ Előleg beszámítva ({formatMoneyFt(deposit)} Ft)</li>
            ) : null}
            <li className="text-ink-secondary">
              Nyugta / számla: POS vagy Értékesítések — ez a képernyő csak az átadást
              rögzíti.
            </li>
          </ul>
          {handoverItems.some((i) => !csoHasPrice(i.unitPriceGross)) ? (
            <p className="text-body font-semibold text-warning-ink">
              Van tétel ár nélkül — az összeg nem teljes.
            </p>
          ) : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'cancel-order'}
        onOpenChange={(o) => {
          if (!o) setConfirm(null)
        }}
        title={`Lemondod a(z) ${order.orderNumber} rendelést?`}
        description={`${order.customerName} · ${order.customerMobile}`}
        confirmLabel="Rendelés lemondása"
        loading={pending}
        onConfirm={() => {
          run(
            () => cancelSpecialOrderAction({ orderId: order.id }),
            () => setConfirm(null)
          )
        }}
      >
        <div className="space-y-2">
          <ul className="max-h-48 divide-y divide-border overflow-auto rounded-md border border-border">
            {activeItems.map((item) => (
              <li key={item.id} className="px-2.5 py-1.5 text-body">
                <p className="whitespace-normal break-words font-medium text-ink">
                  {item.name}{' '}
                  <span className="font-normal text-ink-secondary">
                    · {fmtQty(item.qty)} {item.unitShortform} ·{' '}
                    {CSO_STATUS_LABEL[item.status]}
                  </span>
                </p>
                <p className="text-ink-secondary">{cancelLineOutcome(item)}</p>
              </li>
            ))}
          </ul>
          {order.depositAmount != null && order.depositAmount > 0 ? (
            <p className="text-body font-semibold text-warning-ink">
              Előleg {formatMoneyFt(order.depositAmount)} Ft — ezt kézzel add
              vissza, a rendszer nem könyvel.
            </p>
          ) : null}
          {order.smsSentAt ? (
            <p className="text-body text-warning-ink">
              Az ügyfél már kapott „átveheted” értesítőt.
            </p>
          ) : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'hide-order'}
        onOpenChange={(o) => {
          if (!o) setConfirm(null)
        }}
        title="Elrejted a listáról?"
        description={`${order.orderNumber} eltűnik az aktív és a „Törölve” listáról is. A rendelésszám foglalt marad.`}
        confirmLabel="Elrejtés"
        loading={pending}
        onConfirm={() => {
          startTransition(async () => {
            const res = await hideSpecialOrderAction({ orderId: order.id })
            if (!res.ok) {
              toast.error(res.message)
              return
            }
            toast.success(res.message ?? 'Elrejtve.')
            setConfirm(null)
            router.push('/ugyfelrendelesek')
            router.refresh()
          })
        }}
      />
    </div>
  )
}
