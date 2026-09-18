'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FileText, History, Plus, ScanBarcode, Search, ShoppingCart } from 'lucide-react'

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
  formatMoneyFt,
  SALE_CHANNEL_LABEL,
  SALE_PAYMENT_STATUS_LABEL,
  SALE_STATUS_LABEL,
  salePaymentTone,
  saleStatusTone,
  type SalePaymentStatus,
  type SaleStatus
} from '@/lib/sales/parse'
import type { SaleListItem } from '@/lib/sales/queries'
import { cn } from '@/lib/utils'

type Props = {
  initialRows: SaleListItem[]
  total: number
  page: number
  limit: number
  q: string
  status: SaleStatus | 'all'
  shiftId?: string
  canWrite: boolean
  canPos?: boolean
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

const STATUS_FILTERS: { value: SaleStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'fulfilled', label: 'Teljesítve' },
  { value: 'partially_returned', label: 'Részben visszáru' },
  { value: 'returned', label: 'Visszáru' }
]

export function SalesListClient({
  initialRows,
  total,
  page,
  limit,
  q: initialQ,
  status: initialStatus,
  shiftId,
  canWrite,
  canPos = false
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQ)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function pushParams(next: {
    q?: string
    page?: number
    status?: SaleStatus | 'all'
    clearShift?: boolean
  }) {
    const params = new URLSearchParams()
    const q = next.q ?? search
    const p = next.page ?? 1
    const status = next.status ?? initialStatus
    if (q.trim()) params.set('q', q.trim())
    if (status && status !== 'all') params.set('status', status)
    if (shiftId && !next.clearShift) params.set('shift', shiftId)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    router.push(qs ? `/ertekesitesek?${qs}` : '/ertekesitesek')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Értékesítések"
        description="Termék eladás — pult, iroda vagy később webshop."
        actions={
          <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/ertekesitesek/arajanlatok')}
              >
                <FileText className="size-3.5" aria-hidden />
                Árajánlatok
              </Button>
            {canPos ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/ertekesitesek/muszakok')}
              >
                <History className="size-3.5" aria-hidden />
                Műszakok
              </Button>
            ) : null}
            {canWrite ? (
              <>
                {canPos ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push('/pos')}
                  >
                    <ScanBarcode className="size-3.5" aria-hidden />
                    POS
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => router.push('/ertekesitesek/uj')}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Új értékesítés
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {shiftId ? (
        <p
          className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary"
          role="status"
        >
          Szűrve egy műszakra.{' '}
          <button
            type="button"
            className="font-medium text-ink underline-offset-2 hover:underline"
            onClick={() => pushParams({ clearShift: true, page: 1 })}
          >
            Szűrő törlése
          </button>
          {' · '}
          <Link
            href={`/ertekesitesek/muszakok/${shiftId}`}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            Műszak megnyitása
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
          <label className="sr-only" htmlFor="sales-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="sales-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szám / ügyfél…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Keresés
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const active = initialStatus === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => pushParams({ status: f.value, page: 1 })}
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
          <ShoppingCart className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">Még nincs értékesítés</p>
            <p className="mt-1 text-body text-ink-secondary">
              Rögzíts egy eladást — a készlet automatikusan csökken.
            </p>
          </div>
          {canWrite ? (
            <Button
              type="button"
              onClick={() => router.push('/ertekesitesek/uj')}
            >
              Új értékesítés
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Szám</DataTableHeaderCell>
              <DataTableHeaderCell>Ügyfél</DataTableHeaderCell>
              <DataTableHeaderCell>Eladó</DataTableHeaderCell>
              <DataTableHeaderCell>Csatorna</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Bruttó (Ft)</DataTableHeaderCell>
              <DataTableHeaderCell>Fizetés</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => (
              <DataTableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(`/ertekesitesek/${row.id}`)}
              >
                <DataTableCell>
                  <Link
                    href={`/ertekesitesek/${row.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.sale_number}
                  </Link>
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.customer_name ?? 'Vendég'}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.created_by_label ?? '—'}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {SALE_CHANNEL_LABEL[row.channel] ?? row.channel}
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="font-semibold tabular-nums">
                    {formatMoneyFt(row.total_gross)} Ft
                  </span>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    tone={salePaymentTone(
                      row.payment_status as SalePaymentStatus
                    )}
                    variant="solid"
                  >
                    {SALE_PAYMENT_STATUS_LABEL[
                      row.payment_status as SalePaymentStatus
                    ] ?? row.payment_status}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    tone={saleStatusTone(row.status as SaleStatus)}
                    variant="soft"
                  >
                    {SALE_STATUS_LABEL[row.status as SaleStatus] ?? row.status}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {formatDate(row.fulfilled_at ?? row.created_at)}
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
              disabled={page <= 1}
              onClick={() => pushParams({ page: page - 1 })}
            >
              Előző
            </Button>
            <Button
              type="button"
              variant="secondary"
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
