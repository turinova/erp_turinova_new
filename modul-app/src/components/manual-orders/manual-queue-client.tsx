'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AlertTriangle, Copy, ExternalLink, ListChecks, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  ArrivalSmsDialog,
  HandoverDialog,
  OrderTextDialog,
  PartialArrivalDialog
} from '@/components/manual-orders/manual-order-dialogs'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { PageHeader } from '@/components/patterns/page-header'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setManualItemsStatusAction } from '@/lib/manual-orders/actions'
import { moDaysSince, moFmtDate, moFmtQty } from '@/lib/manual-orders/format'
import type { MoQueueResult } from '@/lib/manual-orders/queries'
import {
  MO_ACTION_FROM,
  MO_ACTION_LABEL,
  MO_ITEM_STATUS_LABEL,
  MO_LATE_DAYS,
  MO_QUEUE_VIEWS,
  MO_QUEUE_VIEW_LABEL,
  MO_SHELF_DAYS,
  MO_STATUS_TONE,
  MO_WORK_VIEWS,
  moLineGross,
  moNextAction,
  type MoItemStatus,
  type MoQueueGroup,
  type MoQueueItem,
  type MoQueueView
} from '@/lib/manual-orders/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { supplierColor } from '@/lib/suppliers/color'
import { cn } from '@/lib/utils'

type Props = {
  data: MoQueueResult
  view: MoQueueView
  q: string
  /** supplier uuid | 'none' | null */
  supplier: string | null
  canWrite: boolean
  loadError: string | null
}

const BULK: MoItemStatus[] = ['megrendelve', 'megerkezett', 'atadva']

function Ft(n: number) {
  return `${formatMoneyFt(n)} Ft`
}

function ago(days: number) {
  return days === 0 ? 'ma' : days === 1 ? 'tegnap' : `${days} napja`
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-subtle hover:text-ink"
      aria-label={`${label} másolása`}
      title={`${label} másolása`}
      onClick={() => {
        void navigator.clipboard.writeText(text)
        toast.success(`${label} másolva.`)
      }}
    >
      <Copy className="size-3" aria-hidden />
    </button>
  )
}

function SupplierDot({ id, color, className }: { id: string | null; color: string | null; className?: string }) {
  const c = supplierColor(id, color)
  return (
    <span
      className={cn('inline-block size-2.5 shrink-0 rounded-full', !c && 'border border-ink-muted', className)}
      style={c ? { background: c.dot } : undefined}
      aria-hidden
    />
  )
}

