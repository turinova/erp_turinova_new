'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import {
  ClipboardList,
  ExternalLink,
  EyeOff,
  Handshake,
  MessageSquare,
  PackageCheck,
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
  csoLineGross
} from '@/components/customer-orders/cso-lines'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { DueAmountBar, DueAmountCard } from '@/components/patterns/due-amount'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
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
  csoComputeNextStep,
  csoItemProgressLabel,
  csoPartialArriveHint,
  csoPoLinkLabel,
  csoStatusTone,
  orderCanBeCancelled,
  type CustomerSpecialOrderDetail,
  type CustomerSpecialOrderItemRow
} from '@/lib/customer-orders/types'
import { pickDefaultPaymentMethodId } from '@/lib/payment-methods/default'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import {
  isCashPaymentMethodName,
  isDeferredPaymentMethodName
} from '@/lib/sales/payment-kind'
import { formatReadySmsInfoLine } from '@/lib/order-status/record-open'
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
  const [paymentMethodId, setPaymentMethodId] = useState(() =>
    pickDefaultPaymentMethodId(paymentMethods)
  )

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

  const journey = buildCsoJourney({
    createdAt: order.createdAt,
    smsSentAt: order.smsSentAt,
    items: activeItems
  })

  // Pénz: csak a még át nem adott tételek; előleg az első átadásig él.
  const openItems = activeItems.filter((i) => i.status !== 'atadva')
  const handedCount = activeItems.length - openItems.length
  const remainingGross = openItems.reduce(
    (sum, i) => sum + csoLineGross(i.unitPriceGross, i.qty),
    0
  )
  const depositLeft = order.saleLinks.length === 0 ? deposit : 0
  const dueAtPickup = Math.max(0, remainingGross - depositLeft)
  const refundDue = Math.max(0, depositLeft - remainingGross)
  const openMissingPrice = openItems.filter(
    (i) => !csoHasPrice(i.unitPriceGross)
  ).length
  const cancelledGross = cancelledItems.reduce(
    (sum, i) => sum + csoLineGross(i.unitPriceGross, i.qty),
    0
  )

  const moneyState: 'open' | 'handed_over' | 'cancelled' =
    order.status === 'torolve'
      ? 'cancelled'
      : activeItems.length > 0 && openItems.length === 0
        ? 'handed_over'
        : 'open'
  const dueLabel =
    moneyState === 'handed_over'
      ? 'Elszámolva'
      : moneyState === 'cancelled'
        ? 'Lemondva'
        : 'Átvételkor fizet'
  const dueAmount =
    moneyState === 'handed_over'
      ? totalGross
      : moneyState === 'cancelled'
        ? cancelledGross
        : dueAtPickup
  const dueMuted = moneyState !== 'open' || dueAtPickup === 0
  const showBreakdown =
    moneyState === 'open' && (depositLeft > 0 || handedCount > 0)

  const dueCardFootnote =
    moneyState !== 'open' ? null : (
      <div className="space-y-1">
        {showBreakdown ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-border pt-1.5 text-body">
            <dt className="text-ink-secondary">
              {handedCount > 0 ? 'Még nem átadott' : 'Részösszeg'}
            </dt>
            <dd className="text-right tabular-nums text-ink">
              {formatMoneyFt(remainingGross)} Ft
            </dd>
            {depositLeft > 0 ? (
              <>
                <dt className="text-ink-secondary">Előleg</dt>
                <dd className="text-right tabular-nums text-ink">
                  −{formatMoneyFt(depositLeft)} Ft
                </dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {refundDue > 0 ? (
          <p className="font-medium tabular-nums text-warning-ink">
            Visszajár {formatMoneyFt(refundDue)} Ft
          </p>
        ) : null}
        {openMissingPrice > 0 ? (
          <p className="font-medium text-warning-ink">
            Nem végleges · {openMissingPrice} tételnél nincs ár
          </p>
        ) : null}
      </div>
    )
  const dueBarFootnote =
    moneyState !== 'open' ? null : refundDue > 0 ? (
      <p className="font-medium tabular-nums text-warning-ink">
        Visszajár {formatMoneyFt(refundDue)} Ft
      </p>
    ) : openMissingPrice > 0 ? (
      <p className="font-medium text-warning-ink">Nem végleges</p>
    ) : depositLeft > 0 ? (
      <p className="text-ink-secondary">Előleg levonva</p>
    ) : null

  // Műveletek: fix sorrend, egy primary, magyarázó szöveg nélkül.
  const selecting = canWrite && selectedItems.length > 0
  const handoverNoPrice = activeItems.filter(
    (i) => handoverIds.includes(i.id) && !csoHasPrice(i.unitPriceGross)
  ).length

  type RailAction = {
    key: 'lead' | 'po' | 'receive' | 'handover' | 'arrive' | 'sms'
    label: string
    icon: ReactNode
    disabledReason?: string
  } & ({ href: string } | { onClick: () => void })

  const actions: RailAction[] = []
  if (canWrite && order.status !== 'torolve') {
    if (leadIds.length > 0) {
      actions.push({
        key: 'lead',
        label: `Beszállítói listára (${leadIds.length})`,
        icon: <ClipboardList className="size-3.5" aria-hidden />,
        onClick: () => openLead(leadIds)
      })
    }
    if (!selecting && nextStep?.href) {
      actions.push({
        key: 'po',
        label: nextStep.hrefLabel ?? 'Beszállítói rendelés',
        icon: <ExternalLink className="size-3.5" aria-hidden />,
        href: nextStep.href
      })
    }
    if (!selecting && nextStep?.kind === 'receive' && !nextStep.href) {
      actions.push({
        key: 'receive',
        label: 'Beérkezések',
        icon: <PackageCheck className="size-3.5" aria-hidden />,
        href: '/beerkezesek'
      })
    }
    if (handoverIds.length > 0) {
      actions.push({
        key: 'handover',
        label: `Átadás a vevőnek (${handoverIds.length})`,
        icon: <Handshake className="size-3.5" aria-hidden />,
        disabledReason:
          handoverNoPrice > 0
            ? `${handoverNoPrice} tételnél nincs ár`
            : undefined,
        onClick: () => setConfirm({ kind: 'handover', ids: handoverIds })
      })
    }
    if (selecting && arriveCandidates.length > 0) {
      actions.push({
        key: 'arrive',
        label: `Megérkezett, kézi (${arriveCandidates.length})`,
        icon: <PackageCheck className="size-3.5" aria-hidden />,
        onClick: () =>
          setConfirm({
            kind: 'arrive',
            ids: arriveCandidates.map((i) => i.id),
            fromStatus: arriveCandidates.some((i) => i.status === 'rendelve')
              ? 'rendelve'
              : 'felveve'
          })
      })
    }
    if (!selecting && readyCount > 0) {
      actions.push({
        key: 'sms',
        label: order.smsSentAt ? 'SMS újraküldése' : 'SMS a vevőnek',
        icon: <MessageSquare className="size-3.5" aria-hidden />,
        onClick: openSmsDialog
      })
    }
  }

  const primaryKey: RailAction['key'] | null = (() => {
    const usable = actions.filter((a) => !a.disabledReason && a.key !== 'sms')
    if (selecting) return usable[0]?.key ?? null
    const want =
      nextStep?.kind === 'lead'
        ? 'lead'
        : nextStep?.kind === 'handover'
          ? 'handover'
          : nextStep?.href
            ? 'po'
            : nextStep?.kind === 'receive'
              ? 'receive'
              : null
    return want && usable.some((a) => a.key === want) ? want : null
  })()
  const primaryAction = actions.find((a) => a.key === primaryKey) ?? null

  const cancelBlockedReason = activeItems.some((i) => i.status === 'atadva')
    ? 'Van átadott tétel.'
    : null
  const showCancelOrder =
    canWrite && order.status !== 'torolve' && orderCanBeCancelled(order.status)

  function renderAction(a: RailAction, full = true) {
    const variant = a.key === primaryKey ? 'primary' : 'secondary'
    const cls = full ? 'w-full justify-start' : undefined
    if ('href' in a) {
      return (
        <Link
          key={a.key}
          href={a.href}
          className={cn(buttonVariants({ variant }), cls)}
        >
          {a.icon}
          {a.label}
        </Link>
      )
    }
    return (
      <Button
        key={a.key}
        type="button"
        variant={variant}
        className={cls}
        disabled={pending || Boolean(a.disabledReason)}
        title={a.disabledReason}
        onClick={a.onClick}
      >
        {a.icon}
        {a.label}
      </Button>
    )
  }

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="space-y-2">
        <div className="space-y-1">
          <Link
            href="/ugyfelrendelesek"
            className="inline-block text-body text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
          >
            ← Ügyfélrendelések
          </Link>
          <h1 className="min-w-0 break-words text-h1 font-semibold text-ink">
            {order.orderNumber}
          </h1>
          <p className="flex flex-wrap items-center gap-x-1.5 text-body text-ink">
            {order.customerId ? (
              <Link
                href={`/ugyfelek/${order.customerId}`}
                className="font-medium text-ink underline-offset-2 hover:underline"
              >
                {order.customerName}
              </Link>
            ) : (
              <span className="font-medium">{order.customerName}</span>
            )}
            <span className="text-ink-muted" aria-hidden>
              ·
            </span>
            <a
              href={`tel:${order.customerMobile.replace(/\s/g, '')}`}
              className="tabular-nums underline-offset-2 hover:underline"
            >
              {order.customerMobile}
            </a>
            {order.promisedDate ? (
              <>
                <span className="text-ink-muted" aria-hidden>
                  ·
                </span>
                <span>
                  <span className="text-ink-secondary">Ígért nap: </span>
                  {fmtDate(order.promisedDate)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        {order.status !== 'torolve' ? (
          <CsoJourneyStepper steps={journey} />
        ) : (
          <p
            className="max-w-xl rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body font-medium text-danger-ink"
            role="status"
          >
            Lemondva
          </p>
        )}
        {legacyAtadvaWithoutSale ? (
          <p
            className="max-w-xl rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink"
            role="status"
          >
            Átadott tétel értékesítés nélkül (régi átadás).
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Bal: tételek */}
        <div className="min-w-0 space-y-3 lg:col-span-9">
          <section className="overflow-hidden rounded-lg border border-border bg-surface">
            <header className="flex items-center justify-between gap-2 border-b border-border bg-subtle px-3 py-2">
              <h2 className="text-h3 text-ink">Tételek</h2>
              {canWrite && order.status !== 'torolve' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Tétel hozzáadása
                </Button>
              ) : null}
            </header>
            <div className="overflow-x-auto">
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
                    <DataTableHeaderCell>Beszállító</DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      Menny.
                    </DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      Bruttó / eg.
                    </DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      Összeg
                    </DataTableHeaderCell>
                    <DataTableHeaderCell>Állapot</DataTableHeaderCell>
                    {canWrite ? (
                      <DataTableHeaderCell className="w-10">
                        <span className="sr-only">Szerkesztés</span>
                      </DataTableHeaderCell>
                    ) : null}
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {activeItems.length === 0 ? (
                    <DataTableRow>
                      <DataTableCell
                        colSpan={canWrite ? 8 : 6}
                        className="py-6 text-ink-secondary"
                      >
                        Nincs aktív tétel.
                      </DataTableCell>
                    </DataTableRow>
                  ) : null}
                  {activeItems.map((item) => {
                    const hasPrice = csoHasPrice(item.unitPriceGross)
                    const needSupplier =
                      canWrite &&
                      item.status === 'felveve' &&
                      Boolean(item.accessoryId) &&
                      !item.supplierId
                    const freeBlocked =
                      item.status === 'felveve' && !item.accessoryId
                    const partialHint = csoPartialArriveHint({
                      status: item.status,
                      qty: item.qty,
                      unitShortform: item.unitShortform,
                      poQtyOrdered: item.poQtyOrdered,
                      poQtyReceived: item.poQtyReceived
                    })
                    const isSelected = selected.has(item.id)
                    return (
                      <DataTableRow
                        key={item.id}
                        className={cn('align-top', isSelected && 'bg-subtle')}
                      >
                        {canWrite ? (
                          <DataTableCell className="pt-3 align-top">
                            {item.status !== 'atadva' ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggle(item.id)}
                                aria-label={`${item.name} kijelölése`}
                                className="size-3.5 accent-[var(--color-primary,#18181B)]"
                              />
                            ) : null}
                          </DataTableCell>
                        ) : null}
                        <DataTableCell className="py-2 align-top">
                          <div className="min-w-[11rem] max-w-md space-y-0.5">
                            <p className="whitespace-normal break-words text-[14px] font-semibold leading-snug text-ink">
                              {item.name}
                            </p>
                            <p className="text-body text-ink-secondary">
                              {item.sku ? (
                                <span className="font-mono">{item.sku}</span>
                              ) : (
                                <span className="text-ink-muted">nincs SKU</span>
                              )}
                              {!item.accessoryId ? (
                                <span
                                  className={cn(
                                    freeBlocked && 'font-medium text-warning-ink'
                                  )}
                                >
                                  {' · '}Szabad tétel
                                </span>
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
                        <DataTableCell className="py-2 align-top">
                          {needSupplier ? (
                            <div className="w-[11rem]">
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
                                placeholder="Válassz…"
                                searchable={suppliers.length > 8}
                                options={supplierOptions}
                                disabled={pending}
                                triggerClassName="border-warning text-warning-ink"
                              />
                            </div>
                          ) : (
                            <p
                              className="max-w-[11rem] truncate pt-0.5 text-body text-ink"
                              title={item.supplierName ?? undefined}
                            >
                              {item.supplierName ?? (
                                <span className="text-ink-muted">—</span>
                              )}
                            </p>
                          )}
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
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Tétel szerkesztése"
                              onClick={() => setEditItemId(item.id)}
                              aria-label={`${item.name} szerkesztése`}
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </Button>
                          </DataTableCell>
                        ) : null}
                      </DataTableRow>
                    )
                  })}
                </DataTableBody>
              </DataTable>
            </div>
          </section>

          {cancelledItems.length > 0 ? (
            <details className="rounded-lg border border-border bg-surface">
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

          {order.note?.trim() ? (
            <section className="rounded-lg border border-border bg-surface p-3">
              <h2 className="mb-1 text-h3 text-ink">Megjegyzés</h2>
              <p className="whitespace-pre-wrap break-words text-body text-ink-secondary">
                {order.note.trim()}
              </p>
            </section>
          ) : null}
        </div>

        {/* Jobb: pénz (sticky) + műveletek */}
        <aside className="lg:col-span-3">
          <div className="space-y-3 lg:sticky lg:top-14">
            <DueAmountCard
              className="hidden lg:block"
              label={dueLabel}
              amount={`${formatMoneyFt(dueAmount)} Ft`}
              footnote={dueCardFootnote}
              muted={dueMuted}
              strike={moneyState === 'cancelled'}
            />

            {canWrite ? (
              <section className="rounded-lg border border-border-strong bg-surface p-3 shadow-sm">
                <h2 className="mb-3 text-h3 text-ink">Műveletek</h2>
                <div className="flex flex-col gap-1.5">
                  {selecting ? (
                    <p className="text-label font-semibold text-ink-secondary">
                      {selectedItems.length} tétel kijelölve
                    </p>
                  ) : null}
                  {actions.map((a) => renderAction(a))}
                  {selecting ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setSelected(new Set())}
                    >
                      Kijelölés törlése
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={() => setHeaderOpen(true)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Adatok szerkesztése
                    </Button>
                  )}

                  {fullyCancelled ? (
                    <div className="mt-1.5 space-y-1.5 border-t border-border pt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-start"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            restoreSpecialOrderAction({ orderId: order.id })
                          )
                        }
                      >
                        <RotateCcw className="size-3.5" aria-hidden />
                        Összes tétel visszaállítása
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start"
                        disabled={pending}
                        onClick={() => setConfirm({ kind: 'hide-order' })}
                      >
                        <EyeOff className="size-3.5" aria-hidden />
                        Elrejtés a listáról
                      </Button>
                    </div>
                  ) : null}

                  {showCancelOrder && !selecting ? (
                    <div className="mt-1.5 space-y-1.5 border-t border-border pt-3">
                      <Button
                        type="button"
                        variant="danger"
                        className="w-full"
                        disabled={pending || Boolean(cancelBlockedReason)}
                        title={cancelBlockedReason ?? undefined}
                        onClick={() => setConfirm({ kind: 'cancel-order' })}
                      >
                        Rendelés lemondása
                      </Button>
                      {cancelBlockedReason ? (
                        <p className="text-hint text-ink-muted">
                          {cancelBlockedReason}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="rounded-lg border border-border bg-surface p-3">
              <dl className="space-y-1.5 text-body">
                <div>
                  <dt className="text-hint text-ink-secondary">Felvéve</dt>
                  <dd className="text-ink">{fmtDateTime(order.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-hint text-ink-secondary">SMS</dt>
                  <dd className="text-ink">
                    {formatReadySmsInfoLine({
                      sentAt: order.smsSentAt,
                      firstOpenedAt: order.statusLinkFirstOpenedAt,
                      formatDateTime: (iso) =>
                        new Intl.DateTimeFormat('hu-HU', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        }).format(new Date(iso))
                    })}
                  </dd>
                </div>
                {order.saleLinks.length > 0 ? (
                  <div>
                    <dt className="text-hint text-ink-secondary">Eladás</dt>
                    <dd className="text-ink">
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
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          </div>
        </aside>
      </div>

      <DueAmountBar
        label={selecting ? `${selectedItems.length} tétel kijelölve` : dueLabel}
        amount={`${formatMoneyFt(dueAmount)} Ft`}
        footnote={selecting ? null : dueBarFootnote}
        muted={dueMuted}
        strike={moneyState === 'cancelled'}
        action={primaryAction ? renderAction(primaryAction, false) : undefined}
      />

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
