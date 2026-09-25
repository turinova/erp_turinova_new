'use client'

import { ArrowRight, CircleAlert, ImageOff, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
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
import { CatalogExcel } from '@/components/webshop/catalog-excel'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoneyFt } from '@/lib/accessories/parse'
import { SHOP_READY_LABEL, shopReadyTone } from '@/lib/accessories/web-shop'
import { setShopAvailability } from '@/lib/webshop/product-actions'
import {
  SHOP_CATALOG_FILTER_LABEL,
  SHOP_CATALOG_FILTERS,
  SHOP_CATALOG_PAGE_SIZE,
  type ShopCatalogFilter,
  type ShopCatalogPage
} from '@/lib/webshop/product-queries'
import { cn } from '@/lib/utils'

const BASE = '/webshop/katalogus'

function catalogHref(filter: ShopCatalogFilter, q: string, page: number): string {
  const sp = new URLSearchParams()
  if (filter !== 'all') sp.set('filter', filter)
  if (q.trim()) sp.set('q', q.trim())
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return qs ? `${BASE}?${qs}` : BASE
}

type Blocked = { id: string; name: string; issues: { message: string }[] }[]

export function WebshopCatalogClient({
  data,
  filter,
  q,
  canWrite
}: {
  data: ShopCatalogPage
  filter: ShopCatalogFilter
  q: string
  canWrite: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState(q)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [blocked, setBlocked] = useState<Blocked>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => setSelected(new Set()), [data])

  useEffect(() => {
    if (search.trim() === q.trim()) return
    const t = setTimeout(() => router.replace(catalogHref(filter, search, 1)), 300)
    return () => clearTimeout(t)
  }, [search, q, filter, router])

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
            ? `${r.updated} termék kint van, ${r.blocked.length} még nem tehető ki.`
            : `${r.updated} termék kint van a boltban.`
        )
      } else {
        toast.success(`${r.updated} termék levéve a boltból.`)
      }
      router.refresh()
    })
  }

  const from = data.total === 0 ? 0 : (data.page - 1) * SHOP_CATALOG_PAGE_SIZE + 1
  const to = Math.min(data.page * SHOP_CATALOG_PAGE_SIZE, data.total)

  return (
    <div>
      <PageHeader
        title="Bolt katalógus"
        description="Minden termék és a boltbeli állapota. Kezdd a hiányosokkal: a sor végén látod, mi a következő lépés."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <CatalogExcel
              filter={filter}
              filterLabel={SHOP_CATALOG_FILTER_LABEL[filter]}
              q={q}
              count={data.total}
              canWrite={canWrite}
            />
          </div>
        }
      />

      <div className="mb-2.5 flex flex-col gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            router.replace(catalogHref(filter, search, 1))
          }}
          className="relative max-w-sm"
          role="search"
        >
          <label className="sr-only" htmlFor="webshop-catalog-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="webshop-catalog-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név, cikkszám, vonalkód…"
            className="pl-8"
          />
        </form>
        <nav className="flex flex-wrap gap-1.5" aria-label="Szűrés">
          {SHOP_CATALOG_FILTERS.map((f) => (
            <Link
              key={f}
              href={catalogHref(f, q, 1)}
              aria-current={filter === f ? 'page' : undefined}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-hint font-medium',
                filter === f
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
              )}
            >
              {SHOP_CATALOG_FILTER_LABEL[f]}
              <span className="tabular-nums opacity-80">{data.counts[f]}</span>
            </Link>
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
            Leveszem a boltból
          </Button>
          <Button type="button" loading={pending} onClick={() => bulk(true)}>
            Kiteszem a boltba
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
            Ezek még nem tehetők ki a boltba:
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
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          {filter === 'incomplete' ? 'Nincs hiányos termék a boltban. Szép munka!' : 'Nincs találat ebben a szűrésben.'}
        </p>
      ) : (
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
              <DataTableHeaderCell>Kategória</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell>Következő lépés</DataTableHeaderCell>
              <DataTableHeaderCell className="w-28 text-right">Művelet</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {data.rows.map((row) => {
              const editHref = `${BASE}/${row.id}`
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
                          <img src={row.image_url} alt="" className="size-full object-cover" loading="lazy" />
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
                  <DataTableCell className="text-ink-secondary">
                    {row.category_name ?? <span className="text-ink-muted">Nincs</span>}
                  </DataTableCell>
                  <DataTableCell>
                    {row.sellable ? (
                      <StatusBadge tone={shopReadyTone(row.level)}>{SHOP_READY_LABEL[row.level]}</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Nincs a boltban</StatusBadge>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    {row.next_step ? (
                      <Link
                        href={
                          row.next_step.group === 'alap'
                            ? `/torzsadatok/alapanyagok/termekek/${row.id}`
                            : `${editHref}#csoport-${row.next_step.group}`
                        }
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
      )}

      {data.total > 0 ? (
        <nav className="mt-2.5 flex items-center justify-between gap-2" aria-label="Lapozás">
          <span className="text-hint tabular-nums text-ink-secondary">
            {from}–{to} / {data.total}
          </span>
          <div className="flex gap-1.5">
            {data.page > 1 ? (
              <Link
                href={catalogHref(filter, q, data.page - 1)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 text-hint font-medium text-ink hover:bg-subtle"
              >
                Előző
              </Link>
            ) : null}
            {data.page < data.pageCount ? (
              <Link
                href={catalogHref(filter, q, data.page + 1)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-2.5 text-hint font-medium text-ink hover:bg-subtle"
              >
                Következő
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
