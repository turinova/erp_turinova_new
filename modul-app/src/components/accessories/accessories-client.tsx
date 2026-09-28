'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Package, Plus, Printer, Search } from 'lucide-react'
import { toast } from 'sonner'

import { AccessoriesExcel } from '@/components/accessories/accessories-excel'
import { ProductLabelPrintDialog } from '@/components/labels/product-label-print-dialog'
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { softDeleteAccessory } from '@/lib/accessories/actions'
import { formatMoneyFt } from '@/lib/accessories/parse'
import {
  ACCESSORY_PAGE_SIZE,
  type AccessoryListItem,
  type AccessoryListPage,
  type AccessoryUnitOption,
  type AccessoryWebFilter
} from '@/lib/accessories/queries'
import type { ProductLabelPayload } from '@/lib/labels/types'
import { cn } from '@/lib/utils'

const LIST_PATH = '/torzsadatok/alapanyagok/termekek'
const DEBOUNCE_MS = 150

const WEB_FILTER_LABEL: Record<AccessoryWebFilter, string> = {
  all: 'Összes',
  web: 'Kint van a boltban',
  not_web: 'Nincs a boltban'
}

function listHref(q: string, web: AccessoryWebFilter, page: number): string {
  const sp = new URLSearchParams()
  if (q.trim()) sp.set('q', q.trim())
  if (web !== 'all') sp.set('web', web)
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return qs ? `${LIST_PATH}?${qs}` : LIST_PATH
}

function toLabelPayload(row: AccessoryListItem): ProductLabelPayload {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    barcodeInternal: row.barcode_internal,
    priceGross: row.price_gross,
    unitShortform: row.unit_shortform
  }
}

async function fetchTermekek(opts: {
  q: string
  web: AccessoryWebFilter
  page: number
  signal?: AbortSignal
}): Promise<AccessoryListPage> {
  const sp = new URLSearchParams()
  if (opts.q.trim()) sp.set('q', opts.q.trim())
  if (opts.web !== 'all') sp.set('web', opts.web)
  if (opts.page > 1) sp.set('page', String(opts.page))
  const res = await fetch(`/api/termekek?${sp.toString()}`, {
    signal: opts.signal,
    headers: { Accept: 'application/json' }
  })
  const body = (await res.json()) as AccessoryListPage & { error?: string }
  if (!res.ok) {
    throw new Error(body.error || 'Nem sikerült betölteni a termékeket.')
  }
  return {
    rows: body.rows ?? [],
    total: body.total ?? 0,
    page: body.page ?? opts.page,
    pageCount: body.pageCount ?? 1
  }
}

type AccessoriesClientProps = {
  data: AccessoryListPage
  q: string
  web: AccessoryWebFilter
  canWrite: boolean
  canPrintLabels?: boolean
  units?: AccessoryUnitOption[]
  hasWebshop?: boolean
  /** false: SSR lista fail/skip → azonnali /api/termekek fetch (ne empty initialData) */
  serverSeeded?: boolean
}

