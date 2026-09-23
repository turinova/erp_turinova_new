'use client'

import { useRouter } from 'next/navigation'
import { Banknote } from 'lucide-react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { PosShiftDetail } from '@/lib/pos/shifts'
import { cn } from '@/lib/utils'

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

function moneyOrDash(n: number | null) {
  return n == null ? '—' : `${formatMoneyFt(n)} Ft`
}

export function PosShiftDetailClient({ detail }: Props) {
  const router = useRouter()
  const hasCashDiff =
    detail.cash_difference != null && detail.cash_difference !== 0

  const descParts = [
    detail.warehouse_name,
    'belsős elszámolás',
    detail.opened_by_label
      ? `Nyitotta: ${detail.opened_by_label}`
      : null,
    detail.closed_at
      ? `Zárta: ${detail.closed_by_label ?? '—'} · ${formatDateTime(detail.closed_at)}`
      : null
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${detail.register_name} · ${formatDateTime(detail.opened_at)}`}
        description={descParts.join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={detail.status === 'open' ? 'active' : 'neutral'}
              variant="soft"
            >
              {detail.status === 'open' ? 'Nyitott' : 'Zárt'}
            </StatusBadge>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                router.push(`/ertekesitesek?shift=${detail.id}`)
              }
            >
              Eladások megnyitása
            </Button>
            {detail.status === 'open' ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/pos')}
              >
                POS megnyitása
              </Button>
            ) : null}
          </div>
        }
      />

      <FormSection
        title="Összesítés"
        description={`${detail.sales_count} eladás${
          detail.returns_count > 0
            ? ` · ${detail.returns_count} visszáru`
            : ''
        }`}
        columns={4}
      >
        <FormField
          label="Nyitó"
          htmlFor="shift-opening"
          hint={detail.opened_by_label ?? undefined}
        >
          <p
            id="shift-opening"
            className="text-body font-semibold tabular-nums text-ink"
          >
            {formatMoneyFt(detail.opening_cash)} Ft
          </p>
        </FormField>
        <FormField label="Forgalom" htmlFor="shift-sales">
          <p
            id="shift-sales"
            className="text-body font-semibold tabular-nums text-ink"
          >
            {formatMoneyFt(detail.sales_gross_sum)} Ft
          </p>
        </FormField>
        <FormField label="KP elvárt / számolt" htmlFor="shift-cash">
          <p id="shift-cash" className="text-body tabular-nums text-ink">
            {moneyOrDash(detail.expected_cash)} /{' '}
            {moneyOrDash(detail.counted_cash)}
          </p>
          <div className="mt-1.5">
            <DiffBadge value={detail.cash_difference} />
          </div>
        </FormField>
        <FormField label="Kártya elvárt / számolt" htmlFor="shift-card">
          <p id="shift-card" className="text-body tabular-nums text-ink">
            {moneyOrDash(detail.expected_card)} /{' '}
            {moneyOrDash(detail.counted_card)}
          </p>
          <div className="mt-1.5">
            <DiffBadge value={detail.card_difference} />
          </div>
        </FormField>
      </FormSection>

      {detail.note ? (
        <div
          className={cn(
            'rounded-md border px-3 py-2.5 text-body',
            hasCashDiff
              ? 'border-warning/35 bg-warning-soft text-warning-ink'
              : 'border-border bg-surface text-ink-secondary'
          )}
        >
          <span className="font-medium text-ink">Megjegyzés: </span>
          {detail.note}
        </div>
      ) : null}

      <section className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-2.5 space-y-0.5">
          <h2 className="text-h3 text-ink">KP mozgások</h2>
          <p className="text-hint text-ink-secondary">
            Feladás és betét a műszak alatt.
          </p>
        </div>
        {detail.cash_moves.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border bg-subtle px-3 py-6">
            <Banknote className="size-4 text-ink-muted" aria-hidden />
            <p className="text-body text-ink-secondary">
              Nincs feladás / betét.
            </p>
          </div>
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
      </section>
    </div>
  )
}
