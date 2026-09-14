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
  formatSearchPrice,
  formatSheetSizeLabel,
  type SheetMaterialSearchItem
} from '@/lib/sheet-materials/search-queries'
import { cn } from '@/lib/utils'

type KeresoClientProps = {
  rows: SheetMaterialSearchItem[]
  total: number
  page: number
  limit: number
  initialQ: string
  /** Staff default; partnernél null = nincs törzsadat detail. */
  detailBase?: string | null
  description?: string
}

const DEFAULT_DETAIL = '/torzsadatok/alapanyagok/tablas-anyagok'

export function KeresoClient({
  rows,
  total,
  page,
  limit,
  initialQ,
  detailBase = DEFAULT_DETAIL,
  description = 'Táblás anyag árlekérdezés — bruttó nm és egész tábla ár.'
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
  const canOpenDetail = Boolean(detailBase)

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

  function openDetail(id: string) {
    if (!detailBase) return
    router.push(`${detailBase}/${id}`)
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
          placeholder="Anyag név, gyártó vagy gépkód…"
          className="pl-8"
          autoComplete="off"
        />
      </form>

      {!hasQuery ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Kezdj el gépelni az anyag nevére, gyártóra vagy gépkódra.
        </p>
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Nincs találat: „{initialQ}”
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Gyártó</DataTableHeaderCell>
                <DataTableHeaderCell>Megnevezés</DataTableHeaderCell>
                <DataTableHeaderCell>Méret</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Nm ár
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Egész ár
                </DataTableHeaderCell>
                <DataTableHeaderCell>Beszerzés</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => (
                <DataTableRow
                  key={row.id}
                  className={cn(
                    canOpenDetail && 'cursor-pointer hover:bg-subtle'
                  )}
                  onClick={
                    canOpenDetail ? () => openDetail(row.id) : undefined
                  }
                >
                  <DataTableCell className="text-ink">
                    {row.manufacturer_name}
                  </DataTableCell>
                  <DataTableCell>
                    {canOpenDetail && detailBase ? (
                      <Link
                        href={`${detailBase}/${row.id}`}
                        className="font-medium text-ink no-underline hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{row.name}</span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="tabular-nums text-ink">
                    {formatSheetSizeLabel(
                      row.length_mm,
                      row.width_mm,
                      row.thickness_mm
                    )}{' '}
                    <span className="text-hint text-ink-secondary">mm</span>
                  </DataTableCell>
                  <DataTableCell className="text-right tabular-nums font-medium text-ink">
                    {formatSearchPrice(row.price_gross_sqm)}
                  </DataTableCell>
                  <DataTableCell className="text-right tabular-nums font-medium text-ink">
                    {formatSearchPrice(row.price_gross_sheet)}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={row.on_stock ? 'success' : 'neutral'}
                    >
                      {row.on_stock ? 'Raktári' : 'Rendelős'}
                    </StatusBadge>
                  </DataTableCell>
                </DataTableRow>
              ))}
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
