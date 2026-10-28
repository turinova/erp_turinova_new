'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { ClipboardList, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'

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
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { cancelSpecialOrderAction } from '@/lib/customer-orders/actions'
import {
  CSO_STATUS_LABEL,
  csoStatusTone,
  orderCanBeCancelled,
  type CsoItemStatus,
  type CustomerSpecialOrderListItem
} from '@/lib/customer-orders/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

type ListStatus =
  | CsoItemStatus
  | 'all'
  | 'active'

type Props = {
  rows: CustomerSpecialOrderListItem[]
  total: number
  page: number
  limit: number
  canWrite: boolean
  initialQ: string
  initialStatus: ListStatus
}

const STATUS_OPTIONS: { value: ListStatus; label: string }[] = [
  { value: 'active', label: 'Aktív' },
  { value: 'felveve', label: 'Felvéve' },
  { value: 'rendelve', label: 'Beszerzés' },
  { value: 'itt_van', label: 'Átvehető' },
  { value: 'atadva', label: 'Átadva' },
  { value: 'torolve', label: 'Törölve' },
  { value: 'all', label: 'Mind' }
]

const STATUS_FILTER_LABEL: Record<ListStatus, string> = {
  active: 'Aktív',
  felveve: 'Felvéve',
  rendelve: 'Beszerzés',
  itt_van: 'Átvehető',
  atadva: 'Átadva',
  torolve: 'Törölve',
  all: 'Mind'
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
  return dateFmt.format(new Date(iso))
}
function fmtDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso))
}

