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
import {
  dualQtyParts,
  type DualQtyOpts
} from '@/lib/sales/material-qty'
import type { ProcurementStockPanel } from '@/lib/stock/material-panel'
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

function qtyParts(
  ledgerQty: number,
  unitShortform: string,
  dual: DualQtyOpts | null | undefined
) {
  if (dual && dual.factor > 0) {
    return dualQtyParts(ledgerQty, dual)
  }
  return {
    primaryText: `${formatQty(ledgerQty)} ${unitShortform}`,
    secondaryText: null as string | null
  }
}

type AccessoryProcurementStockSectionProps = {
  stock: ProcurementStockPanel
  /** Ha megadva, megjelenik az áttárolás link (csak termék). */
  accessoryId?: string
  unitShortform?: string
  /**
   * Anyag dual egység (tábla↔m² / db↔m).
   * Törzs Készlet: primary `display` (m²/m).
   */
  dualUnit?: DualQtyOpts | null
  emptyHint?: string
}

export function AccessoryProcurementStockSection({
  stock,
  accessoryId,
  unitShortform = 'db',
  dualUnit = null,
  emptyHint = 'Még nincs belőle raktáron. Ha bevételezel, itt jelenik meg.'
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
  const transferHref = accessoryId
    ? preferredFrom
      ? `/keszlet/atadasok/uj?accessoryId=${encodeURIComponent(accessoryId)}&fromWarehouseId=${encodeURIComponent(preferredFrom)}`
      : `/keszlet/atadasok/uj?accessoryId=${encodeURIComponent(accessoryId)}`
    : null

  const onHandParts = qtyParts(stock.total_on_hand, u, dualUnit)
  const onOrderParts = qtyParts(stock.on_order_qty, u, dualUnit)

  return (
    <FormSection
      title="Készlet"
      description={
        dualUnit?.primary === 'display'
          ? 'Mennyi van most (eladási egységben), és mi van úton.'
          : 'Mennyi van most, és mi van úton.'
      }
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
              {onHandParts.primaryText}
            </p>
            {onHandParts.secondaryText ? (
              <p className="mt-0.5 text-hint opacity-90 tabular-nums">
                {onHandParts.secondaryText}
              </p>
            ) : null}
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
              {onOrderParts.primaryText}
            </p>
            {onOrderParts.secondaryText ? (
              <p className="mt-0.5 text-hint opacity-90 tabular-nums">
                {onOrderParts.secondaryText}
              </p>
            ) : null}
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
              {transferHref ? (
                <Link
                  href={transferHref}
                  className="text-[12px] font-medium text-ink underline-offset-2 hover:underline"
                >
                  Áttárolás
                </Link>
              ) : null}
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {stock.by_warehouse.map((w) => {
                const parts = qtyParts(w.on_hand, u, dualUnit)
                return (
                  <li
                    key={w.warehouse_id}
                    className="inline-flex flex-col gap-0.5 rounded-md border border-border bg-surface px-2.5 py-1.5"
                  >
                    <span className="text-hint text-ink-secondary">
                      {w.warehouse_name}
                      {w.warehouse_code ? ` (${w.warehouse_code})` : ''}
                    </span>
                    <span className="text-[15px] font-semibold tabular-nums text-ink">
                      {parts.primaryText}
                    </span>
                    {parts.secondaryText ? (
                      <span className="text-hint tabular-nums text-ink-muted">
                        {parts.secondaryText}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {!hasAny ? (
          <p className="rounded-md border border-border bg-subtle px-3 py-2.5 text-body text-ink-secondary">
            {emptyHint}
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
                {movements.map((m) => {
                  const parts = qtyParts(m.quantity, u, dualUnit)
                  return (
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
                        <div
                          className={cn(
                            'text-[15px] font-semibold tabular-nums',
                            m.movement_type === 'in'
                              ? 'text-success-ink'
                              : 'text-ink-secondary'
                          )}
                        >
                          {m.movement_type === 'in' ? '+' : '−'}
                          {parts.primaryText}
                        </div>
                        {parts.secondaryText ? (
                          <p className="text-hint tabular-nums text-ink-muted">
                            {parts.secondaryText}
                          </p>
                        ) : null}
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
                        ) : m.cso_id ? (
                          <Link
                            href={`/ugyfelrendelesek/${m.cso_id}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            Ügyfélrendelés
                            {m.cso_order_number
                              ? ` ${m.cso_order_number}`
                              : ''}
                          </Link>
                        ) : m.sale_id && m.sale_number ? (
                          <Link
                            href={`/ertekesitesek/${m.sale_id}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            Eladás {m.sale_number}
                          </Link>
                        ) : (
                          <span className="text-body text-ink-secondary">
                            {m.source_type === 'adjustment'
                              ? 'Korrekció'
                              : m.source_type === 'transfer'
                                ? 'Áttárolás'
                                : m.source_type === 'sale'
                                  ? 'Eladás'
                                  : m.source_type === 'customer_special_order'
                                    ? 'Ügyfélrendelés'
                                    : m.source_type}
                          </span>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
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
                const remParts = qtyParts(po.remaining_qty, u, dualUnit)
                const recvParts = qtyParts(po.received_qty, u, dualUnit)
                const ordParts = qtyParts(po.ordered_qty, u, dualUnit)
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
                            Hiányzik {remParts.primaryText}
                          </p>
                        ) : (
                          <p className="text-[15px] font-semibold tabular-nums text-success-ink">
                            Teljes
                          </p>
                        )}
                        {missing && remParts.secondaryText ? (
                          <p className="text-hint tabular-nums text-ink-muted">
                            {remParts.secondaryText}
                          </p>
                        ) : null}
                        <p className="text-hint tabular-nums text-ink-muted">
                          megvan {recvParts.primaryText} / {ordParts.primaryText}
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
