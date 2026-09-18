'use client'

import Link from 'next/link'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { PosShiftDetail } from '@/lib/pos/shifts'

type Props = {
  detail: PosShiftDetail
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

function DiffBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-muted">—</span>
  const tone =
    value === 0 ? 'success' : value < 0 ? 'danger' : ('warning' as const)
  return (
    <StatusBadge tone={tone} variant="solid">
      {value === 0
        ? 'OK'
        : `${value > 0 ? '+' : ''}${formatMoneyFt(value)} Ft`}
    </StatusBadge>
  )
}

export function PosShiftDetailClient({ detail }: Props) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={`${detail.register_name} · ${formatDateTime(detail.opened_at)}`}
        description={`${detail.warehouse_name} · belsős elszámolás`}
        actions={
          <StatusBadge
            tone={detail.status === 'open' ? 'active' : 'neutral'}
            variant="soft"
          >
            {detail.status === 'open' ? 'Nyitott' : 'Zárt'}
          </StatusBadge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border p-3">
          <p className="text-[12px] font-medium text-ink-secondary">Nyitó</p>
          <p className="mt-1 text-body font-semibold tabular-nums">
            {formatMoneyFt(detail.opening_cash)} Ft
          </p>
          <p className="mt-1 text-hint text-ink-secondary">
            {detail.opened_by_label ?? '—'}
          </p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-[12px] font-medium text-ink-secondary">Forgalom</p>
          <p className="mt-1 text-body font-semibold tabular-nums">
            {formatMoneyFt(detail.sales_gross_sum)} Ft
          </p>
          <p className="mt-1 text-hint text-ink-secondary">
            {detail.sales_count} eladás
            {detail.returns_count > 0
              ? ` · ${detail.returns_count} visszáru`
              : ''}
          </p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-[12px] font-medium text-ink-secondary">
            KP elvárt / számolt
          </p>
          <p className="mt-1 text-body tabular-nums">
            {detail.expected_cash == null
              ? '—'
              : `${formatMoneyFt(detail.expected_cash)} Ft`}
            {' / '}
            {detail.counted_cash == null
              ? '—'
              : `${formatMoneyFt(detail.counted_cash)} Ft`}
          </p>
          <div className="mt-1.5">
            <DiffBadge value={detail.cash_difference} />
          </div>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-[12px] font-medium text-ink-secondary">
            Kártya elvárt / számolt
          </p>
          <p className="mt-1 text-body tabular-nums">
            {detail.expected_card == null
              ? '—'
              : `${formatMoneyFt(detail.expected_card)} Ft`}
            {' / '}
            {detail.counted_card == null
              ? '—'
              : `${formatMoneyFt(detail.counted_card)} Ft`}
          </p>
          <div className="mt-1.5">
            <DiffBadge value={detail.card_difference} />
          </div>
        </div>
      </div>

      {detail.closed_at ? (
        <p className="text-body text-ink-secondary">
          Zárta: {detail.closed_by_label ?? '—'} ·{' '}
          {formatDateTime(detail.closed_at)}
        </p>
      ) : null}

      {detail.note ? (
        <div className="rounded-md border border-warning/35 bg-warning-soft px-3 py-2.5 text-body text-warning-ink">
          <span className="font-medium">Megjegyzés: </span>
          {detail.note}
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-ink">
          KP mozgások
        </h2>
        {detail.cash_moves.length === 0 ? (
          <p className="text-body text-ink-secondary">Nincs feladás / betét.</p>
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Idő</DataTableHeaderCell>
                <DataTableHeaderCell>Típus</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Összeg</DataTableHeaderCell>
                <DataTableHeaderCell>Megjegyzés</DataTableHeaderCell>
                <DataTableHeaderCell>Ki</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {detail.cash_moves.map((m) => (
                <DataTableRow key={m.id}>
                  <DataTableCell className="tabular-nums text-ink-secondary">
                    {formatDateTime(m.created_at)}
                  </DataTableCell>
                  <DataTableCell>
                    {m.kind === 'out' ? 'Feladás' : 'Betét'}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {m.kind === 'out' ? '−' : '+'}
                    {formatMoneyFt(m.amount)} Ft
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {m.note}
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {m.created_by_label ?? '—'}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </div>

      <p className="text-hint text-ink-secondary">
        Eladások ehhez a műszakhoz:{' '}
        <Link
          href={`/ertekesitesek?shift=${detail.id}`}
          className="font-medium underline-offset-2 hover:underline"
        >
          Értékesítések listája
        </Link>
      </p>
    </div>
  )
}
