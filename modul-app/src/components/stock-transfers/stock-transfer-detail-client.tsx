'use client'

import Link from 'next/link'

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
import {
  TRANSFER_STATUS_LABEL,
  transferStatusTone,
  type StockTransferStatus
} from '@/lib/stock-transfers/parse'
import type { StockTransferDetail } from '@/lib/stock-transfers/queries'

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('hu-HU')
  } catch {
    return '—'
  }
}

type Props = {
  detail: StockTransferDetail
}

export function StockTransferDetailClient({ detail }: Props) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={detail.transfer_number}
        description={`${detail.from_warehouse_name} → ${detail.to_warehouse_name}`}
        actions={
          <StatusBadge
            tone={transferStatusTone(detail.status as StockTransferStatus)}
          >
            {TRANSFER_STATUS_LABEL[detail.status as StockTransferStatus] ??
              detail.status}
          </StatusBadge>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
          <dt className="text-[12px] font-medium text-ink-secondary">Honnan</dt>
          <dd className="mt-0.5 text-body font-medium text-ink">
            {detail.from_warehouse_name}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
          <dt className="text-[12px] font-medium text-ink-secondary">Hová</dt>
          <dd className="mt-0.5 text-body font-medium text-ink">
            {detail.to_warehouse_name}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
          <dt className="text-[12px] font-medium text-ink-secondary">Rögzítve</dt>
          <dd className="mt-0.5 text-body tabular-nums text-ink">
            {formatDateTime(detail.completed_at ?? detail.created_at)}
          </dd>
        </div>
      </dl>

      {detail.note ? (
        <p className="rounded-md border border-border bg-subtle px-3 py-2.5 text-body text-ink-secondary">
          {detail.note}
        </p>
      ) : null}

      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>Termék</DataTableHeaderCell>
            <DataTableHeaderCell>SKU</DataTableHeaderCell>
            <DataTableHeaderCell align="right">Mennyiség</DataTableHeaderCell>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {detail.items.map((it) => (
            <DataTableRow key={it.id}>
              <DataTableCell>
                <Link
                  href={`/torzsadatok/alapanyagok/termekek/${it.accessory_id}`}
                  className="font-medium text-ink underline-offset-2 hover:underline"
                >
                  {it.name_snapshot}
                </Link>
              </DataTableCell>
              <DataTableCell className="tabular-nums text-ink-secondary">
                {it.sku_snapshot}
              </DataTableCell>
              <DataTableCell align="right">
                <span className="font-semibold tabular-nums">
                  {formatQty(it.quantity)} {it.unit_shortform}
                </span>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>

      <p className="text-hint text-ink-secondary">
        <Link
          href={`/keszlet/mozgasok?sourceType=transfer`}
          className="underline-offset-2 hover:underline"
        >
          Kapcsolódó mozgások
        </Link>
      </p>
    </div>
  )
}
