'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode
} from 'react'
import { ClipboardList, Plus, Search, X } from 'lucide-react'

import { CustomerListCell } from '@/components/patterns/customer-list-cell'
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
import {
  CSO_STATUS_LABEL,
  csoStatusTone,
  type CsoListCounts,
  type CsoListStatus,
  type CustomerSpecialOrderListItem
} from '@/lib/customer-orders/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

type Props = {
  rows: CustomerSpecialOrderListItem[]
  total: number
  page: number
  limit: number
  counts: CsoListCounts
  suppliers: { value: string; label: string }[]
  canWrite: boolean
  initialQ: string
  initialStatus: CsoListStatus
  initialNosms: boolean
  initialSupplierId: string | null
}

type ParamsPatch = {
  q?: string
  page?: number
  status?: CsoListStatus
  nosms?: boolean
  supplier?: string | null
}

const STATUS_CHIPS: {
  value: CsoListStatus
  label: string
  count?: keyof CsoListCounts
}[] = [
  { value: 'active', label: 'Aktív', count: 'active' },
  { value: 'felveve', label: 'Felvéve', count: 'felveve' },
  { value: 'rendelve', label: 'Beszerzés', count: 'rendelve' },
  { value: 'itt_van', label: 'Átvehető', count: 'itt_van' },
  { value: 'atadva', label: 'Átadva' },
  { value: 'torolve', label: 'Lemondva' },
  { value: 'all', label: 'Mind' }
]

const STATUS_CHIP_LABEL = Object.fromEntries(
  STATUS_CHIPS.map((c) => [c.value, c.label])
) as Record<CsoListStatus, string>

const ACTIVE_STATUSES = new Set(['felveve', 'rendelve', 'itt_van'])

const dateFmt = new Intl.DateTimeFormat('hu-HU', {
  timeZone: 'Europe/Budapest',
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
const isoDayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Budapest'
})

