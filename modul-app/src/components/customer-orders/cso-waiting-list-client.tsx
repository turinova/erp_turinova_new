'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  ClipboardList,
  Copy,
  MessageSquare,
  PackageCheck,
  Search,
  Truck
} from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { CsoLeadOrderDialog } from '@/components/customer-orders/cso-lead-order-dialog'
import { CsoReadySmsDialog } from '@/components/customer-orders/cso-ready-sms-dialog'
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
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  handOverSpecialOrderItemsAction,
  markSpecialOrderItemsArrivedAction,
  previewSpecialOrderReadySmsAction,
  sendSpecialOrderReadySmsAction
} from '@/lib/customer-orders/actions'
import { supplierRowStyle } from '@/lib/customer-orders/supplier-style'
import {
  CSO_WAITING_VIEW_LABEL,
  CSO_WAITING_VIEWS,
  csoItemProgressLabel,
  csoPartialArriveHint,
  csoPoLinkLabel,
  csoStatusTone,
  type CsoWaitingCounts,
  type CsoWaitingListItem,
  type CsoWaitingView
} from '@/lib/customer-orders/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { CsoReadySmsCandidate } from '@/lib/sms/types'
import { cn } from '@/lib/utils'

type SupplierOpt = { id: string; name: string }

type Props = {
  rows: CsoWaitingListItem[]
  total: number
  page: number
  limit: number
  counts: CsoWaitingCounts
  canWrite: boolean
  initialQ: string
  initialView: CsoWaitingView
  initialSupplierId: string
  initialNotifyPending: boolean
  suppliers: SupplierOpt[]
}

const dateFmt = new Intl.DateTimeFormat('hu-HU', {
  timeZone: 'Europe/Budapest',
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})

function fmtDate(iso: string) {
  if (!iso) return '—'
  return dateFmt.format(new Date(iso))
}

