'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  Copy,
  Handshake,
  MessageSquare,
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Wallet,
  type LucideIcon
} from 'lucide-react'
import { toast } from 'sonner'

import { ArrivalSmsDialog, HandoverDialog, OrderTextDialog } from '@/components/manual-orders/manual-order-dialogs'
import { ManualOrderDepositDialog } from '@/components/manual-orders/manual-order-deposit-dialog'
import {
  AddItemDialog,
  BillingDialog,
  ChangeCustomerDialog,
  EditHeaderDialog,
  EditItemDialog
} from '@/components/manual-orders/manual-order-edit-dialogs'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { DueAmountBar, DueAmountCard } from '@/components/patterns/due-amount'
import { StatusBadge, type StatusBadgeTone } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  cancelManualOrderAction,
  getManualOrderStatusLinkAction,
  resendManualOrderSmsAction,
  setManualItemsStatusAction,
  voidManualDepositAction
} from '@/lib/manual-orders/actions'
import type { OrderShareLinkInfo } from '@/lib/order-status/links'
import { moFmtDateTime, moFmtQty } from '@/lib/manual-orders/format'
import {
  MO_ACTION_FROM,
  MO_ACTION_LABEL,
  MO_DEPOSIT_METHOD_LABEL,
  MO_ITEM_STATUS_LABEL,
  MO_STATUS_LABEL,
  MO_STATUS_TONE,
  moDepositTotal,
  moLineGross,
  moNextAction,
  type MoDepositMethod,
  type MoDetail,
  type MoEvent,
  type MoItem,
  type MoItemStatus
} from '@/lib/manual-orders/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

type SupplierOpt = { id: string; name: string }

const STEPS: MoItemStatus[] = ['nyitott', 'megrendelve', 'megerkezett', 'atadva']
const STEP_LABEL: Record<string, string> = {
  nyitott: 'Felvéve',
  megrendelve: 'Megrendelve',
  megerkezett: 'Megjött',
  atadva: 'Átadva'
}
const ACTION_ICON: Partial<Record<MoItemStatus, LucideIcon>> = {
  megrendelve: Truck,
  megerkezett: PackageCheck,
  atadva: Handshake
}
const ITEM_ACTIONS: MoItemStatus[] = ['megrendelve', 'megerkezett', 'atadva']

const METHOD_CHIP: Record<MoDepositMethod, { tone: StatusBadgeTone; variant: 'solid' | 'outline' }> = {
  keszpenz: { tone: 'success', variant: 'solid' },
  kartya: { tone: 'info', variant: 'solid' },
  atutalas: { tone: 'neutral', variant: 'outline' }
}

function Ft(n: number) {
  return `${formatMoneyFt(n)} Ft`
}

function InfoCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-subtle/50 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-body font-semibold text-ink">{title}</h3>
        {action}
      </div>
      <div className="text-body leading-relaxed text-ink-secondary">{children}</div>
    </div>
  )
}

function EditIcon({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={onClick} aria-label={label}>
      <Pencil className="size-3.5" aria-hidden />
    </Button>
  )
}

function itemStamp(i: MoItem): string | null {
  const pick =
    i.status === 'atadva'
      ? [i.handedOverAt, i.handedOverByLabel]
      : i.status === 'megerkezett'
        ? [i.arrivedAt, i.arrivedByLabel]
        : i.status === 'megrendelve'
          ? [i.orderedAt, i.orderedByLabel]
          : [null, null]
  if (!pick[0]) return null
  return `${moFmtDateTime(pick[0])}${pick[1] ? ` · ${pick[1]}` : ''}`
}

function eventBadge(e: MoEvent): { label: string; tone: StatusBadgeTone } {
  switch (e.kind) {
    case 'created':
      return { label: 'Felvéve', tone: 'neutral' }
    case 'status':
      return e.status
        ? { label: MO_ITEM_STATUS_LABEL[e.status], tone: MO_STATUS_TONE[e.status] }
        : { label: 'Státusz', tone: 'neutral' }
    case 'sms':
      return { label: 'SMS', tone: 'info' }
    case 'deposit':
      return { label: 'Előleg', tone: 'success' }
    case 'deposit_void':
      return { label: 'Sztornó', tone: 'danger' }
    case 'items_added':
      return { label: 'Tétel +', tone: 'neutral' }
    default:
      return { label: 'Módosítás', tone: 'neutral' }
  }
}