/** Felvétel óta: ma / tegnap / N napja (budapesti naptári nap). */
function waitingLabel(createdAt: string, today: string) {
  const created = isoDayFmt.format(new Date(createdAt))
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${created}T00:00:00Z`)) /
      86_400_000
  )
  if (days <= 0) return 'ma'
  if (days === 1) return 'tegnap'
  return `${days} napja`
}

function fmtDate(iso: string) {
  return dateFmt.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso))
}
function fmtDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso))
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

function chipClass(active: boolean, muted: boolean) {
  return cn(
    'h-7 rounded-md px-2.5 text-hint font-medium tabular-nums transition-colors',
    active
      ? 'bg-ink text-surface'
      : muted
        ? 'cursor-not-allowed bg-subtle text-ink-muted'
        : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
  )
}

function OrderStatusCell({ row }: { row: CustomerSpecialOrderListItem }) {
  const openCount = row.itemCount - row.handedCount
  const badge =
    row.readyCount > 0 && row.readyCount < openCount ? (
      <StatusBadge tone={csoStatusTone('itt_van')}>
        {row.readyCount}/{openCount} átvehető
      </StatusBadge>
    ) : row.status === 'torolve' ? (
      <StatusBadge tone={csoStatusTone('torolve')}>Lemondva</StatusBadge>
    ) : (
      <StatusBadge tone={csoStatusTone(row.status)}>
        {CSO_STATUS_LABEL[row.status]}
      </StatusBadge>
    )

  let hint: ReactNode = null
  if (row.readyCount > 0) {
    hint = row.smsSentAt ? (
      <span className="text-ink-secondary">
        SMS elküldve {fmtDate(row.smsSentAt)}
      </span>
    ) : (
      <span className="font-medium text-warning-ink">Nincs SMS</span>
    )
  } else if (row.missingSupplier) {
    hint = <span className="font-medium text-warning-ink">Nincs beszállító</span>
  } else if (row.poNumbers.length > 0) {
    hint = (
      <span className="text-ink-secondary">{row.poNumbers.join(', ')}</span>
    )
  }

  return (
    <div className="space-y-0.5">
      {badge}
      {hint ? <p className="text-hint">{hint}</p> : null}
    </div>
  )
}

export function CustomerOrdersListClient({
  rows,
  total,
  page,
  limit,
  counts,
  suppliers,
  canWrite,
  initialQ,
  initialStatus,
  initialNosms,
  initialSupplierId
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState(initialQ)
  const [pending, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const searching = initialQ.trim().length > 0
  const today = isoDayFmt.format(new Date())
  const supplierName =
    suppliers.find((s) => s.value === initialSupplierId)?.label ?? null

  useEffect(() => {
    setSearch(initialQ)
  }, [initialQ])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function pushParams(patch: ParamsPatch) {
    const sp = new URLSearchParams(searchParams.toString())
    const q = (patch.q !== undefined ? patch.q : search).trim()
    const status = patch.status ?? initialStatus
    const nosms = patch.nosms ?? initialNosms
    const supplier =
      patch.supplier !== undefined ? patch.supplier : initialSupplierId
    const p = patch.page ?? 1

    if (q) sp.set('q', q)
    else sp.delete('q')
    if (status !== 'active') sp.set('status', status)
    else sp.delete('status')
    if (nosms) sp.set('nosms', '1')
    else sp.delete('nosms')
    if (supplier) sp.set('supplier', supplier)
    else sp.delete('supplier')
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

  function clearSearch() {
    setSearch('')
    pushParams({ q: '', page: 1 })
  }

  function clearAllFilters() {
    setSearch('')
    pushParams({
      q: '',
      status: 'active',
      nosms: false,
      supplier: null,
      page: 1
    })
  }

  const filtersOn =
    initialStatus !== 'active' ||
    initialNosms ||
    Boolean(initialSupplierId)
  const hasFilters = searching || filtersOn

  const activeChips: { key: string; label: string; clear: () => void }[] = []
  if (searching) {
    activeChips.push({
      key: 'q',
      label: `Keresés: ${initialQ.trim()}`,
      clear: clearSearch
    })
  }
  if (!searching && initialStatus !== 'active') {
    activeChips.push({
      key: 'status',
      label: `Állapot: ${STATUS_CHIP_LABEL[initialStatus]}`,
      clear: () => pushParams({ status: 'active', page: 1 })
    })
  }
  if (!searching && initialNosms) {
    activeChips.push({
      key: 'nosms',
      label: 'Nincs SMS',
      clear: () => pushParams({ nosms: false, page: 1 })
    })
  }
  if (initialSupplierId) {
    activeChips.push({
      key: 'supplier',
      label: `Beszállító: ${supplierName ?? 'kiválasztva'}`,
      clear: () => pushParams({ supplier: null, page: 1 })
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

      <div className="flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-[14rem] flex-1">
          <label className="sr-only" htmlFor="cso-list-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            ref={searchRef}
            id="cso-list-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                pushParams({ q: search, page: 1 })
              } else if (e.key === 'Escape' && search) {
                e.preventDefault()
                clearSearch()
              }
            }}
            placeholder="Név, telefon, termék, cikkszám, rendelésszám…"
            className="pl-8 pr-8"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:bg-subtle hover:text-ink"
              aria-label="Keresés törlése"
              onClick={clearSearch}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="w-[12rem] shrink-0">
          <label className="sr-only" htmlFor="cso-list-supplier">
            Beszállító
          </label>
          <MenuSelect
            id="cso-list-supplier"
            value={initialSupplierId ?? ''}
            options={suppliers}
            allowEmpty
            emptyLabel="Beszállító: mind"
            placeholder="Beszállító: mind"
            searchable={suppliers.length > 8}
            disabled={pending}
            onChange={(v) => pushParams({ supplier: v || null, page: 1 })}
          />
        </div>
        <p className="shrink-0 text-hint tabular-nums text-ink-muted">
          {from}–{to} / {total}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_CHIPS.map((chip) => {
          const active = !searching && initialStatus === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              disabled={pending || searching}
              onClick={() => pushParams({ status: chip.value, page: 1 })}
              className={chipClass(active, searching)}
            >
              {chip.label}
              {chip.count ? ` (${counts[chip.count]})` : null}
            </button>
          )
        })}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <button
          type="button"
          aria-pressed={!searching && initialNosms}
          disabled={pending || searching}
          onClick={() => pushParams({ nosms: !initialNosms, page: 1 })}
          className={cn(
            chipClass(!searching && initialNosms, searching),
            !initialNosms && counts.nosms > 0 && !searching && 'text-warning-ink'
          )}
        >
          Nincs SMS ({counts.nosms})
        </button>
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
            <p className="text-hint text-ink-muted">Keresés minden állapotban.</p>
          ) : null}
          {activeChips.length > 1 ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="h-7 px-1.5 text-hint font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
            >
              Összes törlése
            </button>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-md border border-border bg-surface px-4 py-10 text-center">
          <ClipboardList className="mx-auto size-8 text-ink-muted" aria-hidden />
          <p className="mt-3 text-body text-ink-secondary">
            {searching
              ? `Nincs találat erre: „${initialQ.trim()}”.`
              : hasFilters
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
                <DataTableHeaderCell>Termék</DataTableHeaderCell>
                <DataTableHeaderCell>Állapot</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Átvételkor fizet
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const href = `/ugyfelrendelesek/${row.id}`
                const isActive = ACTIVE_STATUSES.has(row.status)
                const openCount = row.itemCount - row.handedCount
                const moreItems = row.itemNames.length - 1
                const matched =
                  row.matchedItemName && row.matchedItemName !== row.itemNames[0]
                    ? row.matchedItemName
                    : null
                const supplierLabel =
                  row.supplierNames.length === 1
                    ? row.supplierNames[0]
                    : row.supplierNames.length > 1
                      ? `${row.supplierNames.length} beszállító`
                      : null
                const productHint = [
                  matched
                    ? `Találat: ${matched}`
                    : moreItems > 0
                      ? `+${moreItems} tétel`
                      : null,
                  supplierLabel
                ].filter(Boolean)
                return (
                  <DataTableRow
                    key={row.id}
                    className="cursor-pointer align-top hover:bg-subtle"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a,button')) return
                      router.push(href)
                    }}
                  >
                    <DataTableCell>
                      <Link
                        href={href}
                        className="font-medium text-ink no-underline hover:underline"
                      >
                        {row.orderNumber}
                      </Link>
                      <span
                        className="block text-hint text-ink-muted"
                        title={fmtDateTime(row.createdAt)}
                      >
                        {isActive
                          ? waitingLabel(row.createdAt, today)
                          : fmtDate(row.createdAt)}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <CustomerListCell
                        name={row.customerName}
                        customerId={row.customerId}
                        mobile={row.customerMobile}
                      />
                    </DataTableCell>
                    <DataTableCell>
                      <div className="max-w-[18rem]">
                        <p
                          className="truncate text-body text-ink"
                          title={row.itemNames.join('\n')}
                        >
                          {row.itemNames[0] ?? (
                            <span className="text-ink-muted">—</span>
                          )}
                        </p>
                        {productHint.length > 0 ? (
                          <p className="truncate text-hint text-ink-secondary">
                            {productHint.join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <OrderStatusCell row={row} />
                    </DataTableCell>
                    <DataTableCell className="whitespace-nowrap text-right tabular-nums">
                      {!isActive || openCount === 0 ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <>
                          <span
                            className={cn(
                              'font-semibold',
                              row.dueAtPickup > 0 ? 'text-ink' : 'text-ink-muted'
                            )}
                          >
                            {formatMoneyFt(row.dueAtPickup)} Ft
                          </span>
                          {row.dueIncomplete ? (
                            <span className="block text-hint text-warning-ink">
                              nem végleges
                            </span>
                          ) : null}
                        </>
                      )}
                    </DataTableCell>
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
    </div>
  )
}
