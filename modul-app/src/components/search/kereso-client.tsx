'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  keepPreviousData,
  useQuery
} from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Search } from 'lucide-react'

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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  formatUnifiedPrice,
  formatUnifiedSizeLabel,
  type UnifiedMaterialSearchItem,
  type UnifiedSearchKind
} from '@/lib/search/materials-search'
import { cn } from '@/lib/utils'

type KindFilter = UnifiedSearchKind | 'all'

type KeresoClientProps = {
  /** Opcionális SSR seed deep-linkhez; gépelés után az API veszi át. */
  initialRows?: UnifiedMaterialSearchItem[]
  initialTotal?: number
  initialPage?: number
  initialLimit?: number
  initialQ?: string
  initialKind?: KindFilter
  /**
   * Ha megadott (partner tenant beállítás), csak ezek a chippek jelennek meg.
   * 1 elem → nincs chip-sor.
   */
  allowedKinds?: UnifiedSearchKind[]
  /** Staff default; partnernél null = nincs törzsadat detail. */
  sheetDetailBase?: string | null
  linearDetailBase?: string | null
  accessoryDetailBase?: string | null
  description?: string
  /** Beszerzés addon: termék sorokon ledger készlet a Beszerzés oszlopban. */
  showProcurementStock?: boolean
}

const DEFAULT_SHEET_DETAIL = '/torzsadatok/alapanyagok/tablas-anyagok'
const DEFAULT_LINEAR_DETAIL = '/torzsadatok/alapanyagok/szalas-anyagok'
const DEFAULT_ACCESSORY_DETAIL = '/torzsadatok/alapanyagok/termekek'

const KIND_CHIPS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Összes' },
  { value: 'sheet', label: 'Táblás' },
  { value: 'linear', label: 'Szálas' },
  { value: 'accessory', label: 'Termék' }
]

const DEBOUNCE_MS = 150

function badgeTone(
  kind: UnifiedMaterialSearchItem['kind']
): 'info' | 'neutral' | 'success' {
  if (kind === 'linear') return 'info'
  if (kind === 'accessory') return 'success'
  return 'neutral'
}

type SearchApiResponse = {
  rows: UnifiedMaterialSearchItem[]
  total: number
  page: number
  limit: number
  showProcurementStock?: boolean
  error?: string
}

function formatStockQty(n: number) {
  return new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 3
  }).format(n)
}

async function fetchKereso(params: {
  q: string
  kind: KindFilter
  page: number
  limit: number
  signal?: AbortSignal
}): Promise<SearchApiResponse> {
  const sp = new URLSearchParams({
    q: params.q,
    page: String(params.page),
    limit: String(params.limit)
  })
  if (params.kind !== 'all') sp.set('kind', params.kind)

  const res = await fetch(`/api/kereso?${sp.toString()}`, {
    signal: params.signal,
    cache: 'no-store'
  })
  const data = (await res.json()) as SearchApiResponse
  if (!res.ok) {
    throw new Error(data.error || 'Nem sikerült a keresés.')
  }
  return data
}

