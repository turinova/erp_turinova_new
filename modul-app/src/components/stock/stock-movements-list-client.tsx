'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import type { StockMovementListItem } from '@/lib/stock/movements-queries'
import type { StockMovementSource, StockMovementType } from '@/lib/supabase/database.types'
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

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('hu-HU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Minden forrás' },
  { value: 'purchase_receipt', label: 'Beérkezés' },
  { value: 'transfer', label: 'Áttárolás' },
  { value: 'adjustment', label: 'Korrekció' },
  { value: 'sale', label: 'Eladás' }
]

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Be és ki' },
  { value: 'in', label: 'Be (növekedés)' },
  { value: 'out', label: 'Ki (csökkenés)' }
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
        <div className="relative min-w-[12rem] flex-1">
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
        <div className="w-[10rem]">
          <MenuSelect
            value={movementType}
            onChange={(v) => pushParams({ movementType: v, page: 1 })}
            allowEmpty={false}
            options={TYPE_OPTIONS}
            placeholder="Irány"
          />
        </div>
        <div className="w-[10rem]">
          <MenuSelect
            value={sourceType}
            onChange={(v) => pushParams({ sourceType: v, page: 1 })}
            allowEmpty={false}
            options={SOURCE_OPTIONS}
            placeholder="Forrás"
          />
        </div>
        <Button type="submit" variant="secondary">
          Keresés
        </Button>
      </form>

      {initialRows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-body text-ink-secondary">
          Nincs mozgás a szűrőkkel.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Idő</DataTableHeaderCell>
              <DataTableHeaderCell>Termék</DataTableHeaderCell>
              <DataTableHeaderCell>Raktár</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Mennyiség</DataTableHeaderCell>
              <DataTableHeaderCell>Forrás</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => (
              <DataTableRow
                key={row.id}
                className={
                  row.movement_type === 'in'
                    ? 'bg-success-soft/35'
                    : 'bg-surface'
                }
              >
                <DataTableCell>
                  <div className="tabular-nums text-body text-ink-secondary">
                    {formatDateTime(row.created_at)}
                  </div>
                  <div className="text-hint text-ink-muted">
                    {row.stock_movement_number}
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <Link
                    href={`/torzsadatok/alapanyagok/termekek/${row.accessory_id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
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
                      'text-[15px] font-semibold tabular-nums',
                      row.movement_type === 'in'
                        ? 'text-success-ink'
                        : 'text-ink-secondary'
                    )}
                  >
                    {row.movement_type === 'in' ? '+' : '−'}
                    {formatQty(row.quantity)} {row.unit_shortform}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  {row.source_href && row.source_label ? (
                    <Link
                      href={row.source_href}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {row.source_label}
                    </Link>
                  ) : (
                    <span className="text-ink-secondary">
                      {row.source_label ?? row.source_type}
                    </span>
                  )}
                </DataTableCell>
              </DataTableRow>
            ))}
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