function eventDetail(e: MoEvent): string {
  if (e.kind === 'status' || e.kind === 'items_added') return `${e.itemCount ?? 0} tétel`
  if (e.kind === 'created') return e.detail ?? 'Rendelés felvéve'
  return e.detail ?? '—'
}

export function ManualOrderDetailClient({
  order,
  suppliers,
  canWrite,
  statusLink = null
}: {
  order: MoDetail
  suppliers: SupplierOpt[]
  canWrite: boolean
  statusLink?: OrderShareLinkInfo | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function copyStatusLink() {
    const res = statusLink ? { ok: true as const, url: statusLink.url } : await getManualOrderStatusLinkAction({ orderId: order.id })
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    try {
      await navigator.clipboard.writeText(res.url)
      toast.success('Link a vágólapon — küldheted a vevőnek.')
    } catch {
      toast.error(res.url)
    }
  }
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [arrivalIds, setArrivalIds] = useState<string[] | null>(null)
  const [textOpen, setTextOpen] = useState(false)
  const [handoverItems, setHandoverItems] = useState<MoItem[] | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [voidId, setVoidId] = useState<string | null>(null)

  const activeItems = useMemo(() => order.items.filter((i) => i.status !== 'torolve'), [order.items])
  const scope = selected.size > 0 ? activeItems.filter((i) => selected.has(i.id)) : activeItems
  const total = activeItems.reduce((s, i) => s + moLineGross(i.unitPriceGross, i.qty), 0)
  const unpriced = activeItems.filter((i) => i.unitPriceGross == null).length
  const paid = moDepositTotal(order.deposits)
  const due = Math.max(0, total - paid)
  const overpaid = unpriced === 0 ? Math.max(0, paid - total) : 0
  const cancelled = order.status === 'torolve'
  const closed = order.status === 'atadva' || cancelled
  const next = moNextAction(order.status)
  const readyCount = activeItems.filter((i) => i.status === 'megerkezett').length
  const textItems = scope.filter((i) => i.status === 'nyitott' || i.status === 'megrendelve')
  const textIds = useMemo(
    () => ({
      open: textItems.filter((i) => i.status === 'nyitott').map((i) => i.id),
      reorder: textItems.filter((i) => i.status === 'megrendelve').map((i) => i.id)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textItems.map((i) => `${i.id}:${i.status}`).join(',')]
  )
  const stepIdx = STEPS.indexOf(order.status)
  const statusCounts = activeItems.reduce<Partial<Record<MoItemStatus, number>>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1
    return acc
  }, {})
  const progressText =
    activeItems.length === 0
      ? 'Nincs aktív tétel.'
      : `${activeItems.length} tétel: ` +
        (
          [
            ['atadva', 'átadva'],
            ['megerkezett', 'megjött'],
            ['megrendelve', 'úton'],
            ['nyitott', 'megrendelendő']
          ] as const
        )
          .filter(([s]) => statusCounts[s])
          .map(([s, label]) => `${statusCounts[s]} ${label}`)
          .join(', ')
  const [editItem, setEditItem] = useState<MoItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<MoItem | null>(null)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [billingOpen, setBillingOpen] = useState(false)
  const cancelEvent = cancelled ? order.events.find((e) => e.kind === 'status' && e.status === 'torolve') : undefined

  function applicable(target: MoItemStatus): MoItem[] {
    return scope.filter((i) => MO_ACTION_FROM[target].includes(i.status))
  }

  function refresh() {
    setSelected(new Set())
    router.refresh()
  }

  /** Státuszváltás + 10 mp „Visszavonás” (az előző állapotokra csoportosítva). */
  function changeWithUndo(items: MoItem[], target: MoItemStatus, successText: string) {
    const before = new Map<MoItemStatus, string[]>()
    for (const i of items) before.set(i.status, [...(before.get(i.status) ?? []), i.id])
    startTransition(async () => {
      const res = await setManualItemsStatusAction({ itemIds: items.map((i) => i.id), status: target })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      refresh()
      toast.success(successText, {
        duration: 10_000,
        action: {
          label: 'Visszavonás',
          onClick: () =>
            void Promise.all(
              [...before.entries()].map(([status, itemIds]) => setManualItemsStatusAction({ itemIds, status }))
            ).then((all) => {
              if (all.every((r) => r.ok)) toast.success('Visszavonva.')
              else toast.error('Nem sikerült visszavonni.')
              router.refresh()
            })
        }
      })
    })
  }

  function runAction(target: MoItemStatus, only?: MoItem[]) {
    const items = (only ?? scope).filter((i) => MO_ACTION_FROM[target].includes(i.status))
    if (items.length === 0) return
    if (target === 'megerkezett') return setArrivalIds(items.map((i) => i.id))
    if (target === 'atadva') {
      setHandoverItems(items)
      return
    }
    changeWithUndo(items, target, `${items.length} tétel: ${MO_ITEM_STATUS_LABEL[target]}.`)
  }

  function blockedReason(target: MoItemStatus): string | null {
    if (!canWrite) return null
    if (applicable(target).length > 0) return null
    if (target === 'megrendelve') return 'nincs nyitott tétel'
    if (target === 'megerkezett') return 'nincs nyitott vagy megrendelt tétel'
    return 'még nincs megjött tétel'
  }

  const nextReason = next ? blockedReason(next) : null
  const secondaryActions = ITEM_ACTIONS.filter((t) => t !== next)
  const editable = canWrite && !closed
  const smsReason = !order.customerMobile
    ? 'nincs mobilszám'
    : readyCount === 0
      ? 'csak megjött tételnél küldhető'
      : null

  const allChecked = activeItems.length > 0 && activeItems.every((i) => selected.has(i.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const dueFootnote = (
    <>
      {paid > 0 ? `Előleg ${Ft(paid)} · ` : 'Nincs előleg · '}
      Bruttó {Ft(total)}
      {unpriced > 0 ? (
        <span className="block text-warning-ink">{unpriced} tételnek nincs ára — nem végleges</span>
      ) : null}
      {overpaid > 0 ? <span className="block text-warning-ink">Túlfizetés {Ft(overpaid)} — visszaadandó</span> : null}
      {canWrite && !cancelled ? (
        <button
          type="button"
          className="mt-1.5 block text-ink underline-offset-2 hover:underline"
          onClick={() => setDepositOpen(true)}
        >
          + Előleg rögzítése
        </button>
      ) : null}
    </>
  )

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      {/* Fejléc */}
      <div className="space-y-2">
        <div className="space-y-1">
          <Link
            href="/kezi-rendelesek"
            className="inline-block text-body text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
          >
            ← Kézi rendelések
          </Link>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-h1 font-semibold text-ink">{order.orderNumber}</h1>
            <StatusBadge tone={MO_STATUS_TONE[order.status]}>{MO_STATUS_LABEL[order.status]}</StatusBadge>
            {paid > 0 ? (
              <StatusBadge tone="success" variant="outline">
                Előleg {Ft(paid)}
              </StatusBadge>
            ) : null}
          </div>
          <p className="text-body text-ink">
            {order.customerName}
            <span className="text-ink-secondary">
              {' · '}felvéve {moFmtDateTime(order.createdAt)}
              {order.createdByLabel ? ` · felvette ${order.createdByLabel}` : ''}
            </span>
          </p>
        </div>

        {cancelled ? (
          <div
            className="max-w-xl rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink"
            role="status"
          >
            <p className="font-medium">
              Lemondva
              {cancelEvent ? ` · ${moFmtDateTime(cancelEvent.createdAt)}` : ''}
              {cancelEvent?.actorLabel ? ` · ${cancelEvent.actorLabel}` : ''}
            </p>
            {paid > 0 ? <p className="mt-0.5">Az előleget ({Ft(paid)}) vissza kell adni, majd sztornózni.</p> : null}
          </div>
        ) : (
          <div className="space-y-1.5">
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-1" aria-label="Rendelés állapota">
              {STEPS.map((s, idx) => {
                const done = stepIdx > idx
                const current = stepIdx === idx
                return (
                  <li key={s} className="flex items-center gap-1">
                    {idx > 0 ? (
                      <span className="mx-0.5 text-hint text-ink-muted" aria-hidden>
                        →
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-hint',
                        current && 'bg-ink font-medium text-surface',
                        done && !current && 'font-medium text-ink',
                        !done && !current && 'text-ink-secondary'
                      )}
                      aria-current={current ? 'step' : undefined}
                    >
                      {STEP_LABEL[s]}
                    </span>
                  </li>
                )
              })}
            </ol>
            <p className="text-body text-ink-secondary" role="status">
              {progressText}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Bal: dokumentum */}
        <div className="min-w-0 space-y-3 lg:col-span-9">
          <section className="space-y-3 rounded-lg border border-border bg-surface p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <InfoCard
                title="Vevő"
                action={
                  editable ? <EditIcon label="Vevő adatainak szerkesztése" onClick={() => setEditOpen(true)} /> : null
                }
              >
                {order.customerId ? (
                  <Link
                    href={`/ugyfelek/${order.customerId}`}
                    className="font-medium text-ink no-underline hover:underline"
                  >
                    {order.customerName}
                  </Link>
                ) : (
                  <p className="font-medium text-ink">{order.customerName}</p>
                )}
                {order.customerMobile ? (
                  <a
                    href={`tel:${order.customerMobile.replace(/\s/g, '')}`}
                    className="block tabular-nums hover:text-ink hover:underline"
                  >
                    {order.customerMobile}
                  </a>
                ) : (
                  <p className="text-warning-ink">Nincs mobilszám — SMS nem küldhető</p>
                )}
                <p className="text-hint">
                  {order.smsSentAt ? `SMS kiküldve: ${moFmtDateTime(order.smsSentAt)}` : 'Még nem ment SMS'}
                  {order.smsSentAt && statusLink
                    ? statusLink.firstOpenedAt
                      ? ` · megnyitva ${moFmtDateTime(statusLink.lastOpenedAt ?? statusLink.firstOpenedAt)}`
                      : ' · még nem nyitotta meg'
                    : ''}
                </p>
                <button
                  type="button"
                  className="mt-1 block text-hint text-ink underline-offset-2 hover:underline"
                  onClick={copyStatusLink}
                >
                  Státuszlink másolása
                </button>
                {editable ? (
                  <button
                    type="button"
                    className="mt-1 text-hint text-ink underline-offset-2 hover:underline"
                    onClick={() => setCustomerOpen(true)}
                  >
                    Másik vevő…
                  </button>
                ) : null}
              </InfoCard>
              <InfoCard
                title="Megjegyzés"
                action={
                  editable ? <EditIcon label="Megjegyzés szerkesztése" onClick={() => setEditOpen(true)} /> : null
                }
              >
                {order.note ? <p className="whitespace-pre-wrap text-ink">{order.note}</p> : <p>Nincs megjegyzés.</p>}
              </InfoCard>
              <InfoCard
                title="Számlázás"
                action={
                  canWrite && order.customerId && order.billing ? (
                    <EditIcon label="Számlázási adatok szerkesztése" onClick={() => setBillingOpen(true)} />
                  ) : null
                }
              >
                {order.billing ? (
                  <>
                    <p className="font-medium text-ink">{order.billing.name}</p>
                    <p>
                      {[order.billing.postalCode, order.billing.city].filter(Boolean).join(' ')}
                      {order.billing.street ? `, ${order.billing.street} ${order.billing.houseNumber}`.trimEnd() : ''}
                    </p>
                    {order.billing.taxNumber ? <p>Adószám: {order.billing.taxNumber}</p> : null}
                  </>
                ) : order.customerId ? (
                  <>
                    <p>Magánszemélyként fizet (nincs megadva).</p>
                    {canWrite ? (
                      <Button size="sm" variant="secondary" className="mt-1.5" onClick={() => setBillingOpen(true)}>
                        Cégnek számlázzon…
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <p>Előbb rendelj a rendeléshez ügyfelet.</p>
                )}
              </InfoCard>
            </div>

            <div className="border-t border-border pt-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-h3 font-semibold text-ink">
                  Tételek <span className="font-normal text-ink-secondary">· {activeItems.length}</span>
                </h2>
                <Button size="sm" variant="secondary" disabled={!canWrite || closed} onClick={() => setAddOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  Tétel hozzáadása
                </Button>
              </div>
              <div className="overflow-hidden rounded-md border border-border">
                <DataTable className="rounded-none border-0">
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableHeaderCell className="w-8">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-ink"
                          checked={allChecked}
                          disabled={activeItems.length === 0}
                          onChange={() => setSelected(allChecked ? new Set() : new Set(activeItems.map((i) => i.id)))}
                          aria-label="Összes kijelölése"
                        />
                      </DataTableHeaderCell>
                      <DataTableHeaderCell>Termék</DataTableHeaderCell>
                      <DataTableHeaderCell>Beszállító</DataTableHeaderCell>
                      <DataTableHeaderCell align="right">Menny.</DataTableHeaderCell>
                      <DataTableHeaderCell align="right">Összeg</DataTableHeaderCell>
                      <DataTableHeaderCell>Állapot</DataTableHeaderCell>
                      {canWrite ? (
                        <DataTableHeaderCell align="right">
                          <span className="sr-only">Műveletek</span>
                        </DataTableHeaderCell>
                      ) : null}
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {order.items.map((i) => {
                      const off = i.status === 'torolve'
                      const stamp = itemStamp(i)
                      const rowNext = moNextAction(i.status)
                      return (
                        <DataTableRow
                          key={i.id}
                          className={cn(off && 'opacity-60', selected.has(i.id) && 'bg-subtle/60')}
                        >
                          <DataTableCell>
                            <input
                              type="checkbox"
                              className="size-3.5 accent-ink"
                              disabled={off}
                              checked={selected.has(i.id)}
                              onChange={() => toggle(i.id)}
                              aria-label={`${i.name} kijelölése`}
                            />
                          </DataTableCell>
                          <DataTableCell className="py-1.5">
                            <span
                              className={cn('block whitespace-normal break-words font-medium', off && 'line-through')}
                            >
                              {i.name}
                            </span>
                            {i.sku || i.note ? (
                              <span className="block text-hint text-ink-secondary">
                                {[i.sku, i.note].filter(Boolean).join(' · ')}
                              </span>
                            ) : null}
                          </DataTableCell>
                          <DataTableCell className="text-ink-secondary">{i.supplierName ?? '—'}</DataTableCell>
                          <DataTableCell align="right" className="whitespace-nowrap">
                            {moFmtQty(i.qty)} {i.unitShortform}
                          </DataTableCell>
                          <DataTableCell align="right" className="whitespace-nowrap">
                            {i.unitPriceGross == null ? (
                              <span className="text-warning-ink">nincs ár</span>
                            ) : (
                              Ft(moLineGross(i.unitPriceGross, i.qty))
                            )}
                          </DataTableCell>
                          <DataTableCell className="py-1.5">
                            <StatusBadge tone={MO_STATUS_TONE[i.status]}>{MO_ITEM_STATUS_LABEL[i.status]}</StatusBadge>
                            {stamp ? (
                              <span className="block whitespace-nowrap text-hint text-ink-secondary">{stamp}</span>
                            ) : null}
                          </DataTableCell>
                          {canWrite ? (
                            <DataTableCell align="right" className="whitespace-nowrap">
                              <div className="flex items-center justify-end gap-0.5">
                                {rowNext ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={pending}
                                    onClick={() => runAction(rowNext, [i])}
                                  >
                                    {MO_ACTION_LABEL[rowNext]}
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-1.5"
                                  aria-label={`${i.name} szerkesztése`}
                                  onClick={() => setEditItem(i)}
                                >
                                  <Pencil className="size-3.5" aria-hidden />
                                </Button>
                                {i.status !== 'atadva' && !off ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-1.5 text-ink-muted hover:text-danger-ink"
                                    aria-label={`${i.name} törlése`}
                                    onClick={() => setDeleteItem(i)}
                                  >
                                    <Trash2 className="size-3.5" aria-hidden />
                                  </Button>
                                ) : (
                                  <span className="inline-block w-[1.875rem]" aria-hidden />
                                )}
                              </div>
                            </DataTableCell>
                          ) : null}
                        </DataTableRow>
                      )
                    })}
                  </DataTableBody>
                </DataTable>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-subtle/40 px-3 py-2 text-body">
                  <span className="text-ink-secondary">
                    {unpriced > 0 ? (
                      <span className="text-warning-ink">{unpriced} tételnek nincs ára — az összeg nem végleges</span>
                    ) : null}
                  </span>
                  <span className="text-ink-secondary">
                    Bruttó összesen <span className="font-semibold tabular-nums text-ink">{Ft(total)}</span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Előleg és befizetések */}
          <section id="elolegek" className="scroll-mt-16 space-y-3 rounded-md border border-border bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-body font-semibold text-ink">Előleg és befizetések</h2>
                  <StatusBadge tone={paid > 0 ? 'success' : 'neutral'}>
                    {paid > 0 ? 'Van előleg' : 'Nincs előleg'}
                  </StatusBadge>
                </div>
                <p className="text-hint text-ink-secondary">
                  {paid > 0 ? (
                    <>
                      Befizetve <span className="font-medium tabular-nums text-ink">{Ft(paid)}</span>
                      {due > 0 ? (
                        <>
                          {' · '}Átvételkor <span className="font-medium tabular-nums text-warning-ink">{Ft(due)}</span>
                        </>
                      ) : null}
                      {overpaid > 0 ? (
                        <>
                          {' · '}Túlfizetés{' '}
                          <span className="font-medium tabular-nums text-warning-ink">{Ft(overpaid)}</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    'A teljes összeget átvételkor, a kasszán fizeti.'
                  )}
                </p>
              </div>
              {canWrite && !cancelled ? (
                <Button size="sm" variant="secondary" onClick={() => setDepositOpen(true)}>
                  <Wallet className="size-3.5" aria-hidden />
                  Előleg rögzítése
                </Button>
              ) : null}
            </div>

            {order.deposits.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-hint text-ink-secondary">
                Még nincs rögzített előleg{canWrite && !cancelled ? ' — használd az Előleg rögzítése gombot.' : '.'}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {order.deposits.map((d) => {
                  const chip = METHOD_CHIP[d.method]
                  const voided = Boolean(d.voidedAt)
                  return (
                    <li
                      key={d.id}
                      className={cn(
                        'flex max-w-full items-center gap-1 rounded-md border border-border py-1 pl-2 pr-1',
                        voided ? 'bg-danger-soft/40 opacity-80' : 'bg-subtle/60'
                      )}
                    >
                      <div className="min-w-0 px-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge tone={chip.tone} variant={chip.variant}>
                            {MO_DEPOSIT_METHOD_LABEL[d.method]}
                          </StatusBadge>
                          <span
                            className={cn(
                              'text-body font-semibold tabular-nums text-ink',
                              voided && 'text-ink-muted line-through'
                            )}
                          >
                            {Ft(d.amount)}
                          </span>
                          {d.kind === 'atadas' ? <span className="text-hint text-ink-secondary">átadáskor</span> : null}
                          {voided ? <span className="text-hint text-danger-ink">sztornó</span> : null}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                          {[d.createdByLabel, moFmtDateTime(d.createdAt), d.note].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {canWrite && !voided ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-1.5 text-danger-ink hover:text-danger-ink"
                          aria-label="Előleg sztornózása"
                          onClick={() => setVoidId(d.id)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Tevékenység */}
          <details className="group space-y-2 rounded-md border border-border bg-surface p-3">
            <summary className="cursor-pointer text-body font-semibold text-ink">
              Napló <span className="font-normal text-ink-secondary">({order.events.length})</span>
            </summary>
            <DataTable className="min-w-0">
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell className="whitespace-nowrap">Időpont</DataTableHeaderCell>
                  <DataTableHeaderCell>Esemény</DataTableHeaderCell>
                  <DataTableHeaderCell>Részlet</DataTableHeaderCell>
                  <DataTableHeaderCell className="hidden sm:table-cell">Ki</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {order.events.map((e) => {
                  const b = eventBadge(e)
                  return (
                    <DataTableRow key={e.id}>
                      <DataTableCell className="whitespace-nowrap text-hint text-ink-secondary">
                        {moFmtDateTime(e.createdAt)}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone={b.tone}>{b.label}</StatusBadge>
                      </DataTableCell>
                      <DataTableCell className="text-ink-secondary">
                        <span className="line-clamp-2" title={eventDetail(e)}>
                          {eventDetail(e)}
                        </span>
                      </DataTableCell>
                      <DataTableCell className="hidden text-ink-secondary sm:table-cell">
                        {e.actorLabel ?? '—'}
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
          </details>
        </div>

        {/* Jobb: sticky sáv */}
        <aside className="lg:col-span-3">
          <div className="space-y-3 lg:sticky lg:top-14">
            <DueAmountCard
              className="hidden lg:block"
              label="Átvételkor fizet"
              amount={Ft(due)}
              muted={closed || due === 0}
              strike={cancelled}
              footnote={dueFootnote}
            />

            {canWrite ? (
              <section className="rounded-lg border border-border-strong bg-surface p-3 shadow-sm">
                <h2 className="mb-3 text-h3 text-ink">Teendő</h2>
                {selected.size > 0 ? (
                  <p className="mb-3 rounded-md bg-subtle px-2 py-1.5 text-hint text-ink">
                    {selected.size} tétel kijelölve — a gombok erre vonatkoznak.{' '}
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => setSelected(new Set())}
                    >
                      Kijelölés törlése
                    </button>
                  </p>
                ) : null}
                <div className="flex flex-col gap-2">
                  {next ? (
                    <>
                      <ActionButton
                        target={next}
                        primary
                        count={applicable(next).length}
                        disabled={pending || Boolean(nextReason)}
                        loading={pending}
                        onClick={() => runAction(next)}
                      />
                      {nextReason ? <p className="text-hint text-warning-ink">Nem lehet: {nextReason}.</p> : null}
                    </>
                  ) : (
                    <p className="text-hint text-ink-secondary">
                      {cancelled ? 'A rendelés le van mondva.' : closed ? 'Minden tétel átadva.' : 'Nincs teendő.'}
                    </p>
                  )}
                  {secondaryActions
                    .filter((t) => applicable(t).length > 0)
                    .map((t) => (
                      <ActionButton
                        key={t}
                        target={t}
                        count={applicable(t).length}
                        disabled={pending || Boolean(blockedReason(t))}
                        onClick={() => runAction(t)}
                      />
                    ))}
                  <div className="flex flex-col gap-2 border-t border-border pt-2">
                    {textItems.length > 0 ? (
                      <Button variant="secondary" className="w-full justify-start" onClick={() => setTextOpen(true)}>
                        <Copy className="size-3.5" aria-hidden />
                        Rendelési szöveg
                      </Button>
                    ) : null}
                    {!smsReason ? (
                      <Button
                        variant="secondary"
                        className="w-full justify-start"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await resendManualOrderSmsAction({ orderId: order.id })
                            if (!res.ok) toast.error(res.message)
                            else {
                              toast.success(res.message ?? 'SMS elküldve.')
                              router.refresh()
                            }
                          })
                        }
                      >
                        <MessageSquare className="size-3.5" aria-hidden />
                        {order.smsSentAt ? 'SMS újraküldése' : 'SMS a vevőnek'}
                      </Button>
                    ) : (
                      <p className="text-hint text-ink-muted">SMS: {smsReason}.</p>
                    )}
                    {!closed ? (
                      <Button variant="danger" className="w-full" onClick={() => setCancelOpen(true)}>
                        Rendelés lemondása
                      </Button>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : (
              <p className="text-hint text-ink-muted">Csak olvasási jogod van.</p>
            )}
          </div>
        </aside>
      </div>

      <DueAmountBar
        label="Átvételkor fizet"
        amount={Ft(due)}
        muted={closed || due === 0}
        strike={cancelled}
        footnote={paid > 0 ? `Előleg ${Ft(paid)}` : undefined}
        action={
          next && canWrite && !nextReason ? (
            <Button size="sm" loading={pending} onClick={() => runAction(next)}>
              {MO_ACTION_LABEL[next]}
            </Button>
          ) : undefined
        }
      />

      {/* Ablakok */}
      {arrivalIds ? (
        <ArrivalSmsDialog open onOpenChange={(o) => !o && setArrivalIds(null)} itemIds={arrivalIds} onDone={refresh} />
      ) : null}
      {textOpen ? (
        <OrderTextDialog
          open
          onOpenChange={setTextOpen}
          itemIds={textIds.open}
          reorderIds={textIds.reorder}
          markableIds={applicable('megrendelve').map((i) => i.id)}
          onDone={refresh}
        />
      ) : null}
      {handoverItems ? (
        <HandoverDialog
          open
          onOpenChange={(o) => !o && setHandoverItems(null)}
          customerName={order.customerName}
          items={handoverItems.map((i) => ({
            id: i.id,
            name: i.name,
            qty: i.qty,
            unitShortform: i.unitShortform,
            ready: i.status === 'megerkezett',
            statusLabel: MO_ITEM_STATUS_LABEL[i.status]
          }))}
          onDone={refresh}
        />
      ) : null}
      {editItem ? <EditItemDialog item={editItem} suppliers={suppliers} onClose={() => setEditItem(null)} /> : null}
      {customerOpen ? <ChangeCustomerDialog order={order} onClose={() => setCustomerOpen(false)} /> : null}
      {billingOpen ? (
        <BillingDialog
          orderId={order.id}
          billing={order.billing}
          customerName={order.customerName}
          onClose={() => setBillingOpen(false)}
        />
      ) : null}
      <ConfirmDialog
        open={deleteItem !== null}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title="Törlöd a tételt?"
        description={
          deleteItem?.status === 'megrendelve'
            ? `„${deleteItem.name}” már meg van rendelve — szólj a beszállítónak is.`
            : deleteItem?.status === 'megerkezett'
              ? `„${deleteItem.name}” már a polcon van — tedd vissza a raktárba vagy küldd vissza.`
              : `„${deleteItem?.name ?? ''}” törlődik a rendelésből. 10 mp-ig visszavonható.`
        }
        confirmLabel="Tétel törlése"
        loading={pending}
        onConfirm={() => {
          if (!deleteItem) return
          const it = deleteItem
          setDeleteItem(null)
          const remaining = activeItems.filter((i) => i.id !== it.id).length
          changeWithUndo(
            [it],
            'torolve',
            remaining === 0
              ? `Tétel törölve — a rendelésben nem maradt tétel, ezért lemondva.${paid > 0 ? ' Az előleget add vissza.' : ''}`
              : 'Tétel törölve.'
          )
        }}
      />
      <ManualOrderDepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        orderId={order.id}
        orderNumber={order.orderNumber}
        totalGross={total}
        paid={paid}
        priceMissing={unpriced > 0}
        onDone={() => router.refresh()}
      />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Lemondod a rendelést?"
        description={[
          'A még át nem adott tételek „Törölve” állapotba kerülnek.',
          readyCount > 0
            ? `${readyCount} tétel már a polcon van — tedd vissza vagy küldd vissza a beszállítónak.`
            : null,
          paid > 0 ? `Az előleget (${Ft(paid)}) kézzel kell visszaadni.` : null
        ]
          .filter(Boolean)
          .join(' ')}
        confirmLabel="Lemondás"
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await cancelManualOrderAction({ orderId: order.id })
            if (!res.ok) toast.error(res.message)
            else {
              toast.success('Rendelés lemondva.')
              setCancelOpen(false)
              refresh()
            }
          })
        }
      />
      <ConfirmDialog
        open={voidId !== null}
        onOpenChange={(o) => !o && setVoidId(null)}
        title="Sztornózod az előleget?"
        description="A befizetés áthúzva megmarad a listában és a tevékenységben."
        confirmLabel="Sztornó"
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!voidId) return
            const res = await voidManualDepositAction({ orderId: order.id, depositId: voidId })
            if (!res.ok) toast.error(res.message)
            else {
              toast.success('Előleg sztornózva.')
              setVoidId(null)
              router.refresh()
            }
          })
        }
      />
      {editOpen ? <EditHeaderDialog order={order} readyCount={readyCount} onClose={() => setEditOpen(false)} /> : null}
      {addOpen ? <AddItemDialog orderId={order.id} suppliers={suppliers} onClose={() => setAddOpen(false)} /> : null}
    </div>
  )
}

function ActionButton({
  target,
  count,
  primary = false,
  disabled,
  loading,
  onClick
}: {
  target: MoItemStatus
  count: number
  primary?: boolean
  disabled: boolean
  loading?: boolean
  onClick: () => void
}) {
  const Icon = ACTION_ICON[target]
  return (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      className="w-full justify-start"
      disabled={disabled}
      loading={loading}
      onClick={onClick}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {MO_ACTION_LABEL[target]}
      <span className={cn('ml-auto tabular-nums', primary ? 'text-white/80' : 'text-ink-muted')}>{count}</span>
    </Button>
  )
}
