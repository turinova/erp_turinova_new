'use client'

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CircleAlert, ImageOff, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { CatalogAddProductDialog } from '@/components/webshop/catalog-add-product-dialog'
import { CatalogExcel } from '@/components/webshop/catalog-excel'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { formatMoneyFt } from '@/lib/accessories/parse'
import { setShopAvailability } from '@/lib/webshop/product-actions'
import {
  SHOP_CATALOG_DEFAULT_FILTER,
  SHOP_CATALOG_FILTER_LABEL,
  SHOP_CATALOG_PAGE_SIZE,
  SHOP_CATALOG_PRIMARY_FILTERS,
  type ShopCatalogFilter,
  type ShopCatalogPage
} from '@/lib/webshop/product-queries'
import { cn } from '@/lib/utils'

const BASE = '/webshop/katalogus'
const DEBOUNCE_MS = 300

function catalogHref(filter: ShopCatalogFilter, q: string, page: number): string {
  const sp = new URLSearchParams()
  if (filter !== SHOP_CATALOG_DEFAULT_FILTER) sp.set('filter', filter)
  if (q.trim()) sp.set('q', q.trim())
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return qs ? `${BASE}?${qs}` : BASE
}

/** URL sync RSC refetch nélkül — mint a Termékek lista. */
function syncCatalogUrl(filter: ShopCatalogFilter, q: string, page: number) {
  if (typeof window === 'undefined') return
  const href = catalogHref(filter, q, page)
  const next = new URL(href, window.location.origin)
  const target = `${next.pathname}${next.search}`
  const cur = `${window.location.pathname}${window.location.search}`
  if (cur === target) return
  window.history.replaceState(window.history.state, '', target)
}

async function fetchCatalog(opts: {
  filter: ShopCatalogFilter
  q: string
  page: number
  signal?: AbortSignal
}): Promise<ShopCatalogPage> {
  const sp = new URLSearchParams()
  if (opts.filter !== SHOP_CATALOG_DEFAULT_FILTER) sp.set('filter', opts.filter)
  if (opts.q.trim()) sp.set('q', opts.q.trim())
  if (opts.page > 1) sp.set('page', String(opts.page))
  const res = await fetch(`/api/webshop/katalogus?${sp.toString()}`, {
    signal: opts.signal,
    headers: { Accept: 'application/json' }
  })
  const body = (await res.json()) as ShopCatalogPage & { error?: string }
  if (!res.ok) {
    throw new Error(body.error || 'Nem sikerült betölteni a katalógust.')
  }
  return {
    rows: body.rows ?? [],
    total: body.total ?? 0,
    page: body.page ?? opts.page,
    pageCount: body.pageCount ?? 1,
    counts: body.counts
  }
}

type Blocked = { id: string; name: string; issues: { message: string }[] }[]