export function ManualQueueClient({ data, view, q, supplier, canWrite, loadError }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [nav, startNav] = useTransition()
  const [pending, startTransition] = useTransition()
  const [qDraft, setQDraft] = useState(q)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [arrivalIds, setArrivalIds] = useState<string[] | null>(null)
  const [text, setText] = useState<{ ids: string[]; reorder: string[]; markable: string[] } | null>(null)
  const [handover, setHandover] = useState<MoQueueItem[] | null>(null)
  const [partial, setPartial] = useState<MoQueueItem | null>(null)

  const { groups, chips, counts } = data
  const allItems = groups.flatMap((g) => g.items)
  const selItems = allItems.filter((i) => selected.has(i.id))
  const archive = !MO_WORK_VIEWS.includes(view)

  function push(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setSelected(new Set())
    const qs = next.toString()
    startNav(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  function valid(target: MoItemStatus, list: MoQueueItem[]) {
    return list.filter((i) => MO_ACTION_FROM[target].includes(i.status))
  }

  function refresh() {
    setSelected(new Set())
    router.refresh()
  }

  function run(target: MoItemStatus, list: MoQueueItem[]) {
    const ok = valid(target, list)
    if (ok.length === 0) return
    if (target === 'megerkezett') return setArrivalIds(ok.map((i) => i.id))
    if (target === 'atadva') return setHandover(ok)
    const before = new Map<MoItemStatus, string[]>()
    for (const i of ok) before.set(i.status, [...(before.get(i.status) ?? []), i.id])
    startTransition(async () => {
      const res = await setManualItemsStatusAction({ itemIds: ok.map((i) => i.id), status: target })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      refresh()
      toast.success(`${res.changed ?? ok.length} tétel: ${MO_ITEM_STATUS_LABEL[target]}.`, {
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

  function openText(list: MoQueueItem[]) {
    const ids = list.filter((i) => i.supplierId && (i.status === 'nyitott' || i.status === 'megrendelve'))
    if (ids.length === 0) {
      toast.error('Beszállító nélküli tételhez nem készül rendelési szöveg.')
      return
    }
    const open = ids.filter((i) => i.status === 'nyitott').map((i) => i.id)
    setText({ ids: open, reorder: ids.filter((i) => i.status === 'megrendelve').map((i) => i.id), markable: open })
  }

  function toggleMany(ids: string[], on: boolean) {
    setSelected((prev) => {
      const n = new Set(prev)
      for (const id of ids) {
        if (on) n.add(id)
        else n.delete(id)
      }
      return n
    })
  }

  const groupAction: MoItemStatus | null =
    view === 'nyitott' ? 'megrendelve' : view === 'megrendelve' ? 'megerkezett' : view === 'megerkezett' ? 'atadva' : null

  return (
    <div className={cn('space-y-3', selected.size > 0 && 'pb-20')}>
      <PageHeader title="Kézi várólista" icon={ListChecks} accent="blue" />

      {data.cancelledOrderedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            {data.cancelledOrderedCount} lemondott tétel már meg volt rendelve (14 napon belül) — mondd le a beszállítónál,
            vagy küldd vissza.
          </span>
          {view !== 'torolve' ? (
            <button
              type="button"
              className="font-medium underline underline-offset-2"
              onClick={() => push({ view: 'torolve', page: null, supplier: null })}
            >
              Megnézem
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Fülek */}
      <div className="flex flex-wrap items-center gap-1.5">
        {MO_QUEUE_VIEWS.map((v, idx) => {
          const active = v === view
          const isArchive = !MO_WORK_VIEWS.includes(v)
          const extra =
            v === 'megrendelve' && data.lateCount > 0
              ? `${data.lateCount} késik`
              : v === 'megerkezett' && data.shelfCount > 0
                ? `${data.shelfCount} régóta`
                : null
          return (
            <span key={v} className="flex items-center gap-1.5">
              {isArchive && MO_WORK_VIEWS.includes(MO_QUEUE_VIEWS[idx - 1]!) ? (
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              ) : null}
              <button
                type="button"
                disabled={nav}
                aria-current={active ? 'page' : undefined}
                onClick={() => push({ view: v === 'nyitott' ? null : v, page: null })}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors',
                  active
                    ? 'border-ink bg-ink text-white'
                    : isArchive
                      ? 'border-transparent text-ink-secondary hover:bg-subtle'
                      : 'border-border bg-white text-ink hover:bg-subtle'
                )}
              >
                {MO_QUEUE_VIEW_LABEL[v]}
                <span className={cn('tabular-nums text-[12px]', active ? 'text-white/80' : 'text-ink-muted')}>{counts[v]}</span>
                {extra ? (
                  <span
                    className={cn(
                      'rounded px-1 text-[11px] font-medium',
                      active ? 'bg-white/20 text-white' : 'bg-warning-soft text-warning-ink'
                    )}
                  >
                    {extra}
                  </span>
                ) : null}
              </button>
            </span>
          )
        })}
      </div>

      {/* Kereső + beszállító chipek */}
      <div className="space-y-2">
        <form
          role="search"
          className="relative w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault()
            push({ q: qDraft.trim() || null, page: null })
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Termék, cikkszám, vevő, KR-szám… (Enter)"
            className="h-8 pl-8 pr-8"
            aria-label="Keresés a várólistában"
          />
          {qDraft ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:bg-subtle"
              aria-label="Keresés törlése"
              onClick={() => {
                setQDraft('')
                push({ q: null, page: null })
              }}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </form>
        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Beszállító szűrő">
            <button
              type="button"
              disabled={nav}
              aria-pressed={!supplier}
              onClick={() => push({ supplier: null, page: null })}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]',
                !supplier ? 'border-ink bg-ink text-white' : 'border-border bg-white text-ink hover:bg-subtle'
              )}
            >
              Minden beszállító
            </button>
            {chips.map((c) => {
              const key = c.supplierId ?? 'none'
              const active = supplier === key
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={nav}
                  aria-pressed={active}
                  onClick={() => push({ supplier: active ? null : key, page: null })}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]',
                    active ? 'border-ink bg-ink text-white' : 'border-border bg-white text-ink hover:bg-subtle'
                  )}
                >
                  <SupplierDot id={c.supplierId} color={c.color} />
                  {c.name}
                  <span className={cn('tabular-nums', active ? 'text-white/80' : 'text-ink-muted')}>{c.count}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {!canWrite ? <p className="text-hint text-ink-muted">Csak olvasási jogod van — a műveletek rejtve.</p> : null}

      {loadError ? (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink" role="alert">
          {loadError}
        </p>
      ) : groups.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-body text-ink-secondary">
          {q || supplier ? 'Nincs találat a szűrésre.' : 'Itt most nincs teendő.'}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <SupplierGroup
              key={g.key}
              g={g}
              view={view}
              archive={archive}
              canWrite={canWrite}
              pending={pending}
              selected={selected}
              groupAction={groupAction}
              onToggle={toggleMany}
              onRun={run}
              onText={openText}
              onPartial={setPartial}
              validCount={(t, list) => valid(t, list).length}
            />
          ))}
        </div>
      )}

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-[13px] text-ink-secondary">
          <span>{data.totalItems} tétel · beszállítónként lapozva</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={nav || data.page <= 1}
            onClick={() => push({ page: String(data.page - 1) })}
          >
            Előző
          </Button>
          <span className="tabular-nums">
            {data.page} / {data.totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={nav || data.page >= data.totalPages}
            onClick={() => push({ page: String(data.page + 1) })}
          >
            Következő
          </Button>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-canvas/95 px-4 py-2.5 backdrop-blur md:left-[var(--sidebar-width)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <span className="text-body text-ink">
              {selected.size} kijelölve
              {new Set(selItems.map((i) => i.supplierId)).size > 1
                ? ` · ${new Set(selItems.map((i) => i.supplierId)).size} beszállító`
                : ''}
              <button
                type="button"
                className="ml-2 text-hint text-ink-secondary underline-offset-2 hover:underline"
                onClick={() => setSelected(new Set())}
              >
                Kijelölés törlése
              </button>
            </span>
            {canWrite ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {selItems.some((i) => i.supplierId && (i.status === 'nyitott' || i.status === 'megrendelve')) ? (
                  <Button size="sm" variant="secondary" onClick={() => openText(selItems)}>
                    <Copy className="size-3.5" aria-hidden />
                    Rendelési szöveg
                  </Button>
                ) : null}
                {BULK.filter((t) => valid(t, selItems).length > 0).map((t) => {
                  const n = valid(t, selItems).length
                  return (
                    <Button
                      key={t}
                      size="sm"
                      variant={t === groupAction ? 'primary' : 'secondary'}
                      disabled={pending}
                      onClick={() => run(t, selItems)}
                    >
                      {MO_ACTION_LABEL[t]} ({n})
                    </Button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {arrivalIds ? (
        <ArrivalSmsDialog open onOpenChange={(o) => !o && setArrivalIds(null)} itemIds={arrivalIds} onDone={refresh} />
      ) : null}
      {partial ? (
        <PartialArrivalDialog
          item={partial}
          onClose={() => setPartial(null)}
          onSplit={(id) => {
            setPartial(null)
            router.refresh()
            setArrivalIds([id])
          }}
        />
      ) : null}
      {text ? (
        <OrderTextDialog
          open
          onOpenChange={(o) => !o && setText(null)}
          itemIds={text.ids}
          reorderIds={text.reorder}
          markableIds={text.markable}
          onDone={refresh}
        />
      ) : null}
      {handover ? (
        <HandoverDialog
          open
          onOpenChange={(o) => !o && setHandover(null)}
          customerName={
            new Set(handover.map((i) => i.orderId)).size === 1
              ? handover[0]!.customerName
              : `${new Set(handover.map((i) => i.orderId)).size} vevő`
          }
          items={handover.map((i) => ({
            id: i.id,
            name: `${i.name} — ${i.customerName}`,
            qty: i.qty,
            unitShortform: i.unitShortform,
            ready: i.status === 'megerkezett',
            statusLabel: MO_ITEM_STATUS_LABEL[i.status]
          }))}
          onDone={refresh}
        />
      ) : null}
    </div>
  )
}

function SupplierGroup({
  g,
  view,
  archive,
  canWrite,
  pending,
  selected,
  groupAction,
  onToggle,
  onRun,
  onText,
  onPartial,
  validCount
}: {
  g: MoQueueGroup
  view: MoQueueView
  archive: boolean
  canWrite: boolean
  pending: boolean
  selected: Set<string>
  groupAction: MoItemStatus | null
  onToggle: (ids: string[], on: boolean) => void
  onRun: (t: MoItemStatus, list: MoQueueItem[]) => void
  onText: (list: MoQueueItem[]) => void
  onPartial: (i: MoQueueItem) => void
  validCount: (t: MoItemStatus, list: MoQueueItem[]) => number
}) {
  const c = supplierColor(g.supplierId, g.color)
  const ids = g.items.map((i) => i.id)
  const all = ids.length > 0 && ids.every((id) => selected.has(id))
  const oldestDays = g.oldestAt ? moDaysSince(g.oldestAt) : 0
  const oldWarn = view === 'nyitott' ? oldestDays >= 3 : view === 'megrendelve' ? oldestDays >= MO_LATE_DAYS : view === 'megerkezett' ? oldestDays >= MO_SHELF_DAYS : false
  const groupN = groupAction ? validCount(groupAction, g.items) : 0
  const showNote = view === 'nyitott' || view === 'megrendelve' || archive

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: `3px solid ${c?.dot ?? 'var(--color-border-strong, #d4d4d8)'}` }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border px-3 py-2"
        style={{ background: c?.soft }}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <input
            type="checkbox"
            className="size-3.5 accent-ink"
            checked={all}
            onChange={() => onToggle(ids, !all)}
            aria-label={`${g.supplierName} összes tétele`}
          />
          <SupplierDot id={g.supplierId} color={g.color} />
          <h2 className="text-h3 font-semibold text-ink">{g.supplierName}</h2>
          <span className="text-hint text-ink-secondary">
            {g.count} tétel
            {view === 'nyitott' ? (
              <>
                {' · '}
                <span className="tabular-nums text-ink">{Ft(g.gross)}</span>
                {g.unpriced > 0 ? <span className="text-warning-ink"> · {g.unpriced} ár nélkül (nem végleges)</span> : null}
              </>
            ) : null}
            {g.oldestAt && !archive ? (
              <span className={cn(oldWarn && 'font-medium text-warning-ink')}> · legrégebbi: {ago(oldestDays)}</span>
            ) : null}
          </span>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {g.supplierId === null && view === 'nyitott' ? (
              <span className="text-hint text-warning-ink">Beszállító nélkül nem rendelhető — add meg a tételnél.</span>
            ) : null}
            {g.supplierId && (view === 'nyitott' || view === 'megrendelve') ? (
              <Button size="sm" variant="secondary" onClick={() => onText(g.items)}>
                <Copy className="size-3.5" aria-hidden />
                Rendelési szöveg
              </Button>
            ) : null}
            {groupAction && groupN > 0 && !(groupAction === 'megrendelve' && g.supplierId === null) ? (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => onRun(groupAction, g.items)}>
                Mind {MO_ACTION_LABEL[groupAction].toLowerCase()} ({groupN})
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      <DataTable className="rounded-none border-0">
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell className="w-8">
              <span className="sr-only">Kijelölés</span>
            </DataTableHeaderCell>
            <DataTableHeaderCell>Termék</DataTableHeaderCell>
            <DataTableHeaderCell align="right">Menny.</DataTableHeaderCell>
            <DataTableHeaderCell>Vevő</DataTableHeaderCell>
            {view === 'nyitott' ? <DataTableHeaderCell align="right">Összeg</DataTableHeaderCell> : null}
            <DataTableHeaderCell className="whitespace-nowrap">
              {view === 'nyitott' ? 'Felvéve' : view === 'megrendelve' ? 'Rendelve' : view === 'megerkezett' ? 'Megjött' : 'Állapot'}
            </DataTableHeaderCell>
            {view === 'megerkezett' ? <DataTableHeaderCell>Értesítés</DataTableHeaderCell> : null}
            {canWrite && !archive ? (
              <DataTableHeaderCell align="right">
                <span className="sr-only">Művelet</span>
              </DataTableHeaderCell>
            ) : null}
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {g.items.map((i) => {
            const days = moDaysSince(i.statusAt)
            const late = i.status === 'megrendelve' && days >= MO_LATE_DAYS
            const shelf = i.status === 'megerkezett' && days >= MO_SHELF_DAYS
            const next = moNextAction(i.status)
            return (
              <DataTableRow key={i.id} className={cn(selected.has(i.id) && 'bg-subtle/60')}>
                <DataTableCell>
                  <input
                    type="checkbox"
                    className="size-3.5 accent-ink"
                    checked={selected.has(i.id)}
                    onChange={() => onToggle([i.id], !selected.has(i.id))}
                    aria-label={`${i.name} kijelölése`}
                  />
                </DataTableCell>
                <DataTableCell className="min-w-[14rem] py-1.5">
                  <div className="flex items-start gap-1">
                    {i.shopUrl ? (
                      <a
                        href={i.shopUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whitespace-normal break-words font-medium text-ink underline-offset-2 hover:underline"
                        title="Megnyitás a beszállító webshopjában"
                      >
                        {i.name}
                        <ExternalLink className="ml-1 inline size-3 align-baseline text-ink-muted" aria-hidden />
                      </a>
                    ) : (
                      <span className="whitespace-normal break-words font-medium text-ink">{i.name}</span>
                    )}
                    <CopyBtn text={i.name} label="Terméknév" />
                  </div>
                  {i.sku || i.supplierSku ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-hint text-ink-secondary">
                      {i.sku ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="tabular-nums">{i.sku}</span>
                          <CopyBtn text={i.sku} label="Cikkszám" />
                        </span>
                      ) : null}
                      {i.supplierSku && i.supplierSku !== i.sku ? (
                        <span className="inline-flex items-center gap-1">
                          <span>Besz. cikkszám: <span className="tabular-nums">{i.supplierSku}</span></span>
                          <CopyBtn text={i.supplierSku} label="Beszállítói cikkszám" />
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {showNote && i.note ? <p className="whitespace-pre-wrap text-hint text-ink-secondary">{i.note}</p> : null}
                  {i.onWay.length > 0 ? (
                    <p className="mt-0.5 flex items-start gap-1 text-hint text-warning-ink">
                      <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
                      Ebből már úton: {i.onWay.map((w) => `${moFmtQty(w.qty)} ${i.unitShortform} (${w.orderNumber})`).join(', ')}
                    </p>
                  ) : null}
                </DataTableCell>
                <DataTableCell align="right" className="whitespace-nowrap tabular-nums">
                  {moFmtQty(i.qty)} {i.unitShortform}
                </DataTableCell>
                <DataTableCell className="py-1.5">
                  <Link
                    href={`/kezi-rendelesek/${i.orderId}`}
                    className="font-medium text-ink underline decoration-border-strong underline-offset-2 hover:decoration-ink"
                    title="Rendelés megnyitása"
                  >
                    {i.customerName}
                  </Link>
                  <span className="block text-hint text-ink-secondary">
                    <Link
                      href={`/kezi-rendelesek/${i.orderId}`}
                      className="whitespace-nowrap font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {i.orderNumber} →
                    </Link>
                    {i.customerMobile ? (
                      <>
                        {' · '}
                        <a href={`tel:${i.customerMobile.replace(/\s/g, '')}`} className="whitespace-nowrap tabular-nums hover:text-ink hover:underline">
                          {i.customerMobile}
                        </a>
                      </>
                    ) : null}
                  </span>
                </DataTableCell>
                {view === 'nyitott' ? (
                  <DataTableCell align="right" className="whitespace-nowrap tabular-nums">
                    {i.unitPriceGross == null ? (
                      <span className="text-warning-ink">nincs ár</span>
                    ) : (
                      <>
                        {Ft(moLineGross(i.unitPriceGross, i.qty))}
                        <span className="block text-hint text-ink-secondary">
                          {Ft(i.unitPriceGross)} / {i.unitShortform}
                        </span>
                      </>
                    )}
                  </DataTableCell>
                ) : null}
                <DataTableCell className="whitespace-nowrap">
                  {archive ? (
                    <>
                      <StatusBadge tone={MO_STATUS_TONE[i.status]}>{MO_ITEM_STATUS_LABEL[i.status]}</StatusBadge>
                      <span className="block text-hint text-ink-secondary">{moFmtDate(i.statusAt)}</span>
                    </>
                  ) : (
                    <>
                      <span className={cn('tabular-nums', late || shelf ? 'font-medium text-warning-ink' : 'text-ink-secondary')}>
                        {ago(days)}
                      </span>
                      {late ? (
                        <StatusBadge tone="warning" className="ml-1.5">
                          Késik
                        </StatusBadge>
                      ) : null}
                      {shelf ? (
                        <StatusBadge tone="warning" className="ml-1.5">
                          Régóta a polcon
                        </StatusBadge>
                      ) : null}
                      {i.statusByLabel ? <span className="block text-hint text-ink-muted">{i.statusByLabel}</span> : null}
                    </>
                  )}
                </DataTableCell>
                {view === 'megerkezett' ? (
                  <DataTableCell className="whitespace-nowrap text-hint">
                    {!i.customerMobile ? (
                      <span className="font-medium text-warning-ink">Nincs mobil — hívd fel</span>
                    ) : i.orderSmsSentAt ? (
                      <span className="text-ink-secondary">SMS kiment {moFmtDate(i.orderSmsSentAt)}</span>
                    ) : (
                      <span className="text-warning-ink">Nem ment SMS</span>
                    )}
                  </DataTableCell>
                ) : null}
                {canWrite && !archive ? (
                  <DataTableCell align="right" className="whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {i.status === 'megrendelve' && i.qty > 1 ? (
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onPartial(i)}>
                          Részben…
                        </Button>
                      ) : null}
                      {next && !(next === 'megrendelve' && !i.supplierId) ? (
                        <Button size="sm" variant="secondary" disabled={pending} onClick={() => onRun(next, [i])}>
                          {MO_ACTION_LABEL[next]}
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
    </section>
  )
}
