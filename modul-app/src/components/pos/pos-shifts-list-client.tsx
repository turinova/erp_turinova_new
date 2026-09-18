'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { History } from 'lucide-react'

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
import { formatMoneyFt } from '@/lib/sales/parse'
import type { PosShiftListItem } from '@/lib/pos/shifts'
import { cn } from '@/lib/utils'

type Props = {
  initialRows: PosShiftListItem[]
  total: number
  page: number
  limit: number
  status: 'open' | 'closed' | 'all'
  diffOnly: boolean
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

const STATUS_FILTERS: { value: 'all' | 'open' | 'closed'; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'open', label: 'Nyitott' },
  { value: 'closed', label: 'Zárt' }
]

export function PosShiftsListClient({
  initialRows,
  total,
  page,
  limit,
  status: initialStatus,
  diffOnly: initialDiffOnly
}: Props) {
  const router = useRouter()
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function pushParams(next: {
    page?: number
    status?: 'open' | 'closed' | 'all'
    diffOnly?: boolean
  }) {
    const params = new URLSearchParams()
    const status = next.status ?? initialStatus
    const diffOnly = next.diffOnly ?? initialDiffOnly
    const p = next.page ?? 1
    if (status && status !== 'all') params.set('status', status)
    if (diffOnly) params.set('diff', '1')
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    router.push(qs ? `/ertekesitesek/muszakok?${qs}` : '/ertekesitesek/muszakok')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Műszakok"
        description="Belsős elszámolás — ki nyitotta, kassza, KP eltérés."
      />

      <div className="flex flex-wrap items-center gap-1.5">
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
        <button
          type="button"
          onClick={() =>
            pushParams({ diffOnly: !initialDiffOnly, page: 1 })
          }
          className={cn(
            'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
            initialDiffOnly
              ? 'bg-warning text-white'
              : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
          )}
        >
          Csak eltérés
        </button>
      </div>

      {initialRows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-8">
          <History className="size-5 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body font-medium text-ink">Még nincs műszak</p>
            <p className="mt-1 text-body text-ink-secondary">
              A POS-ban nyiss műszakot — itt jelenik meg az elszámolás.
            </p>
          </div>
          <Button type="button" onClick={() => router.push('/pos')}>
            POS megnyitása
          </Button>
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Nyitás</DataTableHeaderCell>
              <DataTableHeaderCell>Pénztár</DataTableHeaderCell>
              <DataTableHeaderCell>Nyitó</DataTableHeaderCell>
              <DataTableHeaderCell>Forgalom</DataTableHeaderCell>
              <DataTableHeaderCell>Eltérés</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => {
              const diff = row.cash_difference
              const diffTone =
                diff == null
                  ? 'neutral'
                  : diff === 0
                    ? 'success'
                    : diff < 0
                      ? 'danger'
                      : 'warning'
              return (
                <DataTableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/ertekesitesek/muszakok/${row.id}`)
                  }
                >
                  <DataTableCell>
                    <Link
                      href={`/ertekesitesek/muszakok/${row.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {formatDateTime(row.opened_at)}
                    </Link>
                    <p className="text-hint text-ink-secondary">
                      {row.opened_by_label ?? '—'}
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-ink">{row.register_name}</span>
                    <p className="text-hint text-ink-secondary">
                      {row.warehouse_name}
                    </p>
                  </DataTableCell>
                  <DataTableCell className="tabular-nums">
                    {formatMoneyFt(row.opening_cash)} Ft
                  </DataTableCell>
                  <DataTableCell className="tabular-nums font-medium">
                    {formatMoneyFt(row.sales_gross_sum)} Ft
                  </DataTableCell>
                  <DataTableCell>
                    {diff == null ? (
                      <span className="text-ink-muted">—</span>
                    ) : (
                      <StatusBadge tone={diffTone} variant="solid">
                        {diff === 0
                          ? 'OK'
                          : `${diff > 0 ? '+' : ''}${formatMoneyFt(diff)} Ft`}
                      </StatusBadge>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={row.status === 'open' ? 'active' : 'neutral'}
                      variant="soft"
                    >
                      {row.status === 'open' ? 'Nyitott' : 'Zárt'}
                    </StatusBadge>
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-hint text-ink-secondary">
            {total} műszak · {page}/{totalPages}
          </p>
          <div className="flex gap-1.5">
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
