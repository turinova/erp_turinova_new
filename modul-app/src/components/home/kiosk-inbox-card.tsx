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
import type { HomeKioskInboxRow } from '@/lib/home/kiosk-inbox'
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

export function KioskInboxCard({
  rows,
  total
}: {
  rows: HomeKioskInboxRow[]
  total: number
}) {
  if (rows.length === 0) return null

  return (
    <section className="mb-5 rounded-md border border-info/40 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-body font-semibold text-ink">
            Kioskról érkezett
          </h2>
          <StatusBadge tone="info">{total}</StatusBadge>
        </div>
        <Link
          href="/ajanlatok?forras=kiosk"
          className="text-hint text-ink-secondary no-underline hover:underline"
        >
          Összes kiosk ajánlat →
        </Link>
      </div>

      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>Vevő</DataTableHeaderCell>
            <DataTableHeaderCell>Telefon vége</DataTableHeaderCell>
            <DataTableHeaderCell>Ajánlat</DataTableHeaderCell>
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/ajanlatok/${row.id}`}
                    className="font-medium text-ink no-underline hover:underline"
                  >
                    {row.guestName}
                  </Link>
                  {row.needsCheck ? (
                    <StatusBadge tone="warning">Ügyfél ellenőrzés</StatusBadge>
                  ) : null}
                </div>
              </DataTableCell>
              <DataTableCell className="tabular-nums text-ink">
                {row.phoneLast4 ? `…${row.phoneLast4}` : ''}
              </DataTableCell>
              <DataTableCell>
                <Link
                  href={`/ajanlatok/${row.id}`}
                  className="text-ink no-underline hover:underline"
                >
                  {row.quoteNumber}
                </Link>
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
