'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeftRight, Plus, Search } from 'lucide-react'

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
  TRANSFER_STATUS_LABEL,
  transferStatusTone,
  type StockTransferStatus
} from '@/lib/stock-transfers/parse'
import type { StockTransferListItem } from '@/lib/stock-transfers/queries'

type StockTransfersListClientProps = {
  initialRows: StockTransferListItem[]
  total: number
  page: number
  limit: number
  q: string
  canWrite: boolean
  warehouseCount: number
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

export function StockTransfersListClient({
  initialRows,
  total,
  page,
  limit,
  q: initialQ,
  canWrite,
  warehouseCount
}: StockTransfersListClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQ)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const canCreate = canWrite && warehouseCount >= 2

  function pushParams(next: { q?: string; page?: number }) {
    const params = new URLSearchParams()
    const q = next.q ?? search
    const p = next.page ?? 1
    if (q.trim()) params.set('q', q.trim())
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    router.push(qs ? `/keszlet/atadasok?${qs}` : '/keszlet/atadasok')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Áttárolások"
        description="Készlet mozgatása raktárak között."
        actions={
          canCreate ? (
            <Button type="button" onClick={() => router.push('/keszlet/atadasok/uj')}>
              <Plus className="size-3.5" aria-hidden />
              Új áttárolás
            </Button>
          ) : null
        }
      />

      {warehouseCount < 2 ? (
        <p
          className="rounded-md border border-warning/35 bg-warning-soft px-3 py-2.5 text-body text-warning-ink"
          role="status"
        >
          Áttároláshoz legalább két aktív raktár kell.{' '}
          <Link
            href="/torzsadatok/rendszer/raktarak"
            className="font-medium underline-offset-2 hover:underline"
          >
            Raktárak kezelése
          </Link>
        </p>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          pushParams({ q: search, page: 1 })
        }}
      >
        <div className="relative min-w-[14rem] flex-1">
          <label className="sr-only" htmlFor="transfer-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="transfer-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szám…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Keresés
        </Button>
      </form>

      {initialRows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <ArrowLeftRight className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">Még nincs áttárolás</p>
            <p className="mt-1 text-body text-ink-secondary">
              Ha átmozgatod a készletet egyik raktárból a másikba, itt jelenik meg.
            </p>
          </div>
          {canCreate ? (
            <Button
              type="button"
              onClick={() => router.push('/keszlet/atadasok/uj')}
            >
              Új áttárolás
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Honnan</DataTableHeaderCell>
              <DataTableHeaderCell>Hová</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Tételek</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => (
              <DataTableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(`/keszlet/atadasok/${row.id}`)}
              >
                <DataTableCell>
                  <Link
                    href={`/keszlet/atadasok/${row.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.transfer_number}
                  </Link>
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.from_warehouse_name}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.to_warehouse_name}
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="tabular-nums">{row.items_count}</span>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {formatDate(row.completed_at ?? row.created_at)}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    tone={transferStatusTone(row.status as StockTransferStatus)}
                  >
                    {TRANSFER_STATUS_LABEL[row.status as StockTransferStatus] ??
                      row.status}
                  </StatusBadge>
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
