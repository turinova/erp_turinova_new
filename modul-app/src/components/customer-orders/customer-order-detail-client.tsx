'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  StickyNote
} from 'lucide-react'
import { toast } from 'sonner'

import {
  CsoAddItemDialog,
  CsoHeaderEditDialog,
  CsoItemEditDialog
} from '@/components/customer-orders/cso-detail-dialogs'
import { CsoJourneyStepper } from '@/components/customer-orders/cso-journey-stepper'
import { CsoLeadOrderDialog } from '@/components/customer-orders/cso-lead-order-dialog'
import { CsoReadySmsDialog } from '@/components/customer-orders/cso-ready-sms-dialog'
import {
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
  buildCsoJourney,
  csoBlockedCtaLabel,
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
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import {
  isCashPaymentMethodName,
  isDeferredPaymentMethodName
} from '@/lib/sales/payment-kind'
import { formatMoneyFt } from '@/lib/sales/parse'
import { hungarianCashRound } from '@/lib/sales/totals'
import type { CsoReadySmsCandidate } from '@/lib/sms/types'
import type { SupplierSelectOption } from '@/lib/suppliers/queries'
import type { UnitListItem } from '@/lib/units/queries'
import { cn } from '@/lib/utils'

type Props = {
  order: CustomerSpecialOrderDetail
  suppliers: SupplierSelectOption[]
  units: UnitListItem[]
  paymentMethods: PaymentMethodOption[]
  canWrite: boolean
}

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

function InfoCard({
  title,
  children
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <h3 className="mb-1.5 text-body font-semibold text-ink">{title}</h3>
      <div className="space-y-0.5 text-body leading-relaxed text-ink-secondary">
        {children}
      </div>
    </div>
  )
}

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
  paymentMethods,
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
  const [paymentMethodId, setPaymentMethodId] = useState(() => {
    const cash = paymentMethods.find((p) => isCashPaymentMethodName(p.name))
    return cash?.id ?? paymentMethods[0]?.id ?? ''
  })

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers]
  )
  const paymentOptions = useMemo(
    () => paymentMethods.map((p) => ({ value: p.id, label: p.name })),
    [paymentMethods]
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

  const nextStep = csoComputeNextStep({
    items: activeItems.map((i) => ({
      id: i.id,
      status: i.status,
      accessoryId: i.accessoryId,
      supplierId: i.supplierId,
      poId: i.poId,
      poNumber: i.poNumber,
      poStatus: i.poStatus
    })),
    smsSentAt: order.smsSentAt
  })

  const alsoLeadIds = activeItems
    .filter((i) => i.status === 'felveve' && !leadBlocker(i))
    .map((i) => i.id)

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
    fn: () => Promise<{
      ok: boolean
      message?: string
      saleId?: string
    }>,
    after?: () => void
  ) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.message ?? 'Hiba történt.')
        return
      }
      toast.success(res.message ?? 'Kész.', {
        action: res.saleId
          ? {
              label: 'Eladás',
              onClick: () => router.push(`/ertekesitesek/${res.saleId}`)
            }
          : undefined
      })
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
  const firstHandover = order.saleLinks.length === 0
  const deposit = order.depositAmount ?? 0
  const depositApplied = firstHandover && deposit > 0
  const handoverDueRaw = depositApplied
    ? Math.max(0, handoverGross - deposit)
    : handoverGross
  const payMethodName =
    paymentMethods.find((p) => p.id === paymentMethodId)?.name ?? ''
  const payDeferred = isDeferredPaymentMethodName(payMethodName)
  const handoverDue =
    !payDeferred && isCashPaymentMethodName(payMethodName) && handoverDueRaw > 0
      ? hungarianCashRound(handoverDueRaw)
      : handoverDueRaw
  const legacyAtadvaWithoutSale =
    activeItems.some((i) => i.status === 'atadva') &&
    order.saleLinks.length === 0

  /** Átvehető + SMS már ment → újraküldés a Következő sávban (nem overflow). */
  const showSmsResend =
    canWrite && readyCount > 0 && order.smsSentAt != null

  /** Primary lefedi az összes ilyet → soron ne ismételd. */
  const hideRowLeadCta = nextStep?.kind === 'lead'
  const hideRowHandoverCta = nextStep?.kind === 'handover'

  const headerMeta = [
    order.customerName,
    `Felvéve: ${fmtDateTime(order.createdAt)}`
  ]

  const nextStepUrgent =
    nextStep?.kind === 'handover' || nextStep?.kind === 'blocked'

  const statusCounts = {
    felveve: activeItems.filter((i) => i.status === 'felveve').length,
    rendelve: activeItems.filter((i) => i.status === 'rendelve').length,
    itt_van: activeItems.filter((i) => i.status === 'itt_van').length,
    atadva: activeItems.filter((i) => i.status === 'atadva').length
  }
  const statusSummary = [
    statusCounts.felveve ? `${statusCounts.felveve} felvéve` : null,
    statusCounts.rendelve ? `${statusCounts.rendelve} beszerzés` : null,
    statusCounts.itt_van ? `${statusCounts.itt_van} átvehető` : null,
    statusCounts.atadva ? `${statusCounts.atadva} átadva` : null
  ]
    .filter(Boolean)
    .join(' · ')

  const journey = buildCsoJourney({
    createdAt: order.createdAt,
    smsSentAt: order.smsSentAt,
    items: activeItems
  })

  const depositDue =
    order.depositAmount != null && order.depositAmount > 0
      ? Math.max(0, totalGross - order.depositAmount)
      : null

  const stepperNextLabel =
    order.status === 'torolve'
      ? null
      : nextStep?.kind === 'done'
        ? null
        : nextStep
          ? nextStep.title.replace(/^Következő:\s*/i, '')
          : null

  const summaryBlock = (
    <div className="rounded-md border border-border bg-subtle/60 px-3 py-2.5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">Összegzés</p>
          <p className="text-body text-ink-secondary">
            <span className="font-semibold tabular-nums text-ink">
              {activeItems.length}
            </span>{' '}
            tétel
            {csoQtyByUnit(activeItems).length > 0 ? (
              <span>
                {' '}
                ·{' '}
                {csoQtyByUnit(activeItems)
                  .map((q) => `${fmtQty(q.qty)} ${q.unit}`)
                  .join(' + ')}
              </span>
            ) : null}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right text-body">
          <dt className="text-left text-ink-secondary">Összesen (bruttó)</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {formatMoneyFt(totalGross)} Ft
          </dd>
          {order.depositAmount != null && order.depositAmount > 0 ? (
            <>
              <dt className="text-left text-ink-secondary">Előleg</dt>
              <dd className="tabular-nums text-ink">
                −{formatMoneyFt(order.depositAmount)} Ft
              </dd>
              <dt className="text-left font-semibold text-ink">
                Átvételkor fizet
              </dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatMoneyFt(depositDue ?? 0)} Ft
              </dd>
            </>
          ) : null}
        </dl>
      </div>
      {missingPriceCount > 0 ? (
        <p className="mt-2 text-body font-semibold text-warning-ink">
          {missingPriceCount} tételnél hiányzik az ár.
        </p>
      ) : null}
      <p className="mt-1 text-hint text-ink-muted">Az árak bruttók (ÁFA-val).</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="space-y-1">
          <Link
            href="/ugyfelrendelesek"
            className="inline-flex items-center gap-1 text-body text-ink-secondary no-underline hover:text-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Ügyfélrendelések
          </Link>
          <PageHeader
            title={order.orderNumber}
            description={headerMeta.join(' · ')}
            className="mb-0"
            actions={
              <StatusBadge
                tone={csoStatusTone(order.status as CsoItemStatus)}
                variant="soft"
              >
                {CSO_STATUS_LABEL[order.status as CsoItemStatus]}
              </StatusBadge>
            }
          />
        </div>
        {order.status === 'torolve' ? (
          <p className="text-body text-danger-ink" role="status">
            Lemondva — nincs további lépés.
          </p>
        ) : (
          <CsoJourneyStepper
            steps={journey}
            nextLabel={stepperNextLabel}
            footer={
              nextStep?.kind === 'done'
                ? 'Lezárva — nincs további lépés.'
                : null
            }
          />
        )}
      </div>

      {fullyCancelled ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-subtle px-3 py-3">
          <p className="text-body text-ink-secondary">
            Ez a rendelés le van mondva. Visszaállíthatod a tételeket, vagy
            elrejtheted a listáról.
          </p>
          <div className="flex flex-wrap gap-1.5">
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
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <div className="rounded-md border border-border bg-surface px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
                Megjegyzés
              </p>
              {order.note?.trim() ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-body text-ink-secondary">
                  {order.note.trim()}
                </p>
              ) : (
                <p className="mt-1 text-body text-ink-muted">Nincs megjegyzés.</p>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => setHeaderOpen(true)}
            >
              <Pencil className="size-3.5" aria-hidden />
              Szerkesztés
            </Button>
          </div>
        </div>
      ) : order.note?.trim() ? (
        <div className="rounded-md border border-border bg-surface px-3 py-2.5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
            Megjegyzés
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-body text-ink-secondary">
            {order.note.trim()}
          </p>
        </div>
      ) : null}

      {canWrite && nextStep && nextStep.kind !== 'done' ? (
        <div
          className={cn(
            'space-y-2 rounded-md border px-3 py-3',
            nextStepUrgent
              ? 'border-warning/35 bg-warning-soft'
              : 'border-border bg-subtle'
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className={cn(
                'min-w-0 flex-1 text-body',
                nextStepUrgent ? 'text-warning-ink' : 'text-ink-secondary'
              )}
            >
              {nextStep.body}
            </p>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {nextStep.href ? (
                <Link
                  href={nextStep.href}
                  className={buttonVariants({ size: 'md' })}
                >
                  {nextStep.hrefLabel ?? 'Megnyitás'}
                </Link>
              ) : null}
              {nextStep.kind === 'lead' && leadIds.length > 0 ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => openLead(leadIds)}
                >
                  Beszállítói listára ({leadIds.length})
                </Button>
              ) : null}
              {nextStep.kind === 'handover' && handoverIds.length > 0 ? (
                <>
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setConfirm({ kind: 'handover', ids: handoverIds })
                    }
                  >
                    Átadás a vevőnek ({handoverIds.length})
                  </Button>
                  {nextStep.suggestSms ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={openSmsDialog}
                    >
                      SMS (opcionális)
                    </Button>
                  ) : null}
                  {showSmsResend ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      onClick={openSmsDialog}
                    >
                      SMS újraküldése
                    </Button>
                  ) : null}
                </>
              ) : null}
              {nextStep.kind === 'blocked' && nextStep.focusItemId ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditItemId(nextStep.focusItemId!)}
                >
                  {csoBlockedCtaLabel(activeItems)}
                </Button>
              ) : null}
              {nextStep.kind === 'receive' && !nextStep.href ? (
                <Link
                  href="/beerkezesek"
                  className={buttonVariants({ size: 'md' })}
                >
                  Beérkezések
                </Link>
              ) : null}
            </div>
          </div>
          {nextStep.also ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
              <p className="text-body text-ink-secondary">
                Emellett: {nextStep.also.label}
              </p>
              {nextStep.also.kind === 'lead' && alsoLeadIds.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => openLead(alsoLeadIds)}
                >
                  Listára ({alsoLeadIds.length})
                </Button>
              ) : null}
              {nextStep.also.kind === 'blocked' &&
              nextStep.also.focusItemId ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => setEditItemId(nextStep.also!.focusItemId!)}
                >
                  Pótold a hiányt
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard title="Ügyfél">
          <p className="font-medium text-ink">{order.customerName}</p>
          <p>
            <a
              href={`tel:${order.customerMobile.replace(/\s/g, '')}`}
              className="text-ink underline-offset-2 hover:underline"
            >
              {order.customerMobile}
            </a>
          </p>
          {order.customerId ? (
            <div className="pt-2">
              <Link
                href={`/ugyfelek/${order.customerId}`}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-hint font-medium text-ink-secondary no-underline hover:bg-subtle hover:text-ink"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Ügyfél megnyitása
              </Link>
            </div>
          ) : null}
          {canWrite ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setHeaderOpen(true)}
              >
                <Pencil className="size-3.5" aria-hidden />
                Adatok szerkesztése
              </Button>
            </div>
          ) : null}
        </InfoCard>

        <InfoCard title="Rendelés">
          <p>
            <span className="text-ink-muted">Felvéve: </span>
            <span className="text-ink">{fmtDateTime(order.createdAt)}</span>
          </p>
          <p>
            <span className="text-ink-muted">Ígért nap: </span>
            <span className="text-ink">
              {order.promisedDate ? fmtDate(order.promisedDate) : '—'}
            </span>
          </p>
          <p>
            <span className="text-ink-muted">Előleg: </span>
            <span className="tabular-nums text-ink">
              {order.depositAmount != null
                ? `${formatMoneyFt(order.depositAmount)} Ft`
                : '—'}
            </span>
          </p>
          <p>
            <span className="text-ink-muted">SMS: </span>
            <span className="text-ink">
              {order.smsSentAt
                ? `elküldve ${fmtDateTime(order.smsSentAt)}`
                : readyCount > 0
                  ? 'még nem ment ki'
                  : '—'}
            </span>
          </p>
          {order.saleLinks.length > 0 ? (
            <p className="pt-1">
              <span className="text-ink-muted">Eladás: </span>
              {order.saleLinks.map((link, idx) => (
                <span key={link.salesOrderId}>
                  {idx > 0 ? ', ' : null}
                  <Link
                    href={`/ertekesitesek/${link.salesOrderId}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {link.saleNumber}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
          {statusSummary ? (
            <p className="pt-1 text-hint text-ink-muted">{statusSummary}</p>
          ) : null}
          {canCancelOrder ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() => setConfirm({ kind: 'cancel-order' })}
              >
                Rendelés lemondása
              </Button>
            </div>
          ) : null}
        </InfoCard>
      </div>

      {legacyAtadvaWithoutSale ? (
        <div className="rounded-md border border-warning/35 bg-warning-soft px-3 py-2.5">
          <p className="text-body text-warning-ink">
            Van átadott tétel, de nincs hozzákötött értékesítés (régi átadás). Az
            új átadások automatikusan eladást hoznak létre.
          </p>
        </div>
      ) : null}

      {canWrite && selectedItems.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-subtle px-3 py-2"
          role="region"
          aria-label="Kijelölt tételek műveletei"
        >
          <span className="text-body font-semibold text-ink">
            {selectedItems.length} tétel kijelölve
          </span>
          {leadIds.length > 0 && nextStep?.kind !== 'lead' ? (
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
          {handoverIds.length > 0 && nextStep?.kind !== 'handover' ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => setConfirm({ kind: 'handover', ids: handoverIds })}
            >
              Átadás ({handoverIds.length})
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

      <div className="space-y-3">
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            {canWrite ? (
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <p className="text-body font-semibold text-ink">Tételek</p>
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
            ) : (
              <div className="border-b border-border px-3 py-2">
                <p className="text-body font-semibold text-ink">Tételek</p>
              </div>
            )}
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
                            allSelected
                              ? new Set()
                              : new Set(selectable.map((i) => i.id))
                          )
                        }
                        aria-label="Összes tétel kijelölése"
                        className="size-3.5 accent-[var(--color-primary,#18181B)]"
                      />
                    </DataTableHeaderCell>
                  ) : null}
                  <DataTableHeaderCell>Termék</DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    Menny.
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    Bruttó / eg.
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    Sor
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Állapot</DataTableHeaderCell>
                  {canWrite ? (
                    <DataTableHeaderCell className="w-28 text-right">
                      <span className="sr-only">Művelet</span>
                    </DataTableHeaderCell>
                  ) : null}
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {activeItems.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell
                      colSpan={canWrite ? 7 : 5}
                      className="py-6 text-ink-secondary"
                    >
                      Nincs aktív tétel.
                    </DataTableCell>
                  </DataTableRow>
                ) : null}
                {activeItems.map((item) => {
                  const blocker = leadBlocker(item)
                  const hasPrice = csoHasPrice(item.unitPriceGross)
                  const needSupplier =
                    canWrite &&
                    item.status === 'felveve' &&
                    Boolean(item.accessoryId) &&
                    !item.supplierId
                  const partialHint = csoPartialArriveHint({
                    status: item.status,
                    qty: item.qty,
                    unitShortform: item.unitShortform,
                    poQtyOrdered: item.poQtyOrdered,
                    poQtyReceived: item.poQtyReceived
                  })
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
                        <div className="min-w-[12rem] max-w-lg space-y-0.5">
                          <p className="whitespace-normal break-words text-[14px] font-semibold leading-snug text-ink">
                            {item.name}
                          </p>
                          <p className="text-body text-ink-secondary">
                            {item.sku ? (
                              <span className="font-mono">{item.sku}</span>
                            ) : (
                              <span className="text-ink-muted">nincs SKU</span>
                            )}
                            {item.supplierName ? (
                              <>
                                {' · '}
                                <span>{item.supplierName}</span>
                              </>
                            ) : null}
                          </p>
                          {item.poId && item.poNumber ? (
                            <p className="text-body text-ink-secondary">
                              <Link
                                href={`/beszallitoi-rendelesek/${item.poId}`}
                                className="font-medium text-ink underline-offset-2 hover:underline"
                              >
                                {csoPoLinkLabel(item.poNumber, item.poStatus)}
                              </Link>
                            </p>
                          ) : null}
                          {needSupplier ? (
                            <div className="max-w-xs pt-1">
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
                                triggerClassName="border-warning text-warning-ink"
                              />
                            </div>
                          ) : null}
                          {blocker && !needSupplier ? (
                            <p className="text-body font-medium text-warning-ink">
                              {blocker}
                            </p>
                          ) : null}
                          {partialHint ? (
                            <p className="text-body font-medium text-warning-ink">
                              {partialHint}
                            </p>
                          ) : null}
                          {item.status === 'itt_van' &&
                          item.reservedQty != null ? (
                            <p className="text-hint text-success-ink">
                              Foglalva: {fmtQty(item.reservedQty)}{' '}
                              {item.unitShortform}
                            </p>
                          ) : null}
                          {item.note?.trim() ? (
                            <p className="flex items-start gap-1 whitespace-normal break-words text-body text-ink-secondary">
                              <StickyNote
                                className="mt-0.5 size-3 shrink-0 text-ink-muted"
                                aria-hidden
                              />
                              <span>{item.note.trim()}</span>
                            </p>
                          ) : null}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="whitespace-nowrap pt-2.5 text-right align-top tabular-nums text-body">
                        {fmtQty(item.qty)} {item.unitShortform}
                      </DataTableCell>
                      <DataTableCell className="whitespace-nowrap pt-2.5 text-right align-top tabular-nums text-body">
                        {hasPrice ? (
                          `${formatMoneyFt(item.unitPriceGross ?? 0)} Ft`
                        ) : (
                          <span className="font-semibold text-warning-ink">
                            Ár kell
                          </span>
                        )}
                      </DataTableCell>
                      <DataTableCell className="whitespace-nowrap pt-2.5 text-right align-top tabular-nums">
                        {hasPrice ? (
                          <span className="font-semibold text-ink">
                            {formatMoneyFt(
                              csoLineGross(item.unitPriceGross, item.qty)
                            )}{' '}
                            Ft
                          </span>
                        ) : (
                          '—'
                        )}
                      </DataTableCell>
                      <DataTableCell className="pt-2.5 align-top">
                        <StatusBadge tone={csoStatusTone(item.status)}>
                          {csoItemProgressLabel(item.status, item.poStatus)}
                        </StatusBadge>
                      </DataTableCell>
                      {canWrite ? (
                        <DataTableCell className="py-2 text-right align-top">
                          <div className="flex flex-wrap justify-end gap-1">
                            {item.status === 'felveve' &&
                            !blocker &&
                            !hideRowLeadCta ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={pending}
                                onClick={() => openLead([item.id])}
                              >
                                Listára
                              </Button>
                            ) : null}
                            {item.status === 'itt_van' &&
                            !hideRowHandoverCta ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  setConfirm({
                                    kind: 'handover',
                                    ids: [item.id]
                                  })
                                }
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
                            </Button>
                          </div>
                        </DataTableCell>
                      ) : null}
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
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
                        <span className="font-mono">
                          {item.sku || 'nincs SKU'}
                        </span>{' '}
                        · {fmtQty(item.qty)} {item.unitShortform}
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

        {summaryBlock}
      </div>

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
        title={`Átadás + értékesítés (${handoverItems.length} tétel)`}
        description="Létrejön egy értékesítés, a készlet egyszer jön le, a tételek „Átadva” lesznek."
        confirmLabel={
          payDeferred
            ? 'Átadás (utalás / hitel)'
            : handoverDue > 0
              ? `Átadás és fizetés (${formatMoneyFt(handoverDue)} Ft)`
              : 'Átadás (előleg fedezte)'
        }
        loading={pending}
        onConfirm={() => {
          if (confirm?.kind !== 'handover') return
          if (!paymentMethodId) {
            toast.error('Válassz fizetési módot.')
            return
          }
          if (handoverItems.some((i) => !csoHasPrice(i.unitPriceGross))) {
            toast.error('Minden tételnek legyen ára.')
            return
          }
          const ids = confirm.ids
          run(
            () =>
              handOverSpecialOrderItemsAction({
                orderId: order.id,
                itemIds: ids,
                paymentMethodId
              }),
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
            <dt className="font-semibold text-ink">
              {payDeferred ? 'Fizetendő (később)' : 'Fizetendő most'}
            </dt>
            <dd className="text-[18px] font-semibold tabular-nums text-ink">
              {formatMoneyFt(handoverDue)} Ft
            </dd>
          </dl>
          {paymentOptions.length > 0 ? (
            <div className="space-y-1">
              <p className="text-hint font-medium text-ink-secondary">
                Fizetési mód
              </p>
              <MenuSelect
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                options={paymentOptions}
                placeholder="Válassz…"
                aria-label="Fizetési mód"
              />
              {payDeferred ? (
                <p className="text-hint text-ink-secondary">
                  Utalás: az áru átadva, az eladás fizetetlen marad (díjbekérő az
                  értékesítésen).
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-body font-semibold text-warning-ink">
              Nincs aktív fizetési mód — állíts be a törzsadatokban.
            </p>
          )}
          <ul className="space-y-1 rounded-md border border-border bg-subtle px-2.5 py-2 text-body text-ink">
            <li>✓ Értékesítés létrejön (megjelenik az Értékesítéseknél)</li>
            <li>✓ Készlet egyszer csökken</li>
            <li>✓ Tételek „Átadva”</li>
            {depositApplied ? (
              <li>✓ Előleg beszámítva ({formatMoneyFt(deposit)} Ft)</li>
            ) : null}
          </ul>
          {handoverItems.some((i) => !csoHasPrice(i.unitPriceGross)) ? (
            <p className="text-body font-semibold text-warning-ink">
              Van tétel ár nélkül — előbb add meg az árat.
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
