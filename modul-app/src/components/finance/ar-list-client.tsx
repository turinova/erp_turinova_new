'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { RegisterPaymentDialog } from '@/components/finance/register-payment-dialog'
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
import type { AgingBucket, ArRow } from '@/lib/finance/queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

const BUCKET_LABEL: Record<AgingBucket, string> = {
  current: 'Nem lejárt',
  d1_30: '1–30 nap',
  d31_60: '31–60 nap',
  d61_90: '61–90 nap',
  d90p: '90+ nap'
}

type Props = {
  rows: ArRow[]
  canWrite: boolean
}

export function ArListClient({ rows, canWrite }: Props) {
  const [bucket, setBucket] = useState<AgingBucket | 'all'>('all')
  const [payRow, setPayRow] = useState<ArRow | null>(null)

  const filtered = useMemo(
    () => (bucket === 'all' ? rows : rows.filter((r) => r.bucket === bucket)),
    [rows, bucket]
  )

  const total = filtered.reduce((s, r) => s + r.open_amount, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kintlévőség"
        description="Nyitott számlák és előlegek aging szerint. Fizetés rögzítése frissíti az ERP-t és a Számlázz.hu-t."
      />

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', 'Mind'],
            ['current', 'Nem lejárt'],
            ['d1_30', '1–30'],
            ['d31_60', '31–60'],
            ['d61_90', '61–90'],
            ['d90p', '90+']
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setBucket(value)}
            className={cn(
              'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
              bucket === value
                ? 'bg-ink text-surface'
                : 'bg-subtle text-ink-secondary hover:bg-border/60'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-body text-ink-secondary" role="status">
        Összesen{' '}
        <span className="font-semibold tabular-nums text-ink">
          {formatMoneyFt(total)} Ft
        </span>{' '}
        · {filtered.length} tétel
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-body text-ink-secondary">
          Nincs nyitott kintlévőség ebben a szűrésben.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Számla</DataTableHeaderCell>
              <DataTableHeaderCell>Vevő</DataTableHeaderCell>
              <DataTableHeaderCell>Határidő</DataTableHeaderCell>
              <DataTableHeaderCell>Aging</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Nyitott</DataTableHeaderCell>
              <DataTableHeaderCell className="w-[7rem]">
                <span className="sr-only">Művelet</span>
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((row) => {
              const label =
                row.provider_invoice_number || row.internal_number
              return (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <Link
                      href={`/szamlak?q=${encodeURIComponent(label)}`}
                      className="font-medium tabular-nums text-ink underline-offset-2 hover:underline"
                    >
                      {label}
                    </Link>
                    {row.related_source_number ? (
                      <span className="mt-0.5 block text-hint text-ink-muted">
                        {row.related_source_number}
                      </span>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.customer_name || '—'}
                  </DataTableCell>
                  <DataTableCell
                    className={cn(
                      'tabular-nums',
                      row.bucket !== 'current' && 'text-danger-ink'
                    )}
                  >
                    {row.payment_due_date || '—'}
                  </DataTableCell>
                  <DataTableCell className="text-hint text-ink-muted">
                    {BUCKET_LABEL[row.bucket]}
                    {row.days_overdue > 0 ? ` · ${row.days_overdue} nap` : ''}
                  </DataTableCell>
                  <DataTableCell
                    align="right"
                    className="font-medium tabular-nums"
                  >
                    {formatMoneyFt(row.open_amount)}
                  </DataTableCell>
                  <DataTableCell>
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPayRow(row)}
                      >
                        Fizetés
                      </Button>
                    ) : null}
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      {payRow ? (
        <RegisterPaymentDialog
          invoiceId={payRow.id}
          openAmount={payRow.open_amount}
          customerName={payRow.customer_name}
          invoiceLabel={
            payRow.provider_invoice_number || payRow.internal_number
          }
          onClose={() => setPayRow(null)}
        />
      ) : null}
    </div>
  )
}