function fmtQty(q: number) {
  return q.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

type SupplierGroup = {
  key: string
  supplierId: string | null
  supplierName: string
  items: CsoWaitingListItem[]
}

function groupBySupplier(rows: CsoWaitingListItem[]): SupplierGroup[] {
  const map = new Map<string, SupplierGroup>()
  for (const row of rows) {
    const key = row.supplierId ?? '__none__'
    let g = map.get(key)
    if (!g) {
      g = {
        key,
        supplierId: row.supplierId,
        supplierName: row.supplierName?.trim() || 'Nincs beszállító',
        items: []
      }
      map.set(key, g)
    }
    g.items.push(row)
  }
  return Array.from(map.values())
}

function buildSupplierText(items: CsoWaitingListItem[]): string {
  const bySup = groupBySupplier(items)
  return bySup
    .map((g) => {
      const lines = g.items.map(
        (it) =>
          `• ${it.name}${it.sku ? ` (${it.sku})` : ''} — ${fmtQty(it.qty)} ${it.unitShortform}`
      )
      return `${g.supplierName}\n${lines.join('\n')}`
    })
    .join('\n\n')
}

export function CsoWaitingListClient({
  rows,
  total,
  page,
  limit,
  counts,
  canWrite,
  initialQ,
  initialView,
  initialSupplierId,
  initialNotifyPending,
  suppliers
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [leadOpen, setLeadOpen] = useState(false)
  const [arriveOpen, setArriveOpen] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsCandidates, setSmsCandidates] = useState<CsoReadySmsCandidate[]>([])
  const [smsLoading, setSmsLoading] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const groups = useMemo(() => groupBySupplier(rows), [rows])

  const selectedItems = rows.filter((r) => selected.has(r.id))
  const allLeadable =
    selectedItems.length > 0 &&
    selectedItems.every(
      (i) => i.status === 'felveve' && i.leadBlockers.length === 0
    )
  const blockerCount = selectedItems.filter(
    (i) => i.status === 'felveve' && i.leadBlockers.length > 0
  ).length
  const allOnWay =
    selectedItems.length > 0 &&
    selectedItems.every((i) => i.status === 'rendelve')
  const allReady =
    selectedItems.length > 0 &&
    selectedItems.every((i) => i.status === 'itt_van')
  const smsOrderIds = [
    ...new Set(
      selectedItems
        .filter((i) => i.status === 'itt_van')
        .map((i) => i.orderId)
    )
  ]

  const leadItemIds = useMemo(
    () => selectedItems.filter((i) => i.status === 'felveve').map((i) => i.id),
    [selectedItems]
  )

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!('page' in patch)) next.delete('page')
    const qs = next.toString()
    setSelected(new Set())
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  function toggleAll() {
    if (rows.length === 0) return
    if (rows.every((r) => selected.has(r.id))) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(rows.map((r) => r.id)))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function runAction(
    fn: () => Promise<{ ok: boolean; message?: string }>
  ) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.message ?? 'Hiba')
        return
      }
      toast.success(res.message ?? 'Kész')
      setSelected(new Set())
      setArriveOpen(false)
      setHandoverOpen(false)
      router.refresh()
    })
  }

  async function copySupplierText() {
    if (!selectedItems.length) return
    const text = buildSupplierText(selectedItems)
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Szöveg a vágólapon.')
    } catch {
      toast.error('Nem sikerült a vágólapra másolni.')
    }
  }

  function openSmsDialog() {
    if (smsOrderIds.length === 0) return
    setSmsLoading(true)
    setSmsOpen(true)
    startTransition(async () => {
      const res = await previewSpecialOrderReadySmsAction({
        orderIds: smsOrderIds
      })
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
    runAction(async () => {
      const res = await sendSpecialOrderReadySmsAction({ orderIds })
      if (res.ok) setSmsOpen(false)
      return res
    })
  }

  const emptyHint =
    initialView === 'todo'
      ? 'Minden a beszerzésben van, vagy nincs teendő. Új felvétel az Ügyfélrendeléseknél.'
      : initialView === 'on_way'
        ? 'Nincs tétel beszerzés alatt.'
        : 'Nincs tétel ebben a nézetben.'

  return (
    <div className="space-y-4">
      <PageHeader
        title="Beszállítói várólista"
        description="Tételszintű teendők: megrendelés, beszerzés, átvétel — beszállító szerint csoportosítva."
        actions={
          <Link
            href="/ugyfelrendelesek"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            <ClipboardList className="size-3.5" aria-hidden />
            Ügyfélrendelések
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {CSO_WAITING_VIEWS.map((view) => {
          const active = initialView === view
          const n = counts[view]
          return (
            <button
              key={view}
              type="button"
              disabled={pending}
              onClick={() =>
                pushParams({
                  view,
                  page: null,
                  notify: null
                })
              }
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors',
                active
                  ? 'border-ink bg-ink text-white'
                  : 'border-border bg-white text-ink-secondary hover:bg-subtle'
              )}
            >
              {CSO_WAITING_VIEW_LABEL[view]}
              <span
                className={cn(
                  'tabular-nums text-[12px]',
                  active ? 'text-white/80' : 'text-ink-muted'
                )}
              >
                {n}
              </span>
            </button>
          )
        })}
        {initialView === 'ready' ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              pushParams({
                notify: initialNotifyPending ? null : 'pending',
                page: null
              })
            }
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors',
              initialNotifyPending
                ? 'border-warning bg-warning-soft text-warning-ink'
                : 'border-border bg-white text-ink-secondary hover:bg-subtle'
            )}
          >
            SMS nélkül
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <form
          className="flex min-w-[220px] flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            pushParams({ q: qDraft.trim() || null, page: null })
          }}
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Ügyfél, UR#, termék, SKU…"
              className="h-8 pl-8"
              aria-label="Keresés"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            Keresés
          </Button>
        </form>
        <div className="w-[200px]">
          <label className="mb-1 block text-[12px] text-ink-muted">
            Beszállító
          </label>
          <Select
            value={initialSupplierId || ''}
            onChange={(e) =>
              pushParams({
                supplier: e.target.value || null,
                page: null
              })
            }
            className="h-8"
          >
            <option value="">Mind</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {canWrite && selectedItems.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-subtle/50 px-3 py-2">
          <span className="text-[13px] text-ink-secondary">
            {selectedItems.length} kijelölve
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Törlés
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {(allLeadable || allOnWay) && selectedItems.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => void copySupplierText()}
              >
                <Copy className="size-3.5" aria-hidden />
                Szöveg a beszállítónak
              </Button>
            ) : null}
            {allLeadable ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => setLeadOpen(true)}
              >
                <Truck className="size-3.5" aria-hidden />
                Beszállítótól megrendel ({selectedItems.length})
              </Button>
            ) : null}
            {!allLeadable && blockerCount > 0 ? (
              <span className="text-[12px] text-ink-muted">
                {blockerCount} tételnél nincs beszállító / katalógus — nyisd
                meg a rendelést.
              </span>
            ) : null}
            {allOnWay ? (
              <>
                <Link
                  href="/beerkezesek"
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >
                  <PackageCheck className="size-3.5" aria-hidden />
                  Beérkezéseken vedd fel
                </Link>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setArriveOpen(true)}
                >
                  Kivétel: kézi megérkezett
                </Button>
              </>
            ) : null}
            {allReady ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending || smsOrderIds.length === 0}
                  onClick={openSmsDialog}
                >
                  <MessageSquare className="size-3.5" aria-hidden />
                  SMS küldése
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => setHandoverOpen(true)}
                >
                  Átadás ({selectedItems.length})
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
          <p className="text-[14px] text-ink-secondary">{emptyHint}</p>
          {initialView === 'todo' ? (
            <Link
              href="/ugyfelrendelesek/uj"
              className={cn(
                buttonVariants({ size: 'sm' }),
                'mt-3 inline-flex'
              )}
            >
              Új ügyfélrendelés
            </Link>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              {canWrite ? (
                <DataTableHeaderCell className="w-9">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-ink"
                    checked={
                      rows.length > 0 && rows.every((r) => selected.has(r.id))
                    }
                    onChange={toggleAll}
                    aria-label="Összes kijelölése"
                  />
                </DataTableHeaderCell>
              ) : null}
              <DataTableHeaderCell>Ügyfél / UR</DataTableHeaderCell>
              <DataTableHeaderCell>Termék</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Menny.
              </DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Bruttó
              </DataTableHeaderCell>
              <DataTableHeaderCell>Státusz</DataTableHeaderCell>
              <DataTableHeaderCell>PO</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
              <DataTableHeaderCell className="w-[1%]">
                <span className="sr-only">Művelet</span>
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {groups.map((g) => {
              const style = supplierRowStyle(g.supplierId)
              return (
                <SupplierGroupRows
                  key={g.key}
                  group={g}
                  style={style}
                  canWrite={canWrite}
                  selected={selected}
                  onToggle={toggleOne}
                  colSpan={canWrite ? 9 : 8}
                />
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-secondary">
          <span>
            {from}–{to} / {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending || page <= 1}
              onClick={() =>
                pushParams({ page: String(Math.max(1, page - 1)) })
              }
            >
              Előző
            </Button>
            <span className="tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending || page >= totalPages}
              onClick={() =>
                pushParams({
                  page: String(Math.min(totalPages, page + 1))
                })
              }
            >
              Következő
            </Button>
          </div>
        </div>
      ) : null}

      <CsoLeadOrderDialog
        open={leadOpen}
        onOpenChange={setLeadOpen}
        itemIds={leadItemIds}
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
        open={arriveOpen}
        onOpenChange={setArriveOpen}
        title="Kézi megérkezett — kivétel?"
        description="Normál út: Beérkezések. Kézi jelölésnél későbbi bevételezésnél a készlet mínuszba mehet."
        confirmLabel="Igen, kézi megérkezett"
        cancelLabel="Mégse"
        variant="primary"
        loading={pending}
        onConfirm={() =>
          runAction(() =>
            markSpecialOrderItemsArrivedAction({
              itemIds: selectedItems.map((i) => i.id)
            })
          )
        }
      />

      <ConfirmDialog
        open={handoverOpen}
        onOpenChange={setHandoverOpen}
        title="Átadás"
        description={`${selectedItems.length} tétel átadása ${[...new Set(selectedItems.map((i) => i.orderNumber))].join(', ')} rendelés(ek)ből. Katalógus tételnél készlet kivezetés történik.`}
        confirmLabel="Átadás"
        cancelLabel="Mégse"
        variant="primary"
        loading={pending}
        onConfirm={() =>
          runAction(() =>
            handOverSpecialOrderItemsAction({
              itemIds: selectedItems.map((i) => i.id)
            })
          )
        }
      >
        {selectedItems.some((i) => (i.depositAmount ?? 0) > 0) ? (
          <p className="text-[13px] text-ink-secondary">
            Előleg az érintett rendeléseken — a fizetendő összeget a rendelés
            részletén ellenőrizd.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}

function SupplierGroupRows({
  group,
  style,
  canWrite,
  selected,
  onToggle,
  colSpan
}: {
  group: SupplierGroup
  style: ReturnType<typeof supplierRowStyle>
  canWrite: boolean
  selected: Set<string>
  onToggle: (id: string) => void
  colSpan: number
}) {
  return (
    <>
      <DataTableRow className="hover:bg-transparent">
        <DataTableCell
          colSpan={colSpan}
          className={cn(
            'border-l-4 py-1.5 text-[12.5px] font-medium',
            style.head
          )}
        >
          <span className="inline-flex items-center gap-2">
            <span
              className={cn('size-2 shrink-0 rounded-full', style.dot)}
              aria-hidden
            />
            {group.supplierName}
            <span className="font-normal text-ink-muted tabular-nums">
              {group.items.length} tétel
            </span>
          </span>
        </DataTableCell>
      </DataTableRow>
      {group.items.map((item) => (
        <DataTableRow
          key={item.id}
          className={cn('border-l-4', style.row)}
        >
          {canWrite ? (
            <DataTableCell className="w-9">
              <input
                type="checkbox"
                className="size-3.5 accent-ink"
                checked={selected.has(item.id)}
                onChange={() => onToggle(item.id)}
                aria-label={`${item.name} kijelölése`}
              />
            </DataTableCell>
          ) : null}
          <DataTableCell>
            <div className="min-w-0">
              <div className="truncate text-[13.5px] text-ink">
                {item.customerName}
              </div>
              <Link
                href={`/ugyfelrendelesek/${item.orderId}`}
                className="text-[12px] text-ink-secondary underline-offset-2 hover:underline"
              >
                {item.orderNumber}
              </Link>
            </div>
          </DataTableCell>
          <DataTableCell>
            <div className="max-w-[280px]">
              <div className="whitespace-normal text-[13.5px] text-ink">
                {item.name}
              </div>
              {item.sku ? (
                <div className="text-[12px] text-ink-muted">{item.sku}</div>
              ) : null}
              {item.leadBlockers.length > 0 ? (
                <div className="mt-0.5 text-[12px] text-amber-800">
                  {item.leadBlockers.join(' · ')}
                </div>
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
                  <div className="mt-0.5 text-[12px] text-amber-800">{hint}</div>
                ) : null
              })()}
              {!item.smsSentAt && item.status === 'itt_van' ? (
                <div className="mt-0.5 text-[12px] text-ink-muted">
                  SMS még nem ment
                </div>
              ) : null}
            </div>
          </DataTableCell>
          <DataTableCell className="text-right tabular-nums">
            {fmtQty(item.qty)} {item.unitShortform}
          </DataTableCell>
          <DataTableCell className="text-right tabular-nums">
            {item.unitPriceGross != null
              ? `${formatMoneyFt(item.unitPriceGross)} Ft`
              : '—'}
          </DataTableCell>
          <DataTableCell>
            <StatusBadge tone={csoStatusTone(item.status)}>
              {csoItemProgressLabel(item.status, item.poStatus)}
            </StatusBadge>
          </DataTableCell>
          <DataTableCell>
            {item.poId && item.poNumber ? (
              <Link
                href={`/beszallitoi-rendelesek/${item.poId}`}
                className="text-[12.5px] text-ink-secondary underline-offset-2 hover:underline"
              >
                {csoPoLinkLabel(item.poNumber, item.poStatus)}
              </Link>
            ) : (
              <span className="text-ink-muted">—</span>
            )}
          </DataTableCell>
          <DataTableCell className="whitespace-nowrap text-[12.5px] text-ink-secondary">
            {fmtDate(item.createdAt)}
          </DataTableCell>
          <DataTableCell>
            <Link
              href={`/ugyfelrendelesek/${item.orderId}`}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Rendelés
            </Link>
          </DataTableCell>
        </DataTableRow>
      ))}
    </>
  )
}
