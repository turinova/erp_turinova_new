import Link from 'next/link'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { StatusBadge } from '@/components/patterns/status-badge'
import type { HomePartnerPortalInboxRow } from '@/lib/home/partner-portal-inbox'
import { formatMoneyFt } from '@/lib/sales/parse'

function formatSubmittedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat('hu-HU', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Budapest'
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

export function PartnerPortalInboxCard({
  rows
}: {
  rows: HomePartnerPortalInboxRow[]
}) {
  if (rows.length === 0) return null

  return (
    <section className="mb-5 rounded-md border border-warning/40 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-body font-semibold text-ink">
            Új partner rendelések
          </h2>
          <StatusBadge tone="warning">{rows.length}</StatusBadge>
        </div>
        <Link
          href="/ajanlatok"
          className="text-hint text-ink-secondary no-underline hover:underline"
        >
          Ajánlatok →
        </Link>
      </div>

      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>Partner</DataTableHeaderCell>
            <DataTableHeaderCell>Ajánlat</DataTableHeaderCell>
            <DataTableHeaderCell>Fizetési mód</DataTableHeaderCell>
            <DataTableHeaderCell className="text-right">
              Összeg
            </DataTableHeaderCell>
            <DataTableHeaderCell>Beérkezett</DataTableHeaderCell>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {rows.map((row) => (
            <DataTableRow key={row.id} className="hover:bg-subtle">
              <DataTableCell>
                <Link
                  href={`/ajanlatok/${row.id}`}
                  className="font-medium text-ink no-underline hover:underline"
                >
                  {row.partnerName}
                </Link>
              </DataTableCell>
              <DataTableCell>
                <Link
                  href={`/ajanlatok/${row.id}`}
                  className="text-ink no-underline hover:underline"
                >
                  {row.quoteNumber}
                </Link>
              </DataTableCell>
              <DataTableCell>
                <p className="text-ink">
                  {row.paymentMethodName?.trim() || '—'}
                </p>
                {row.paymentMethodComment ? (
                  <p className="mt-0.5 line-clamp-2 text-hint text-ink-secondary">
                    {row.paymentMethodComment}
                  </p>
                ) : null}
              </DataTableCell>
              <DataTableCell className="text-right tabular-nums font-medium text-ink">
                {formatMoneyFt(row.totalGross)} Ft
              </DataTableCell>
              <DataTableCell className="tabular-nums text-ink-secondary">
                {formatSubmittedAt(row.submittedAt)}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </section>
  )
}
