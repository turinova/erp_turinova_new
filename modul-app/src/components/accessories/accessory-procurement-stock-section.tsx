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
import { FormSection } from '@/components/patterns/form-section'
import { StatusBadge } from '@/components/patterns/status-badge'
import {
  PO_STATUS_LABEL,
  poStatusTone,
  type PurchaseOrderStatus
} from '@/lib/purchase-orders/parse'
import type { AccessoryProcurementStock } from '@/lib/stock/accessory-panel'
import { cn } from '@/lib/utils'

function formatQty(n: number) {
  return new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 3
  }).format(n)
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('hu-HU', {
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return '—'
  }
}

type AccessoryProcurementStockSectionProps = {
  stock: AccessoryProcurementStock
  accessoryId: string
  unitShortform?: string
}

export function AccessoryProcurementStockSection({
  stock,
  accessoryId,
  unitShortform = 'db'
}: AccessoryProcurementStockSectionProps) {
  const u = unitShortform || 'db'
  const hasStock = Math.abs(stock.total_on_hand) > 0.0001
  const hasOnOrder = stock.on_order_qty > 0.0001
  const hasAny =
    stock.movements.length > 0 ||
    stock.related_orders.length > 0 ||
    hasStock ||
    hasOnOrder

  const movements = stock.movements.slice(0, 5)
  const preferredFrom =
    stock.by_warehouse.find((w) => w.on_hand > 0.0001)?.warehouse_id ??
    stock.by_warehouse[0]?.warehouse_id
  const transferHref = preferredFrom
    ? `/keszlet/atadasok/uj?accessoryId=${encodeURIComponent(accessoryId)}&fromWarehouseId=${encodeURIComponent(preferredFrom)}`
    : `/keszlet/atadasok/uj?accessoryId=${encodeURIComponent(accessoryId)}`

  return (
    <FormSection
      title="Készlet"
      description="Mennyi van most, és mi van úton."
      columns={2}
    >
      <div className="sm:col-span-2 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div
            className={cn(
              'rounded-md border px-3 py-3',
              hasStock
                ? 'border-success/35 bg-success-soft text-success-ink'
                : 'border-border bg-subtle text-ink-secondary'
            )}
            role="status"
          >
            <p className="text-[12px] font-medium opacity-80">Raktáron most</p>
            <p className="mt-0.5 text-[20px] font-semibold leading-tight tabular-nums tracking-tight">
              {formatQty(stock.total_on_hand)}{' '}
              <span className="text-[14px] font-semibold">{u}</span>
            </p>
            {!hasStock ? (
              <p className="mt-1 text-hint">Nincs raktáron</p>
            ) : null}
          </div>

          <div
            className={cn(
              'rounded-md border px-3 py-3',
              hasOnOrder
                ? 'border-info/35 bg-info-soft text-info-ink'
                : 'border-border bg-subtle text-ink-secondary'
            )}
            role="status"
          >
            <p className="text-[12px] font-medium opacity-80">Úton (rendelve)</p>
            <p className="mt-0.5 text-[20px] font-semibold leading-tight tabular-nums tracking-tight">
              {formatQty(stock.on_order_qty)}{' '}
              <span className="text-[14px] font-semibold">{u}</span>
            </p>
            {hasOnOrder ? (
              <p className="mt-1 text-hint opacity-90">
                {stock.open_po_count} nyitott rendelés
              </p>
            ) : (
              <p className="mt-1 text-hint">Nincs úton</p>
            )}
          </div>
        </div>

        {stock.by_warehouse.length > 0 ? (
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-medium text-ink-secondary">
                Hol van?
              </p>
              <Link
                href={transferHref}
                className="text-[12px] font-medium text-ink underline-offset-2 hover:underline"
              >
                Áttárolás
              </Link>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {stock.by_warehouse.map((w) => (
                <li
                  key={w.warehouse_id}
                  className="inline-flex items-baseline gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5"
                >
                  <span className="text-hint text-ink-secondary">
                    {w.warehouse_name}
                    {w.warehouse_code ? ` (${w.warehouse_code})` : ''}
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-ink">
                    {formatQty(w.on_hand)} {u}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!hasAny ? (
          <p className="rounded-md border border-border bg-subtle px-3 py-2.5 text-body text-ink-secondary">
            Még nincs belőle raktáron. Ha bevételezel, itt jelenik meg.
          </p>
        ) : null}

        {movements.length > 0 ? (
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[12px] font-medium text-ink-secondary">
                Utolsó mozgások
              </h3>
              <Link
                href="/keszlet/mozgasok"
                className="text-[12px] font-medium text-ink underline-offset-2 hover:underline"
              >
                Összes mozgás
              </Link>
            </div>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Dátum</DataTableHeaderCell>
                  <DataTableHeaderCell>Raktár</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">
                    Mennyiség
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Honnan / mi</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {movements.map((m) => (
                  <DataTableRow
                    key={m.id}
                    className={
                      m.movement_type === 'in'
                        ? 'bg-success-soft/35'
                        : 'bg-surface'
                    }
                  >
                    <DataTableCell>
                      <span className="tabular-nums text-body text-ink-secondary">
                        {formatShortDate(m.created_at)}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-body text-ink">
                        {m.warehouse_name}
                      </span>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <span
                        className={cn(
                          'text-[15px] font-semibold tabular-nums',
                          m.movement_type === 'in'
                            ? 'text-success-ink'
                            : 'text-ink-secondary'
                        )}
                      >
                        {m.movement_type === 'in' ? '+' : '−'}
                        {formatQty(m.quantity)} {u}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      {m.receipt_id && m.receipt_number ? (
                        <span className="flex flex-col gap-0.5">
                          <Link
                            href={`/beerkezesek/${m.receipt_id}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            Beérkezés {m.receipt_number}
                          </Link>
                          {m.po_id && m.po_number ? (
                            <Link
                              href={`/beszallitoi-rendelesek/${m.po_id}`}
                              className="text-hint text-ink-secondary underline-offset-2 hover:underline"
                            >
                              Rendelés {m.po_number}
                            </Link>
                          ) : null}
                        </span>
                      ) : m.transfer_id && m.transfer_number ? (
                        <Link
                          href={`/keszlet/atadasok/${m.transfer_id}`}
                          className="font-medium text-ink underline-offset-2 hover:underline"
                        >
                          Áttárolás {m.transfer_number}
                        </Link>
                      ) : (
                        <span className="text-body text-ink-secondary">
                          {m.source_type === 'adjustment'
                            ? 'Korrekció'
                            : m.source_type === 'transfer'
                              ? 'Áttárolás'
                              : m.source_type === 'sale'
                                ? 'Eladás'
                                : m.source_type}
                        </span>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        ) : null}

        {stock.related_orders.length > 0 ? (
          <div>
            <h3 className="mb-1.5 text-[12px] font-medium text-ink-secondary">
              Kapcsolódó rendelések
            </h3>
            <ul className="divide-y divide-border rounded-md border border-border">
              {stock.related_orders.map((po) => {
                const missing = po.remaining_qty > 0.0001
                return (
                  <li key={po.id}>
                    <Link
                      href={`/beszallitoi-rendelesek/${po.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-body hover:bg-subtle"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">
                          {po.po_number}
                        </span>
                        <StatusBadge
                          tone={poStatusTone(po.status as PurchaseOrderStatus)}
                        >
                          {PO_STATUS_LABEL[po.status as PurchaseOrderStatus] ??
                            po.status}
                        </StatusBadge>
                        <span className="truncate text-hint text-ink-muted">
                          {po.supplier_name}
                        </span>
                      </div>
                      <div className="text-right">
                        {missing ? (
                          <p className="text-[15px] font-semibold tabular-nums text-warning-ink">
                            Hiányzik {formatQty(po.remaining_qty)} {u}
                          </p>
                        ) : (
                          <p className="text-[15px] font-semibold tabular-nums text-success-ink">
                            Teljes
                          </p>
                        )}
                        <p className="text-hint tabular-nums text-ink-muted">
                          megvan {formatQty(po.received_qty)} /{' '}
                          {formatQty(po.ordered_qty)} {u}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </FormSection>
  )
}