export function WebshopCatalogClient({
  data: initialData,
  filter: initialFilter,
  q: initialQ,
  canWrite
}: {
  data: ShopCatalogPage
  filter: ShopCatalogFilter
  q: string
  canWrite: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState(initialQ)
  const [activeQ, setActiveQ] = useState(initialQ.trim())
  const [filter, setFilter] = useState(initialFilter)
  const [page, setPage] = useState(initialData.page)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [blocked, setBlocked] = useState<Blocked>([])
  const [rowPending, setRowPending] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const skipDebounceRef = useRef(true)
  const skipNextDebounceRef = useRef(false)

  const applySearch = useCallback(
    (next: string, nextPage = 1, mode: 'typing' | 'commit' = 'commit') => {
      const trimmed = next.trim()
      skipNextDebounceRef.current = true
      if (mode === 'commit') setSearch(trimmed)
      setActiveQ(trimmed)
      setPage(nextPage)
      syncCatalogUrl(filter, trimmed, nextPage)
    },
    [filter]
  )

  const applyFilter = useCallback(
    (next: ShopCatalogFilter) => {
      setFilter(next)
      setPage(1)
      setSelected(new Set())
      syncCatalogUrl(next, activeQ, 1)
    },
    [activeQ]
  )

  const goPage = useCallback(
    (nextPage: number) => {
      setPage(nextPage)
      setSelected(new Set())
      syncCatalogUrl(filter, activeQ, nextPage)
    },
    [filter, activeQ]
  )

  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false
      return
    }
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false
      return
    }
    if (search.trim() === activeQ) return
    const t = window.setTimeout(() => applySearch(search, 1, 'typing'), DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [search, activeQ, applySearch])

  const canUseSeed =
    activeQ === initialQ.trim() &&
    filter === initialFilter &&
    page === initialData.page

  const query = useQuery({
    queryKey: ['webshop-katalogus', activeQ, filter, page],
    queryFn: ({ signal }) =>
      fetchCatalog({ q: activeQ, filter, page, signal }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    initialData: canUseSeed ? initialData : undefined,
    initialDataUpdatedAt: canUseSeed ? Date.now() : undefined
  })

  const data = query.data ?? initialData
  const loading = query.isFetching || query.isLoading

  useEffect(() => {
    if (!query.isError) return
    toast.error(
      query.error instanceof Error ? query.error.message : 'Katalógus betöltési hiba.'
    )
  }, [query.isError, query.error])

  const pipelineTotal =
    data.counts.all ?? (data.counts.live ?? 0) + (data.counts.draft ?? 0)

  const pageIds = data.rows.map((r) => r.id)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function invalidateCatalog() {
    void queryClient.invalidateQueries({ queryKey: ['webshop-katalogus'] })
  }

  function bulk(on: boolean) {
    const ids = [...selected]
    startTransition(async () => {
      const r = await setShopAvailability(ids, on)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      setBlocked(r.blocked)
      if (on) {
        toast[r.blocked.length > 0 ? 'warning' : 'success'](
          r.blocked.length > 0
            ? `${r.updated} Live, ${r.blocked.length} még nem tehető ki.`
            : `${r.updated} termék Live.`
        )
      } else {
        toast.success(`${r.updated} termék levéve (nincs Live).`)
      }
      setSelected(new Set())
      invalidateCatalog()
      router.refresh()
    })
  }

  function toggleLive(id: string, on: boolean) {
    setRowPending(id)
    startTransition(async () => {
      const r = await setShopAvailability([id], on)
      setRowPending(null)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      if (on && r.blocked.length > 0) {
        setBlocked(r.blocked)
        toast.warning(r.blocked[0]?.issues[0]?.message ?? 'Live-hoz még hiányzik adat.')
        return
      }
      setBlocked([])
      toast.success(on ? 'Live — a vevők látják.' : 'Levéve a boltból.')
      invalidateCatalog()
      router.refresh()
    })
  }

  const from = data.total === 0 ? 0 : (data.page - 1) * SHOP_CATALOG_PAGE_SIZE + 1
  const to = Math.min(data.page * SHOP_CATALOG_PAGE_SIZE, data.total)

  function emptyCopy(): string {
    if (pipelineTotal === 0) {
      return 'A bolt még üres. Adj hozzá termékeket az ERP-ből.'
    }
    if (filter === 'live') {
      return 'Még nincs Live termék. Kapcsold be a Készül listából, vagy adj hozzá újat.'
    }
    if (filter === 'draft') return 'Nincs készülő (nem Live) termék.'
    if (filter === 'incomplete') return 'Nincs Agent Top hiányos Live termék. Szép munka!'
    if (filter === 'agent_ok') return 'Még nincs Agent Top kész termék.'
    if (activeQ) return 'Nincs találat a keresésre ebben a szűrésben.'
    return 'Nincs találat ebben a szűrésben.'
  }

  return (
    <div>
      <PageHeader
        title="Katalógus"
        description="Amit a boltban árulsz. Live = a vevő látja. Agent Top = kereső / feed."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <CatalogExcel
              filter={filter}
              filterLabel={SHOP_CATALOG_FILTER_LABEL[filter]}
              q={activeQ}
              count={data.total}
              canWrite={canWrite}
            />
            {canWrite ? (
              <Button type="button" onClick={() => setAddOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Termék hozzáadása
              </Button>
            ) : null}
          </div>
        }
      />

      <CatalogAddProductDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onManufacturerAdded={() => {
          applyFilter('draft')
          invalidateCatalog()
          router.refresh()
        }}
      />

      <div className="mb-2.5 flex flex-col gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applySearch(search, 1, 'commit')
          }}
          className="relative max-w-sm"
          role="search"
        >
          <label className="sr-only" htmlFor="webshop-catalog-search">
            Keresés a boltban
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="webshop-catalog-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés a bolt termékei között…"
            className="pl-8"
            aria-busy={loading}
          />
        </form>
        <nav className="flex flex-wrap gap-1.5" aria-label="Szűrés">
          {SHOP_CATALOG_PRIMARY_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => applyFilter(f)}
              aria-current={filter === f ? 'page' : undefined}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-hint font-medium',
                filter === f
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
              )}
            >
              {SHOP_CATALOG_FILTER_LABEL[f]}
              <span className="tabular-nums opacity-80">{data.counts[f] ?? 0}</span>
            </button>
          ))}
        </nav>
      </div>

      {canWrite && selected.size > 0 ? (
        <div
          className="mb-2.5 flex flex-wrap items-center gap-2 rounded-md border border-border bg-subtle px-3 py-2"
          role="region"
          aria-label="Tömeges művelet"
        >
          <span className="mr-auto text-body text-ink">{selected.size} termék kijelölve</span>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setSelected(new Set())}>
            Kijelölés törlése
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => bulk(false)}>
            Live ki
          </Button>
          <Button type="button" loading={pending} onClick={() => bulk(true)}>
            Live be
          </Button>
        </div>
      ) : null}

      {blocked.length > 0 ? (
        <div
          className="mb-2.5 space-y-1 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink"
          role="status"
        >
          <p className="flex items-center gap-1.5 font-medium">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden />
            Live-hoz még kell:
          </p>
          <ul className="space-y-0.5">
            {blocked.slice(0, 10).map((b) => (
              <li key={b.id}>
                <Link href={`${BASE}/${b.id}`} className="underline underline-offset-2">
                  {b.name}
                </Link>{' '}
                — {b.issues[0]?.message}
                {b.issues.length > 1 ? ` (+${b.issues.length - 1})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center">
          <p className="text-body text-ink-secondary">{emptyCopy()}</p>
          {canWrite && (pipelineTotal === 0 || filter === 'live') ? (
            <Button type="button" className="mt-3" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Termék hozzáadása
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={cn(loading && 'opacity-70 transition-opacity')}>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                {canWrite ? (
                  <DataTableHeaderCell className="w-9">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label="Az oldal összes termékének kijelölése"
                      checked={allOnPage}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          for (const id of pageIds) {
                            if (allOnPage) next.delete(id)
                            else next.add(id)
                          }
                          return next
                        })
                      }
                    />
                  </DataTableHeaderCell>
                ) : null}
                <DataTableHeaderCell>Termék</DataTableHeaderCell>
                <DataTableHeaderCell className="w-24">Live</DataTableHeaderCell>
                <DataTableHeaderCell className="w-28">Agent</DataTableHeaderCell>
                <DataTableHeaderCell>Következő</DataTableHeaderCell>
                <DataTableHeaderCell className="w-28 text-right">Művelet</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {data.rows.map((row) => {
                const editHref = `${BASE}/${row.id}`
                const agentHref = `${editHref}#agent`
                const nextHref =
                  row.next_step?.group === 'alap'
                    ? `/torzsadatok/alapanyagok/termekek/${row.id}`
                    : row.next_step?.group === 'agent'
                      ? agentHref
                      : row.next_step
                        ? `${editHref}#csoport-${row.next_step.group}`
                        : editHref
                return (
                  <DataTableRow key={row.id}>
                    {canWrite ? (
                      <DataTableCell>
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          aria-label={`${row.name} kijelölése`}
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                        />
                      </DataTableCell>
                    ) : null}
                    <DataTableCell>
                      <div className="flex items-center gap-2">
                        <span className="size-8 shrink-0 overflow-hidden rounded border border-border bg-subtle">
                          {row.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.image_url}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex size-full items-center justify-center text-ink-muted">
                              <ImageOff className="size-3.5" aria-label="Nincs kép" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <Link
                            href={editHref}
                            className="block truncate font-medium text-ink underline-offset-2 hover:underline"
                          >
                            {row.name}
                          </Link>
                          <span className="text-hint tabular-nums text-ink-secondary">
                            {row.sku} · {formatMoneyFt(row.price_gross)}
                            {row.active ? '' : ' · inaktív'}
                          </span>
                        </span>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      {canWrite ? (
                        <Switch
                          id={`live-${row.id}`}
                          checked={row.sellable}
                          disabled={pending || rowPending === row.id}
                          onCheckedChange={(on) => toggleLive(row.id, on)}
                          label={row.sellable ? 'Be' : 'Ki'}
                        />
                      ) : (
                        <StatusBadge tone={row.sellable ? 'success' : 'neutral'}>
                          {row.sellable ? 'Be' : 'Ki'}
                        </StatusBadge>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      {!row.sellable ? (
                        <span className="text-hint text-ink-muted">—</span>
                      ) : row.agent_top ? (
                        <StatusBadge tone="success">Kész</StatusBadge>
                      ) : (
                        <Link href={agentHref}>
                          <StatusBadge tone="warning">Hiányzik</StatusBadge>
                        </Link>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      {row.next_step ? (
                        <Link
                          href={nextHref}
                          className="inline-flex items-center gap-1 text-hint text-ink underline-offset-2 hover:underline"
                        >
                          {row.next_step.label}
                          <ArrowRight className="size-3 shrink-0" aria-hidden />
                        </Link>
                      ) : (
                        <span className="text-hint text-ink-muted">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <Link
                        href={editHref}
                        className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 text-hint font-medium text-ink hover:bg-subtle"
                      >
                        Szerkesztés
                      </Link>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>
        </div>
      )}

      {data.total > 0 ? (
        <nav className="mt-2.5 flex items-center justify-between gap-2" aria-label="Lapozás">
          <span className="text-hint tabular-nums text-ink-secondary">
            {from}–{to} / {data.total}
          </span>
          <div className="flex gap-1.5">
            {page > 1 ? (
              <button
                type="button"
                onClick={() => goPage(page - 1)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 text-hint font-medium text-ink hover:bg-subtle"
              >
                Előző
              </button>
            ) : null}
            {page < data.pageCount ? (
              <button
                type="button"
                onClick={() => goPage(page + 1)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 text-hint font-medium text-ink hover:bg-subtle"
              >
                Következő
              </button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
