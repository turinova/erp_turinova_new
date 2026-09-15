'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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
  rows: UnifiedMaterialSearchItem[]
  total: number
  page: number
  limit: number
  initialQ: string
  initialKind?: KindFilter
  /** Staff default; partnernél null = nincs törzsadat detail. */
  sheetDetailBase?: string | null
  linearDetailBase?: string | null
  accessoryDetailBase?: string | null
  description?: string
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

function badgeTone(
  kind: UnifiedMaterialSearchItem['kind']
): 'info' | 'neutral' | 'success' {
  if (kind === 'linear') return 'info'
  if (kind === 'accessory') return 'success'
  return 'neutral'
}

export function KeresoClient({
  rows,
  total,
  page,
  limit,
  initialQ,
  initialKind = 'all',
  sheetDetailBase = DEFAULT_SHEET_DETAIL,
  linearDetailBase = DEFAULT_LINEAR_DETAIL,
  accessoryDetailBase = DEFAULT_ACCESSORY_DETAIL,
  description = 'Táblás, szálas és termék árlekérdezés — bruttó Ft/m, Ft/m² és egységár.'
}: KeresoClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [qDraft, setQDraft] = useState(initialQ)

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const hasQuery = Boolean(initialQ.trim())

  useEffect(() => {
    setQDraft(initialQ)
  }, [initialQ])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = qDraft.trim()
    if (trimmed === initialQ.trim()) return

    const timeoutId = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString())
      if (trimmed) next.set('q', trimmed)
      else next.delete('q')
      next.delete('page')
      const qs = next.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [qDraft, initialQ, pathname, router, searchParams])

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = qDraft.trim()
    pushParams({ q: trimmed || null, page: null })
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
          placeholder="Név, gyártó, SKU, vonalkód vagy gépkód…"
          className="pl-8"
          autoComplete="off"
        />
      </form>

      <div
        className="mb-3 flex flex-wrap gap-1.5"
        role="group"
        aria-label="Típus szűrő"
      >
        {KIND_CHIPS.map((chip) => {
          const active = initialKind === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() =>
                pushParams({
                  kind: chip.value === 'all' ? null : chip.value,
                  page: null
                })
              }
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

      {!hasQuery ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Kezdj el gépelni — táblás, szálas anyagok és termékek között keres
          (név, gyártó, SKU, vonalkód, gépkód). Szűrővel szűkítheted a típust.
        </p>
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Nincs találat: „{initialQ}”
          {initialKind !== 'all'
            ? ` (${KIND_CHIPS.find((c) => c.value === initialKind)?.label ?? ''})`
            : ''}
        </p>
      ) : (
        <>
          <DataTable>
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
                <DataTableHeaderCell>Beszerzés</DataTableHeaderCell>
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
                    <DataTableCell>
                      {row.on_stock == null ? (
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
                disabled={page <= 1}
                onClick={() => pushParams({ page: String(page - 1) })}
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
                disabled={page >= totalPages}
                onClick={() => pushParams({ page: String(page + 1) })}
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