export function AccessoriesClient({
  data: initialData,
  q: initialQ,
  web,
  canWrite,
  canPrintLabels = false,
  units = [],
  hasWebshop = false,
  serverSeeded = true
}: AccessoriesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQ)
  const [activeQ, setActiveQ] = useState(initialQ.trim())
  const [page, setPage] = useState(initialData.page)
  const [deleteTarget, setDeleteTarget] = useState<AccessoryListItem | null>(null)
  const [previewTarget, setPreviewTarget] = useState<AccessoryListItem | null>(null)
  const [labelTarget, setLabelTarget] = useState<ProductLabelPayload | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (search.trim() === activeQ) return
    const t = window.setTimeout(() => {
      const next = search.trim()
      setActiveQ(next)
      setPage(1)
      router.replace(listHref(next, web, 1), { scroll: false })
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [search, activeQ, web, router])

  const canUseSeed =
    serverSeeded &&
    activeQ === initialQ.trim() &&
    page === initialData.page

  const query = useQuery({
    queryKey: ['termekek', activeQ, web, page],
    queryFn: ({ signal }) =>
      fetchTermekek({ q: activeQ, web, page, signal }),
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
      query.error instanceof Error
        ? query.error.message
        : 'Nem sikerült betölteni a termékeket.'
    )
  }, [query.isError, query.error])

  function goPage(next: number) {
    setPage(next)
    router.replace(listHref(activeQ, web, next), { scroll: false })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await softDeleteAccessory(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.name}” törölve.`)
      setDeleteTarget(null)
      await query.refetch()
    })
  }

  const filtered = activeQ !== '' || web !== 'all'
  const from = data.total === 0 ? 0 : (data.page - 1) * ACCESSORY_PAGE_SIZE + 1
  const to = Math.min(data.page * ACCESSORY_PAGE_SIZE, data.total)

  return (
    <div>
      <PageHeader
        title="Termékek"
        description="Eladható termékek törzse."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AccessoriesExcel canWrite={canWrite} />
            {canWrite ? (
              <Button type="button" onClick={() => router.push(`${LIST_PATH}/uj`)}>
                <Plus className="size-3.5" aria-hidden />
                Új termék
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const next = search.trim()
            setActiveQ(next)
            setPage(1)
            router.replace(listHref(next, web, 1), { scroll: false })
          }}
          className="relative max-w-sm flex-1"
          role="search"
        >
          <label className="sr-only" htmlFor="accessory-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="accessory-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név, SKU, vonalkód, gyártó…"
            className="pl-8"
            aria-busy={loading}
          />
        </form>
        {hasWebshop ? (
          <nav className="flex flex-wrap gap-1.5" aria-label="Szűrés">
            {(Object.keys(WEB_FILTER_LABEL) as AccessoryWebFilter[]).map((value) => (
              <Link
                key={value}
                href={listHref(activeQ, value, 1)}
                aria-current={web === value ? 'page' : undefined}
                className={cn(
                  'inline-flex h-7 items-center rounded-md border px-2.5 text-hint font-medium',
                  web === value
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
                )}
              >
                {WEB_FILTER_LABEL[value]}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {query.isError ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {query.error instanceof Error
            ? query.error.message
            : 'Nem sikerült betölteni a termékeket.'}
        </p>
      ) : null}

      {data.rows.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <Package className="size-8 text-ink-secondary" aria-hidden />
          <div className="space-y-1">
            <p className="text-body font-medium text-ink">
              {filtered || data.total > 0 ? 'Nincs találat' : 'Még nincs termék'}
            </p>
            <p className="max-w-sm text-body text-ink-secondary">
              {filtered || data.total > 0
                ? 'Próbálj másik keresőkifejezést vagy szűrőt.'
                : 'Adj hozzá egy terméket, vagy töltsd fel Excelből.'}
            </p>
          </div>
          {canWrite && !filtered && data.total === 0 ? (
            <Button type="button" onClick={() => router.push(`${LIST_PATH}/uj`)}>
              <Plus className="size-3.5" aria-hidden />
              Új termék
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell className="w-16">Kép</DataTableHeaderCell>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>SKU</DataTableHeaderCell>
              <DataTableHeaderCell>Gyártó</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Bruttó</DataTableHeaderCell>
              <DataTableHeaderCell>Egység</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                {canPrintLabels || canWrite ? 'Műveletek' : null}
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {data.rows.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell>
                  {row.image_url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewTarget(row)}
                      className="block rounded-md border border-border p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={`${row.name} képének megnyitása`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.image_url}
                        alt=""
                        loading="lazy"
                        className="size-12 rounded-[5px] object-cover"
                      />
                    </button>
                  ) : (
                    <span
                      className="flex size-12 items-center justify-center rounded-md border border-dashed border-border text-ink-muted"
                      aria-hidden
                    >
                      <Package className="size-5" />
                    </span>
                  )}
                </DataTableCell>
                <DataTableCell className="font-medium text-ink">
                  <Link href={`${LIST_PATH}/${row.id}`} className="underline-offset-2 hover:underline">
                    {row.name}
                  </Link>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">{row.sku}</DataTableCell>
                <DataTableCell className="text-ink-secondary">{row.manufacturer_name}</DataTableCell>
                <DataTableCell className="text-right tabular-nums text-ink">
                  {formatMoneyFt(row.price_gross)}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">{row.unit_shortform}</DataTableCell>
                <DataTableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={row.active ? 'success' : 'neutral'}>
                      {row.active ? 'Aktív' : 'Inaktív'}
                    </StatusBadge>
                    {row.active && row.sellable_pos === false ? (
                      <StatusBadge tone="neutral">Nem POS</StatusBadge>
                    ) : null}
                    {hasWebshop && row.in_shop ? <StatusBadge tone="info">Boltban</StatusBadge> : null}
                  </div>
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canPrintLabels ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Címke: ${row.name}`}
                        title="Címke nyomtatása"
                        onClick={() => setLabelTarget(toLabelPayload(row))}
                      >
                        <Printer className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger-ink hover:text-danger-ink"
                        onClick={() => setDeleteTarget(row)}
                      >
                        Törlés
                      </Button>
                    ) : null}
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {data.total > 0 ? (
        <nav className="mt-2.5 flex items-center justify-between gap-2" aria-label="Lapozás">
          <span className="text-hint tabular-nums text-ink-secondary">
            {from}–{to} / {data.total.toLocaleString('hu-HU')}
            {loading ? ' · …' : ''}
          </span>
          <div className="flex gap-1.5">
            {data.page > 1 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loading}
                onClick={() => goPage(data.page - 1)}
              >
                Előző
              </Button>
            ) : null}
            {data.page < data.pageCount ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loading}
                onClick={() => goPage(data.page + 1)}
              >
                Következő
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}

      <Dialog
        open={Boolean(previewTarget?.image_url)}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{previewTarget?.name ?? 'Kép'}</DialogTitle>
            <DialogDescription>
              {previewTarget ? `${previewTarget.manufacturer_name} · ${previewTarget.sku}` : null}
            </DialogDescription>
          </DialogHeader>
          {previewTarget?.image_url ? (
            <div className="overflow-hidden rounded-md border border-border bg-app">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewTarget.image_url}
                alt={previewTarget.name}
                className="mx-auto max-h-[60vh] w-full object-contain"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPreviewTarget(null)}>
              Bezárás
            </Button>
            {previewTarget ? (
              <Button
                type="button"
                onClick={() => {
                  const id = previewTarget.id
                  setPreviewTarget(null)
                  router.push(`${LIST_PATH}/${id}`)
                }}
              >
                Termék megnyitása
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Termék törlése?"
        description={
          deleteTarget
            ? `A „${deleteTarget.name}” soft delete lesz — a meglévő ajánlatok snapshotjai megmaradnak.`
            : ''
        }
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
      />

      {canPrintLabels ? (
        <ProductLabelPrintDialog
          open={Boolean(labelTarget)}
          payload={labelTarget}
          units={units}
          onClose={() => setLabelTarget(null)}
        />
      ) : null}
    </div>
  )
}
