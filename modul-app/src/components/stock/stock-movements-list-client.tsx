'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowDownUp, Search } from 'lucide-react'

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
import { MenuSelect } from '@/components/ui/menu-select'
import type { StockMovementListItem } from '@/lib/stock/movements-queries'
import {
  MOVEMENT_SOURCE_LABEL,
  MOVEMENT_TYPE_LABEL,
  movementSourceTone,
  movementTypeTone
} from '@/lib/stock/parse'
import type {
  StockMovementSource,
  StockMovementType
} from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'

type WarehouseOption = { id: string; name: string; code: string }

type Props = {
  initialRows: StockMovementListItem[]
  total: number
  page: number
  limit: number
  q: string
  warehouseId: string
  movementType: StockMovementType | 'all'
  sourceType: StockMovementSource | 'all'
  warehouses: WarehouseOption[]
}

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

const TYPE_FILTERS: { value: StockMovementType | 'all'; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'in', label: 'Be' },
  { value: 'out', label: 'Ki' }
]

const SOURCE_FILTERS: {
  value: StockMovementSource | 'all'
  label: string
}[] = [
  { value: 'all', label: 'Minden forrás' },
  { value: 'purchase_receipt', label: 'Beérkezés' },
  { value: 'sale', label: 'Eladás' },
  { value: 'sale_return', label: 'Visszáru' },
  { value: 'transfer', label: 'Áttárolás' },
  { value: 'adjustment', label: 'Korrekció' }
]

export function StockMovementsListClient({
  initialRows,
  total,
  page,
  limit,
  q: initialQ,
  warehouseId,
  movementType,
  sourceType,
  warehouses
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQ)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function pushParams(next: {
    q?: string
    warehouseId?: string
    movementType?: string
    sourceType?: string
    page?: number
  }) {
    const params = new URLSearchParams()
    const q = next.q ?? search
    const wh = next.warehouseId ?? warehouseId
    const mt = next.movementType ?? movementType
    const st = next.sourceType ?? sourceType
    const p = next.page ?? 1
    if (q.trim()) params.set('q', q.trim())
    if (wh && wh !== 'all') params.set('warehouseId', wh)
    if (mt && mt !== 'all') params.set('movementType', mt)
    if (st && st !== 'all') params.set('sourceType', st)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    router.push(qs ? `/keszlet/mozgasok?${qs}` : '/keszlet/mozgasok')
  }

  const warehouseOptions = [
    { value: 'all', label: 'Minden raktár' },
    ...warehouses.map((w) => ({
      value: w.id,
      label: w.name,
      hint: w.code
    }))
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Készletmozgások"
        description="Ledger — minden be- és kimenő változás."
      />

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          pushParams({ q: search, page: 1 })
        }}
      >
        <div className="relative min-w-[14rem] flex-1">
          <label className="sr-only" htmlFor="movements-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="movements-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szám / megjegyzés…"
            className="pl-8"
          />
        </div>
        <div className="w-[11rem]">
          <MenuSelect
            value={warehouseId || 'all'}
            onChange={(v) => pushParams({ warehouseId: v, page: 1 })}
            allowEmpty={false}
            options={warehouseOptions}
            placeholder="Raktár"
          />
        </div>
        <Button type="submit" variant="secondary">
          Keresés
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((f) => {
          const active = movementType === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => pushParams({ movementType: f.value, page: 1 })}
              className={cn(
                'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
                active
                  ? 'bg-ink text-surface'
                  : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SOURCE_FILTERS.map((f) => {
          const active = sourceType === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => pushParams({ sourceType: f.value, page: 1 })}
              className={cn(
                'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
                active
                  ? 'bg-ink text-surface'
                  : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {initialRows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <ArrowDownUp className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">Nincs mozgás</p>
            <p className="mt-1 text-body text-ink-secondary">
              Eladás, beérkezés vagy áttárolás után itt jelennek meg a
              készletváltozások.
            </p>
          </div>
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Termék</DataTableHeaderCell>
              <DataTableHeaderCell>Raktár</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Mennyiség</DataTableHeaderCell>
              <DataTableHeaderCell>Irány</DataTableHeaderCell>
              <DataTableHeaderCell>Forrás</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => {
              const isIn = row.movement_type === 'in'
              const productHref = `/torzsadatok/alapanyagok/termekek/${row.accessory_id}`
              return (
                <DataTableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => {
                    if (row.source_href) router.push(row.source_href)
                    else router.push(productHref)
                  }}
                >
                  <DataTableCell>
                    <Link
                      href={row.source_href ?? productHref}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.stock_movement_number}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={productHref}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.accessory_name}
                    </Link>
                    {row.accessory_sku ? (
                      <div className="text-hint text-ink-secondary">
                        {row.accessory_sku}
                      </div>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.warehouse_name}
                  </DataTableCell>
                  <DataTableCell align="right">
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        isIn ? 'text-success-ink' : 'text-danger-ink'
                      )}
                    >
                      {isIn ? '+' : '−'}
                      {formatQty(row.quantity)} {row.unit_shortform}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={movementTypeTone(row.movement_type)}>
                      {MOVEMENT_TYPE_LABEL[row.movement_type]}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={movementSourceTone(row.source_type)}>
                      {MOVEMENT_SOURCE_LABEL[row.source_type] ??
                        row.source_type}
                    </StatusBadge>
                    {row.source_label ? (
                      <div className="mt-0.5 text-hint text-ink-secondary">
                        {row.source_href ? (
                          <Link
                            href={row.source_href}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.source_label}
                          </Link>
                        ) : (
                          row.source_label
                        )}
                      </div>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="tabular-nums text-ink-secondary">
                    {formatDate(row.created_at)}
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-body text-ink-secondary">
          <span>
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => pushParams({ page: page - 1 })}
            >
              Előző
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => pushParams({ page: page + 1 })}
            >
              Következő
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