export function KeresoClient({
  initialRows = [],
  initialTotal = 0,
  initialPage = 1,
  initialLimit = 25,
  initialQ = '',
  initialKind = 'all',
  allowedKinds,
  sheetDetailBase = DEFAULT_SHEET_DETAIL,
  linearDetailBase = DEFAULT_LINEAR_DETAIL,
  accessoryDetailBase = DEFAULT_ACCESSORY_DETAIL,
  description,
  showProcurementStock: showProcurementStockProp = false
}: KeresoClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const kindRef = useRef<KindFilter>(initialKind)
  const skipDebounceRef = useRef(true)
  const [, startUrlTransition] = useTransition()
  const [showProcurementStock, setShowProcurementStock] = useState(
    showProcurementStockProp
  )

  const visibleChips = (() => {
    if (!allowedKinds || allowedKinds.length === 0) return KIND_CHIPS
    if (allowedKinds.length === 1) return [] as typeof KIND_CHIPS
    const allowed = new Set(allowedKinds)
    return KIND_CHIPS.filter(
      (c) => c.value === 'all' || allowed.has(c.value as UnifiedSearchKind)
    )
  })()

  const [qDraft, setQDraft] = useState(initialQ)
  const [activeQ, setActiveQ] = useState(initialQ.trim())
  const [kind, setKind] = useState<KindFilter>(initialKind)
  const [page, setPage] = useState(initialPage)
  const [limit] = useState(initialLimit)

  kindRef.current = kind

  const syncUrl = useCallback(
    (nextQ: string, nextKind: KindFilter, nextPage: number) => {
      startUrlTransition(() => {
        const next = new URLSearchParams()
        if (nextQ) next.set('q', nextQ)
        if (nextKind !== 'all') next.set('kind', nextKind)
        if (nextPage > 1) next.set('page', String(nextPage))
        const qs = next.toString()
        const href = qs ? `${pathname}?${qs}` : pathname
        if (qs === searchParams.toString()) return
        router.replace(href, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  const commitSearch = useCallback(
    (q: string, nextKind: KindFilter, nextPage: number) => {
      const trimmed = q.trim()
      setActiveQ(trimmed)
      setKind(nextKind)
      setPage(nextPage)
      syncUrl(trimmed, nextKind, nextPage)
    },
    [syncUrl]
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false
      return
    }
    const timeoutId = window.setTimeout(() => {
      commitSearch(qDraft.trim(), kindRef.current, 1)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [qDraft, commitSearch])

  const hasQuery = Boolean(activeQ)

  const query = useQuery({
    queryKey: ['kereso', activeQ, kind, page, limit],
    queryFn: ({ signal }) =>
      fetchKereso({ q: activeQ, kind, page, limit, signal }),
    enabled: hasQuery,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    initialData:
      hasQuery &&
      activeQ === initialQ.trim() &&
      kind === initialKind &&
      page === initialPage &&
      initialRows.length > 0
        ? {
            rows: initialRows,
            total: initialTotal,
            page: initialPage,
            limit: initialLimit
          }
        : undefined,
    initialDataUpdatedAt:
      hasQuery && initialRows.length > 0 ? Date.now() : undefined
  })

  const rows = query.data?.rows ?? (hasQuery ? initialRows : [])
  const total = query.data?.total ?? (hasQuery ? initialTotal : 0)
  const loading = query.isFetching
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : 'Nem sikerült a keresés. Próbáld újra.'
    : null

  useEffect(() => {
    if (typeof query.data?.showProcurementStock === 'boolean') {
      setShowProcurementStock(query.data.showProcurementStock)
    }
  }, [query.data?.showProcurementStock])

  useEffect(() => {
    setShowProcurementStock(showProcurementStockProp)
  }, [showProcurementStockProp])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    commitSearch(qDraft, kind, 1)
  }

  function handleKindChange(next: KindFilter) {
    commitSearch(qDraft, next, 1)
  }

  function handlePageChange(nextPage: number) {
    commitSearch(activeQ || qDraft, kind, nextPage)
  }

  function detailHref(row: UnifiedMaterialSearchItem): string | null {
    const base =
      row.kind === 'linear'
        ? linearDetailBase
        : row.kind === 'accessory'
          ? accessoryDetailBase
          : sheetDetailBase
    if (!base) return null
    return `${base}/${row.id}`
  }

  function openDetail(row: UnifiedMaterialSearchItem) {
    const href = detailHref(row)
    if (!href) return
    router.push(href)
  }

  return (
    <div>
      <PageHeader title="Kereső" description={description} />

      <form onSubmit={handleSubmit} className="relative mb-3 max-w-lg">
        <label className="sr-only" htmlFor="kereso-q">
          Keresés
        </label>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id="kereso-q"
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          placeholder="pl. Egger W1000"
          className="pl-8"
          autoComplete="off"
          aria-busy={loading}
        />
        {loading ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-secondary">
            Keresés…
          </span>
        ) : null}
      </form>

      {visibleChips.length > 0 ? (
        <div
          className="mb-3 flex flex-wrap gap-1.5"
          role="group"
          aria-label="Típus szűrő"
        >
          {visibleChips.map((chip) => {
            const active = kind === chip.value
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => handleKindChange(chip.value)}
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
      ) : null}

      {error ? (
        <p
          className="mb-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {!hasQuery ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Írj be egy terméknevet, gyártót vagy kódot.
        </p>
      ) : loading && rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Keresés…
        </p>
      ) : total === 0 && !loading ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Nincs találat: „{activeQ}”
          {kind !== 'all'
            ? ` (${KIND_CHIPS.find((c) => c.value === kind)?.label ?? ''})`
            : ''}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Keresés…
        </p>
      ) : (
        <>
          <DataTable className={cn(loading && 'opacity-70')}>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Gyártó</DataTableHeaderCell>
                <DataTableHeaderCell>Megnevezés</DataTableHeaderCell>
                <DataTableHeaderCell>Típus</DataTableHeaderCell>
                <DataTableHeaderCell>Méret / SKU</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Ft/m
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Ft/m²
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Egész / egységár
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  className={showProcurementStock ? 'text-right' : undefined}
                >
                  {showProcurementStock ? 'Készlet' : 'Beszerzés'}
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const href = detailHref(row)
                const canOpen = Boolean(href)
                const isAccessory = row.kind === 'accessory'
                return (
                  <DataTableRow
                    key={`${row.kind}-${row.id}`}
                    className={cn(
                      canOpen && 'cursor-pointer hover:bg-subtle'
                    )}
                    onClick={canOpen ? () => openDetail(row) : undefined}
                  >
                    <DataTableCell className="text-ink">
                      {row.manufacturer_name}
                    </DataTableCell>
                    <DataTableCell>
                      {href ? (
                        <Link
                          href={href}
                          className="font-medium text-ink no-underline hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{row.name}</span>
                      )}
                      {isAccessory && row.unit_shortform ? (
                        <span className="mt-0.5 block text-hint text-ink-secondary">
                          Ft / {row.unit_shortform}
                        </span>
                      ) : null}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge tone={badgeTone(row.kind)}>
                        {row.type_label}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell className="tabular-nums text-ink">
                      {formatUnifiedSizeLabel(row)}
                      {!isAccessory ? (
                        <span className="text-hint text-ink-secondary">
                          {' '}
                          mm
                        </span>
                      ) : null}
                    </DataTableCell>
                    <DataTableCell className="text-right tabular-nums font-medium text-ink">
                      {formatUnifiedPrice(row.price_gross_per_m)}
                    </DataTableCell>
                    <DataTableCell className="text-right tabular-nums font-medium text-ink">
                      {formatUnifiedPrice(row.price_gross_sqm)}
                    </DataTableCell>
                    <DataTableCell className="text-right tabular-nums font-medium text-ink">
                      {formatUnifiedPrice(row.price_gross_piece)}
                    </DataTableCell>
                    <DataTableCell
                      className={
                        showProcurementStock && isAccessory
                          ? 'text-right'
                          : undefined
                      }
                    >
                      {showProcurementStock && isAccessory ? (
                        row.stock_on_hand == null ? (
                          <span className="text-hint text-ink-secondary">
                            —
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'text-[15px] font-semibold tabular-nums',
                              row.stock_on_hand > 0
                                ? 'text-success-ink'
                                : 'text-ink-muted'
                            )}
                          >
                            {formatStockQty(row.stock_on_hand)}{' '}
                            {row.unit_shortform || 'db'}
                          </span>
                        )
                      ) : row.on_stock == null ? (
                        <span className="text-hint text-ink-secondary">—</span>
                      ) : (
                        <StatusBadge
                          tone={row.on_stock ? 'success' : 'neutral'}
                        >
                          {row.on_stock ? 'Raktári' : 'Rendelős'}
                        </StatusBadge>
                      )}
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
                disabled={page <= 1 || loading}
                onClick={() => handlePageChange(page - 1)}
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
                disabled={page >= totalPages || loading}
                onClick={() => handlePageChange(page + 1)}
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