function fmtQty(q: number) {
  return q.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

function lineOutcome(line: CustomerSpecialOrderListItem['cancelLines'][number]) {
  if (line.status === 'felveve') return '→ lemondva'
  if (line.status === 'itt_van') {
    return '→ foglalás feloldva, áru a polcon marad'
  }
  if (line.status === 'rendelve') {
    if (line.poStatus === 'draft' || line.poStatus === null) {
      return line.poNumber
        ? `→ kikerül a vázlatból (${line.poNumber})`
        : '→ kikerül a beszállítói vázlatból'
    }
    return line.poNumber
      ? `→ ${line.poNumber} már elment; ha megjön, polcra kerül`
      : '→ a beszállítói rendelés már elment; ha megjön, polcra kerül'
  }
  return ''
}

export function CustomerOrdersListClient({
  rows,
  total,
  page,
  limit,
  canWrite,
  initialQ,
  initialStatus
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(initialQ)
  const [pending, startTransition] = useTransition()
  const [cancelRow, setCancelRow] =
    useState<CustomerSpecialOrderListItem | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const searching = initialQ.trim().length > 0
  const statusValue: ListStatus = searching
    ? 'all'
    : initialStatus || 'active'

  useEffect(() => {
    setSearch(initialQ)
  }, [initialQ])

  function pushParams(next: {
    q?: string
    page?: number
    status?: ListStatus
  }) {
    const sp = new URLSearchParams(searchParams.toString())
    const q = next.q !== undefined ? next.q : search
    const p = next.page ?? 1
    const qTrim = q.trim()
    // Lookup: keresés → státusz Mind; üres keresés → Aktív (ha nem adtak mást).
    let nextStatus: ListStatus
    if (next.status !== undefined) {
      nextStatus = qTrim ? 'all' : next.status
    } else if (qTrim) {
      nextStatus = 'all'
    } else if (next.q !== undefined && !qTrim) {
      nextStatus = 'active'
    } else {
      nextStatus = statusValue
    }

    if (qTrim) sp.set('q', qTrim)
    else sp.delete('q')

    if (nextStatus && nextStatus !== 'active') sp.set('status', nextStatus)
    else sp.delete('status')

    sp.delete('sms')

    if (p > 1) sp.set('page', String(p))
    else sp.delete('page')

    const qs = sp.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
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
    pushParams({
      q: '',
      status: 'active',
      page: 1
    })
  }

  const hasFilters =
    (!searching && statusValue !== 'active') || searching

  const activeChips: { key: string; label: string; clear: () => void }[] = []
  if (initialQ.trim()) {
    activeChips.push({
      key: 'q',
      label: `Keresés: ${initialQ.trim()}`,
      clear: () => {
        setSearch('')
        pushParams({ q: '', status: 'active', page: 1 })
      }
    })
  }
  if (!searching && statusValue !== 'active') {
    activeChips.push({
      key: 'status',
      label: `Státusz: ${STATUS_FILTER_LABEL[statusValue]}`,
      clear: () => pushParams({ status: 'active', page: 1 })
    })
  }

  function confirmCancel() {
    if (!cancelRow) return
    const id = cancelRow.id
    startTransition(async () => {
      const res = await cancelSpecialOrderAction({ orderId: id })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message ?? 'Rendelés lemondva.')
      setCancelRow(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Ügyfélrendelések"
        description="Ami nincs a polcon — felvesszük, beszerezzük, átadjuk."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/ugyfelrendelesek/varolista"
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'md' }),
                'no-underline'
              )}
            >
              Beszállítói várólista
            </Link>
            {canWrite ? (
              <Link
                href="/ugyfelrendelesek/uj"
                className={cn(buttonVariants({ size: 'md' }), 'no-underline')}
              >
                <Plus className="size-3.5" aria-hidden />
                Új ügyfélrendelés
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <label className="sr-only" htmlFor="cso-list-search">
            Keresés számra, névre, telefonra
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="cso-list-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                pushParams({ q: search, page: 1 })
              }
            }}
            placeholder="Összes rendelés: szám, név, telefon…"
            className="pl-8"
          />
        </div>
        <p className="shrink-0 text-hint tabular-nums text-ink-muted">
          {from}–{to} / {total}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[9.5rem] flex-1 sm:flex-none sm:w-[11rem]">
          <label
            className="mb-1 block text-hint text-ink-muted"
            htmlFor="cso-list-status"
          >
            Státusz
          </label>
          <MenuSelect
            id="cso-list-status"
            value={statusValue}
            options={STATUS_OPTIONS}
            allowEmpty={false}
            disabled={pending || searching}
            onChange={(v) =>
              pushParams({ status: v as ListStatus, page: 1 })
            }
          />
        </div>
        {searching ? (
          <p className="pb-1.5 text-hint text-ink-muted">
            Keresés az összes rendelésben (átadott is).
          </p>
        ) : null}
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
          <button
            type="button"
            onClick={clearAllFilters}
            className="h-7 px-1.5 text-hint font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
          >
            Összes törlése
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-md border border-border bg-surface px-4 py-10 text-center">
          <ClipboardList className="mx-auto size-8 text-ink-muted" aria-hidden />
          <p className="mt-3 text-body text-ink-secondary">
            {hasFilters
              ? 'Nincs találat ezekkel a szűrőkkel.'
              : 'Nincs aktív ügyfélrendelés.'}
          </p>
          {hasFilters ? (
            <button
              type="button"
              className="mt-3 text-body font-medium text-ink underline-offset-2 hover:underline"
              onClick={clearAllFilters}
            >
              Szűrők törlése
            </button>
          ) : canWrite ? (
            <Link
              href="/ugyfelrendelesek/uj"
              className={cn(
                buttonVariants({ size: 'md' }),
                'mt-4 inline-flex no-underline'
              )}
            >
              Új ügyfélrendelés
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Szám</DataTableHeaderCell>
                <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
                <DataTableHeaderCell>Telefon</DataTableHeaderCell>
                <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                <DataTableHeaderCell>SMS</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Tétel
                </DataTableHeaderCell>
                <DataTableHeaderCell>Dátum</DataTableHeaderCell>
                {canWrite ? (
                  <DataTableHeaderCell className="text-right">
                    Művelet
                  </DataTableHeaderCell>
                ) : null}
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const canCancel = orderCanBeCancelled(row.status)
                return (
                  <DataTableRow key={row.id}>
                    <DataTableCell>
                      <Link
                        href={`/ugyfelrendelesek/${row.id}`}
                        className="font-medium text-ink no-underline hover:underline"
                      >
                        {row.orderNumber}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{row.customerName}</DataTableCell>
                    <DataTableCell className="tabular-nums text-ink-secondary">
                      {row.customerMobile}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        tone={csoStatusTone(row.status as CsoItemStatus)}
                      >
                        {CSO_STATUS_LABEL[row.status as CsoItemStatus]}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>
                      {row.smsSentAt ? (
                        <Link
                          href={`/ugyfelrendelesek/${row.id}`}
                          className="text-body text-ink no-underline hover:underline"
                        >
                          <span className="font-medium">Elküldve</span>
                          <span className="block text-hint text-ink-secondary">
                            {fmtDateTime(row.smsSentAt)}
                          </span>
                        </Link>
                      ) : row.status === 'itt_van' ? (
                        <Link
                          href={`/ugyfelrendelesek/${row.id}`}
                          className="inline-flex no-underline"
                        >
                          <StatusBadge tone="warning">Nincs SMS →</StatusBadge>
                        </Link>
                      ) : (
                        <span className="text-body text-ink-muted">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-right tabular-nums">
                      {row.itemCount}
                    </DataTableCell>
                    <DataTableCell className="text-ink-secondary">
                      {fmtDate(row.createdAt)}
                    </DataTableCell>
                    {canWrite ? (
                      <DataTableCell className="text-right">
                        {canCancel ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            className="text-danger-ink hover:text-danger-ink"
                            onClick={() => setCancelRow(row)}
                          >
                            Lemondás
                          </Button>
                        ) : (
                          <span className="text-body text-ink-muted">—</span>
                        )}
                      </DataTableCell>
                    ) : null}
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>

          <div className="flex items-center justify-between gap-2 text-hint text-ink-secondary">
            <span>
              {from}–{to} / {total}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page <= 1 || pending}
                onClick={() => pushParams({ page: page - 1 })}
              >
                Előző
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page >= totalPages || pending}
                onClick={() => pushParams({ page: page + 1 })}
              >
                Következő
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={cancelRow != null}
        onOpenChange={(open) => {
          if (!open) setCancelRow(null)
        }}
        title={
          cancelRow
            ? `Lemondod a(z) ${cancelRow.orderNumber} rendelést?`
            : 'Rendelés lemondása'
        }
        description={
          cancelRow
            ? `${cancelRow.customerName} · ${cancelRow.customerMobile}`
            : ''
        }
        confirmLabel="Rendelés lemondása"
        loading={pending}
        onConfirm={confirmCancel}
      >
        {cancelRow ? (
          <div className="space-y-2">
            <ul className="max-h-48 divide-y divide-border overflow-auto rounded-md border border-border">
              {cancelRow.cancelLines.map((line) => (
                <li key={line.id} className="px-2.5 py-1.5 text-body">
                  <p className="whitespace-normal break-words font-medium text-ink">
                    {line.name}{' '}
                    <span className="font-normal text-ink-secondary">
                      · {fmtQty(line.qty)} {line.unitShortform} ·{' '}
                      {CSO_STATUS_LABEL[line.status]}
                    </span>
                  </p>
                  <p className="text-ink-secondary">{lineOutcome(line)}</p>
                </li>
              ))}
            </ul>
            {cancelRow.depositAmount != null && cancelRow.depositAmount > 0 ? (
              <p className="text-body font-semibold text-warning-ink">
                Előleg {formatMoneyFt(cancelRow.depositAmount)} Ft — ezt kézzel
                add vissza, a rendszer nem könyvel.
              </p>
            ) : null}
            {cancelRow.smsSentAt ? (
              <p className="text-body text-warning-ink">
                Az ügyfél már kapott „átveheted” értesítőt.
              </p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
